import { addNode, addEdge, traverse, crossDomainQuery, findPath, domainStats, getDomainNodes } from './lib/knowledge-graph.js';
import { loadSeedIntoKG, FLEET_REPOS, loadAllSeeds } from './lib/seed-loader.js';
/**
 * sciencelog.ai — Cloudflare Worker
 *
 * A lab notebook that thinks. AI-powered experiment tracking for scientists.
 * Routes: /api/chat, /api/experiments, /api/observations, /api/hypotheses,
 *         /api/literature, GET / (landing)
 *
 * Secrets (set via `wrangler secret put`):
 *   DEEPSEEK_API_KEY
 */

import {
  ExperimentTracker, ObservationLog, HypothesisTracker,
  ExperimentSearch, analyzeResults, generateReproductionGuide,
  type Experiment, type Observation, type Hypothesis,
} from './experiments/tracker.js';
import {
  summarizeLiterature, generateHypotheses, suggestExperimentalDesign,
  interpretData, CitationManager, type Citation,
} from './research/assistant.js';
import { LLM } from './research/llm.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Env {
  DEEPSEEK_API_KEY?: string;
  PROVIDER: string;
  MODEL: string;
  STORAGE: KVNamespace;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function html(content: string): Response {
  return new Response(content, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function getLLM(env: Env): LLM {
  return new LLM({
    provider: env.PROVIDER || 'deepseek',
    apiKey: env.DEEPSEEK_API_KEY,
    model: env.MODEL || undefined,
  });
}

async function loadTracker(kv: KVNamespace): Promise<ExperimentTracker> {
  const raw = await kv.get('sciencelog:experiments');
  if (!raw) return new ExperimentTracker();
  try { return ExperimentTracker.fromJSON(JSON.parse(raw) as Experiment[]); }
  catch { return new ExperimentTracker(); }
}

async function saveTracker(kv: KVNamespace, tracker: ExperimentTracker): Promise<void> {
  await kv.put('sciencelog:experiments', JSON.stringify(tracker.toJSON()));
}

async function loadObservations(kv: KVNamespace): Promise<ObservationLog> {
  const raw = await kv.get('sciencelog:observations');
  if (!raw) return new ObservationLog();
  try { return ObservationLog.fromJSON(JSON.parse(raw) as Observation[]); }
  catch { return new ObservationLog(); }
}

async function saveObservations(kv: KVNamespace, log: ObservationLog): Promise<void> {
  await kv.put('sciencelog:observations', JSON.stringify(log.toJSON()));
}

async function loadHypotheses(kv: KVNamespace): Promise<HypothesisTracker> {
  const raw = await kv.get('sciencelog:hypotheses');
  if (!raw) return new HypothesisTracker();
  try { return HypothesisTracker.fromJSON(JSON.parse(raw) as Hypothesis[]); }
  catch { return new HypothesisTracker(); }
}

async function saveHypotheses(kv: KVNamespace, tracker: HypothesisTracker): Promise<void> {
  await kv.put('sciencelog:hypotheses', JSON.stringify(tracker.toJSON()));
}

async function loadCitations(kv: KVNamespace): Promise<CitationManager> {
  const raw = await kv.get('sciencelog:citations');
  if (!raw) return new CitationManager();
  try { return CitationManager.fromJSON(JSON.parse(raw) as Citation[]); }
  catch { return new CitationManager(); }
}

async function saveCitations(kv: KVNamespace, mgr: CitationManager): Promise<void> {
  await kv.put('sciencelog:citations', JSON.stringify(mgr.toJSON()));
}

// ─── Chat Handler (SSE streaming) ────────────────────────────────────────────

async function handleChat(req: Request, env: Env): Promise<Response> {
  let body: { message?: string };
  try { body = await req.json() as { message?: string }; }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const userMessage = (body.message ?? '').trim();
  if (!userMessage) return json({ error: 'Empty message' }, 400);

  // Build context from stored data
  const tracker = await loadTracker(env.STORAGE);
  const obs = await loadObservations(env.STORAGE);
  const hyp = await loadHypotheses(env.STORAGE);

  const recentExperiments = tracker.list().slice(0, 5).map(e =>
    `[${e.status}] ${e.title}: ${e.hypothesis}`
  ).join('\n');
  const recentObs = obs.list().slice(0, 5).map(o =>
    `${o.date}: ${o.what}`
  ).join('\n');
  const recentHyp = hyp.list().slice(0, 5).map(h =>
    `[${h.status}] ${h.statement}`
  ).join('\n');

  const systemPrompt = `You are sciencelog.ai — an AI lab notebook that thinks. You help scientists track experiments, analyze results, generate hypotheses, and review literature.

## Current Lab State
### Recent Experiments
${recentExperiments || '(none yet)'}

### Recent Observations
${recentObs || '(none yet)'}

### Active Hypotheses
${recentHyp || '(none yet)'}

Be precise, scientific, and helpful. When asked about variables, anomalies, or results, reference the lab data above when relevant.`;

  const llm = getLLM(env);
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Start streaming in background
  (async () => {
    try {
      for await (const chunk of llm.chatStream([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ])) {
        if (chunk.type === 'content' && chunk.text) {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ content: chunk.text })}\n\n`));
        }
        if (chunk.type === 'error') {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ error: chunk.error })}\n\n`));
        }
      }
    } catch (err) {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`));
    }
    await writer.write(encoder.encode('data: [DONE]\n\n'));
    await writer.close();
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

function landingHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>sciencelog.ai — A Lab Notebook That Thinks</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--teal:#0D9488;--teal-light:#14B8A6;--teal-dark:#0F766E;--bg:#F0FDFA;--surface:#fff;--text:#134E4A;--muted:#5F7A76;--border:#99F6E4;--radius:12px}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
  .container{max-width:960px;margin:0 auto;padding:0 24px}
  header{padding:48px 0 32px;text-align:center}
  header h1{font-size:clamp(32px,5vw,48px);font-weight:800;color:var(--teal);letter-spacing:-1px}
  header h1 span{color:var(--text)}
  header p{font-size:18px;color:var(--muted);margin-top:8px;max-width:520px;margin-inline:auto}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin:40px 0}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:28px;transition:transform .15s,box-shadow .15s}
  .card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(13,148,136,.12)}
  .card h2{font-size:18px;font-weight:700;color:var(--teal);margin-bottom:8px}
  .card p{color:var(--muted);font-size:14px}
  .cta{display:inline-block;margin:32px 0 64px;padding:14px 32px;background:var(--teal);color:#fff;border-radius:var(--radius);text-decoration:none;font-weight:600;font-size:16px;transition:background .15s}
  .cta:hover{background:var(--teal-dark)}
  footer{text-align:center;padding:24px;color:var(--muted);font-size:13px;border-top:1px solid var(--border)}
  .badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
  .badge-teal{background:var(--border);color:var(--teal-dark)}
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>science<span>log</span>.ai</h1>
    <p>A lab notebook that thinks. AI-powered experiment tracking for scientists and researchers.</p>
  </header>
  <div class="grid">
    <div class="card">
      <h2>Experiments</h2>
      <p>Full lifecycle tracking from hypothesis to conclusion. Status badges, result analysis, and reproduction guides.</p>
    </div>
    <div class="card">
      <h2>Hypotheses</h2>
      <p>Track hypothesis evolution. Link evidence, experiments, and status changes over time.</p>
    </div>
    <div class="card">
      <h2>Observations</h2>
      <p>Log observations with timestamps. Attach to experiments or keep standalone field notes.</p>
    </div>
    <div class="card">
      <h2>AI Chat</h2>
      <p>Ask questions about your data. "What variables might explain this anomaly?" Get scientific answers.</p>
    </div>
    <div class="card">
      <h2>Literature</h2>
      <p>Search and summarize research topics. AI-generated literature reviews with gap analysis.</p>
    </div>
    <div class="card">
      <h2>Citations</h2>
      <p>Track references with APA/MLA/Chicago formatting. Never lose a source again.</p>
    </div>
  </div>
  <div style="text-align:center">
    <a class="cta" href="/app.html">Open Lab Notebook</a>
  </div>
  <footer>
    <span class="badge badge-teal">Cloudflare Workers</span>
    &nbsp; sciencelog.ai &mdash; a vessel for researchers
  </footer>
</div>
</body>
</html>`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // ── Landing ─────────────────────────────────────────────────────────────
    if (method === 'GET' && (path === '/' || path === '/index.html')) {
      return html(landingHTML());
    }

    // ── App UI ──────────────────────────────────────────────────────────────
    if (method === 'GET' && path === '/app.html') {
      const appHtml = env.ASSETS ? null : null; // serve from KV or inline
      // For dev, serve from KV. The full HTML is at public/app.html.
      // In production, you'd bind this to a static asset or KV.
      return html('<!-- app.html served from /public -->');
    }

    // ── Chat (SSE) ─────────────────────────────────────────────────────────
    if (method === 'POST' && path === '/api/chat') {
      return handleChat(req, env);
    }

    // ── Experiments ─────────────────────────────────────────────────────────
    // ── Knowledge Graph (Phase 4B) ──
    if (path.startsWith('/api/kg')) {
      const _kj = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      if (path === '/api/kg' && method === 'GET') return _kj({ domain: url.searchParams.get('domain') || 'sciencelog-ai', nodes: await getDomainNodes(env, url.searchParams.get('domain') || 'sciencelog-ai') });
      if (path === '/api/kg/explore' && method === 'GET') {
        const nid = url.searchParams.get('node');
        if (!nid) return _kj({ error: 'node required' }, 400);
        return _kj(await traverse(env, nid, parseInt(url.searchParams.get('depth') || '2'), url.searchParams.get('domain') || undefined));
      }
      if (path === '/api/kg/cross' && method === 'GET') return _kj({ query: url.searchParams.get('query') || '', domain: url.searchParams.get('domain') || 'sciencelog-ai', results: await crossDomainQuery(env, url.searchParams.get('query') || '', url.searchParams.get('domain') || 'sciencelog-ai') });
      if (path === '/api/kg/domains' && method === 'GET') return _kj(await domainStats(env));
      if (path === '/api/kg/sync' && method === 'POST') return _kj(await loadAllSeeds(env, FLEET_REPOS));
      if (path === '/api/kg/seed' && method === 'POST') { const b = await request.json(); return _kj(await loadSeedIntoKG(env, b, b.domain || 'sciencelog-ai')); }
    }

    if (path === '/api/experiments') {
      if (method === 'GET') {
        const tracker = await loadTracker(env.STORAGE);
        const status = url.searchParams.get('status') as Experiment['status'] | null;
        const tag = url.searchParams.get('tag');
        const search = url.searchParams.get('q');
        if (search) {
          const s = new ExperimentSearch(tracker);
          return json(s.search(search));
        }
        return json(tracker.list(status ? { status } : tag ? { tag } : undefined));
      }
      if (method === 'POST') {
        let body: { title?: string; hypothesis?: string; method?: string; tags?: string[] };
        try { body = await req.json() as typeof body; }
        catch { return json({ error: 'Invalid JSON' }, 400); }
        if (!body.title) return json({ error: 'title is required' }, 400);
        const tracker = await loadTracker(env.STORAGE);
        const exp = tracker.create({
          title: body.title,
          hypothesis: body.hypothesis ?? '',
          method: body.method ?? '',
          tags: body.tags,
        });
        await saveTracker(env.STORAGE, tracker);
        return json(exp, 201);
      }
    }

    // ── Single Experiment ───────────────────────────────────────────────────
    const expMatch = path.match(/^\/api\/experiments\/([\w]+)$/);
    if (expMatch) {
      const id = expMatch[1];
      const tracker = await loadTracker(env.STORAGE);

      if (method === 'GET') {
        const exp = tracker.get(id);
        if (!exp) return json({ error: 'Not found' }, 404);
        // Check for ?action=analyze or ?action=reproduce
        const action = url.searchParams.get('action');
        if (action === 'analyze') return json(analyzeResults(exp));
        if (action === 'reproduce') return json(generateReproductionGuide(exp));
        return json(exp);
      }
      if (method === 'PUT' || method === 'PATCH') {
        let body: Partial<Experiment>;
        try { body = await req.json() as Partial<Experiment>; }
        catch { return json({ error: 'Invalid JSON' }, 400); }
        const updated = tracker.update(id, body);
        if (!updated) return json({ error: 'Not found' }, 404);
        await saveTracker(env.STORAGE, tracker);
        return json(updated);
      }
      if (method === 'DELETE') {
        const deleted = tracker.delete(id);
        if (!deleted) return json({ error: 'Not found' }, 404);
        await saveTracker(env.STORAGE, tracker);
        return json({ ok: true });
      }
    }

    // ── Observations ────────────────────────────────────────────────────────
    if (path === '/api/observations') {
      if (method === 'GET') {
        const log = await loadObservations(env.STORAGE);
        const experimentId = url.searchParams.get('experimentId');
        return json(log.list(experimentId ? { experimentId } : undefined));
      }
      if (method === 'POST') {
        let body: { experimentId?: string; date?: string; what?: string; notes?: string };
        try { body = await req.json() as typeof body; }
        catch { return json({ error: 'Invalid JSON' }, 400); }
        if (!body.what) return json({ error: 'what is required' }, 400);
        const log = await loadObservations(env.STORAGE);
        const obs = log.log({
          experimentId: body.experimentId,
          date: body.date ?? new Date().toISOString().split('T')[0],
          what: body.what,
          notes: body.notes ?? '',
        });
        await saveObservations(env.STORAGE, log);
        return json(obs, 201);
      }
    }

    // ── Hypotheses ──────────────────────────────────────────────────────────
    if (path === '/api/hypotheses') {
      if (method === 'GET') {
        const tracker = await loadHypotheses(env.STORAGE);
        const status = url.searchParams.get('status') as Hypothesis['status'] | null;
        return json(tracker.list(status ? { status: status as any } : undefined));
      }
      if (method === 'POST') {
        let body: { statement?: string; status?: string };
        try { body = await req.json() as typeof body; }
        catch { return json({ error: 'Invalid JSON' }, 400); }
        if (!body.statement) return json({ error: 'statement is required' }, 400);
        const tracker = await loadHypotheses(env.STORAGE);
        const hyp = tracker.create(body.statement);
        if (body.status) tracker.update(hyp.id, { status: body.status as Hypothesis['status'] });
        await saveHypotheses(env.STORAGE, tracker);
        return json(hyp, 201);
      }
    }

    // ── Single Hypothesis ───────────────────────────────────────────────────
    const hypMatch = path.match(/^\/api\/hypotheses\/([\w]+)$/);
    if (hypMatch) {
      const id = hypMatch[1];
      const tracker = await loadHypotheses(env.STORAGE);

      if (method === 'GET') {
        const h = tracker.get(id);
        if (!h) return json({ error: 'Not found' }, 404);
        return json(h);
      }
      if (method === 'PUT' || method === 'PATCH') {
        let body: Partial<Hypothesis>;
        try { body = await req.json() as Partial<Hypothesis>; }
        catch { return json({ error: 'Invalid JSON' }, 400); }
        const updated = tracker.update(id, body);
        if (!updated) return json({ error: 'Not found' }, 404);
        await saveHypotheses(env.STORAGE, tracker);
        return json(updated);
      }
      if (method === 'DELETE') {
        const deleted = tracker.delete(id);
        if (!deleted) return json({ error: 'Not found' }, 404);
        await saveHypotheses(env.STORAGE, tracker);
        return json({ ok: true });
      }
    }

    // ── Literature (LLM-powered) ────────────────────────────────────────────
    if (method === 'GET' && path === '/api/literature') {
      const topic = url.searchParams.get('topic');
      if (!topic) return json({ error: 'topic query parameter required' }, 400);
      const llm = getLLM(env);
      const result = await summarizeLiterature(llm, topic);
      return json(result);
    }

    // ── AI Endpoints ────────────────────────────────────────────────────────
    if (method === 'POST' && path === '/api/interpret') {
      let body: { data?: string; context?: string };
      try { body = await req.json() as typeof body; }
      catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!body.data) return json({ error: 'data is required' }, 400);
      const llm = getLLM(env);
      const result = await interpretData(llm, body.data, body.context);
      return json(result);
    }

    if (method === 'POST' && path === '/api/design') {
      let body: { hypothesis?: string; constraints?: string };
      try { body = await req.json() as typeof body; }
      catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!body.hypothesis) return json({ error: 'hypothesis is required' }, 400);
      const llm = getLLM(env);
      const result = await suggestExperimentalDesign(llm, body.hypothesis, body.constraints);
      return json(result);
    }

    if (method === 'POST' && path === '/api/hypothesize') {
      let body: { observations?: string; field?: string };
      try { body = await req.json() as typeof body; }
      catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!body.observations) return json({ error: 'observations is required' }, 400);
      const llm = getLLM(env);
      const result = await generateHypotheses(llm, body.observations, body.field);
      return json(result);
    }

    // ── Status ──────────────────────────────────────────────────────────────
    if (method === 'GET' && path === '/api/status') {
      const tracker = await loadTracker(env.STORAGE);
      const obs = await loadObservations(env.STORAGE);
      const hyp = await loadHypotheses(env.STORAGE);
      return json({
        name: 'sciencelog.ai',
        description: 'A lab notebook that thinks',
        experiments: tracker.list().length,
        observations: obs.list().length,
        hypotheses: hyp.list().length,
        provider: env.PROVIDER || 'deepseek',
      });
    }

    return json({ error: 'Not found' }, 404);
  },
} satisfies ExportedHandler<Env>;
