/**
 * Experiment Tracker — full lifecycle management for scientific experiments.
 *
 * Tracks experiments from hypothesis through conclusion, with result analysis,
 * reproduction guides, hypothesis evolution, and search.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExperimentStatus = 'planned' | 'running' | 'completed' | 'failed' | 'paused';
export type HypothesisStatus = 'active' | 'testing' | 'supported' | 'refuted';

export interface Experiment {
  id: string;
  title: string;
  hypothesis: string;
  method: string;
  results: string;
  conclusion: string;
  status: ExperimentStatus;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Observation {
  id: string;
  experimentId: string | null;
  date: string;
  what: string;
  notes: string;
  createdAt: number;
}

export interface Hypothesis {
  id: string;
  statement: string;
  status: HypothesisStatus;
  evidence: string[];
  experimentIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ResultAnalysis {
  experimentId: string;
  summary: string;
  keyFindings: string[];
  statisticalSummary: string;
  anomalies: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface ReproductionGuide {
  experimentId: string;
  steps: string[];
  materials: string[];
  controls: string[];
  estimatedDuration: string;
  pitfalls: string[];
}

// ─── ID Generation ────────────────────────────────────────────────────────────

function uid(): string {
  return `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function obsId(): string {
  return `obs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function hypId(): string {
  return `hyp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Experiment CRUD ──────────────────────────────────────────────────────────

export class ExperimentTracker {
  private experiments: Map<string, Experiment> = new Map();

  create(data: { title: string; hypothesis: string; method: string; tags?: string[] }): Experiment {
    const now = Date.now();
    const experiment: Experiment = {
      id: uid(),
      title: data.title,
      hypothesis: data.hypothesis,
      method: data.method,
      results: '',
      conclusion: '',
      status: 'planned',
      tags: data.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.experiments.set(experiment.id, experiment);
    return experiment;
  }

  get(id: string): Experiment | undefined {
    return this.experiments.get(id);
  }

  list(filter?: { status?: ExperimentStatus; tag?: string }): Experiment[] {
    let results = Array.from(this.experiments.values());
    if (filter?.status) results = results.filter(e => e.status === filter.status);
    if (filter?.tag) results = results.filter(e => e.tags.includes(filter.tag!));
    return results.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  update(id: string, patch: Partial<Pick<Experiment, 'title' | 'hypothesis' | 'method' | 'results' | 'conclusion' | 'status' | 'tags'>>): Experiment | null {
    const exp = this.experiments.get(id);
    if (!exp) return null;
    Object.assign(exp, patch, { updatedAt: Date.now() });
    return exp;
  }

  delete(id: string): boolean {
    return this.experiments.delete(id);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  start(id: string): Experiment | null {
    return this.update(id, { status: 'running' });
  }

  complete(id: string, results: string, conclusion: string): Experiment | null {
    return this.update(id, { status: 'completed', results, conclusion });
  }

  fail(id: string, results: string): Experiment | null {
    return this.update(id, { status: 'failed', results });
  }

  pause(id: string): Experiment | null {
    return this.update(id, { status: 'paused' });
  }

  // ── Serialization ───────────────────────────────────────────────────────────

  toJSON(): Experiment[] {
    return this.list();
  }

  static fromJSON(data: Experiment[]): ExperimentTracker {
    const tracker = new ExperimentTracker();
    for (const exp of data) tracker.experiments.set(exp.id, exp);
    return tracker;
  }
}

// ─── Result Analysis ──────────────────────────────────────────────────────────

export function analyzeResults(experiment: Experiment): ResultAnalysis {
  const text = `${experiment.hypothesis} ${experiment.method} ${experiment.results} ${experiment.conclusion}`;
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());

  const keyFindings: string[] = [];
  if (experiment.results) keyFindings.push(experiment.results);
  if (experiment.conclusion) keyFindings.push(experiment.conclusion);

  const anomalies: string[] = [];
  const anomalyPatterns = /\b(anomal|unexpected|surprising|contrary|discrep|outlier|irregular|aberr)\w*/i;
  for (const sentence of sentences) {
    if (anomalyPatterns.test(sentence)) anomalies.push(sentence.trim());
  }

  let confidence: ResultAnalysis['confidence'] = 'medium';
  if (experiment.status === 'completed' && experiment.conclusion) confidence = 'high';
  if (experiment.status === 'failed' || !experiment.results) confidence = 'low';

  return {
    experimentId: experiment.id,
    summary: `${experiment.status.toUpperCase()} experiment "${experiment.title}" — ${words.length} words of documentation across ${sentences.length} sentences.`,
    keyFindings,
    statisticalSummary: `Documented in ${sentences.length} statements, ${keyFindings.length} key findings, ${anomalies.length} anomalies flagged.`,
    anomalies,
    confidence,
  };
}

// ─── Reproduction Guide ───────────────────────────────────────────────────────

export function generateReproductionGuide(experiment: Experiment): ReproductionGuide {
  const methodSteps = experiment.method
    .split(/\n|\. /)
    .map(s => s.trim())
    .filter(Boolean);

  const steps = methodSteps.length > 0
    ? methodSteps
    : ['Review original experiment method description', 'Prepare materials and environment', 'Execute experiment following original protocol'];

  const materials: string[] = [];
  const materialPatterns = /\b(\d+\.?\d*\s*(?:ml|mg|g|kg|L|mM|mM|µM|nM|%|°C|units?))\s+(\w+(?:\s+\w+)?)/gi;
  let match;
  while ((match = materialPatterns.exec(experiment.method)) !== null) {
    materials.push(`${match[1]} ${match[2]}`);
  }

  const controls: string[] = [];
  const controlPatterns = /control[,:]?\s*([^.!\n]+)/gi;
  while ((match = controlPatterns.exec(`${experiment.method} ${experiment.results}`)) !== null) {
    controls.push(match[1].trim());
  }
  if (controls.length === 0) controls.push('Positive control', 'Negative control');

  return {
    experimentId: experiment.id,
    steps,
    materials,
    controls,
    estimatedDuration: 'Varies — review method section',
    pitfalls: experiment.results
      ? ['Review original results for context', 'Note any anomalies from original run']
      : ['No prior results to reference — proceed with standard precautions'],
  };
}

// ─── Hypothesis Tracker ───────────────────────────────────────────────────────

export class HypothesisTracker {
  private hypotheses: Map<string, Hypothesis> = new Map();

  create(statement: string): Hypothesis {
    const now = Date.now();
    const hypothesis: Hypothesis = {
      id: hypId(),
      statement,
      status: 'active',
      evidence: [],
      experimentIds: [],
      createdAt: now,
      updatedAt: now,
    };
    this.hypotheses.set(hypothesis.id, hypothesis);
    return hypothesis;
  }

  get(id: string): Hypothesis | undefined {
    return this.hypotheses.get(id);
  }

  list(filter?: { status?: HypothesisStatus }): Hypothesis[] {
    let results = Array.from(this.hypotheses.values());
    if (filter?.status) results = results.filter(h => h.status === filter.status);
    return results.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  update(id: string, patch: Partial<Pick<Hypothesis, 'statement' | 'status' | 'evidence'>>): Hypothesis | null {
    const h = this.hypotheses.get(id);
    if (!h) return null;
    Object.assign(h, patch, { updatedAt: Date.now() });
    return h;
  }

  linkExperiment(hypothesisId: string, experimentId: string): Hypothesis | null {
    const h = this.hypotheses.get(hypothesisId);
    if (!h) return null;
    if (!h.experimentIds.includes(experimentId)) {
      h.experimentIds.push(experimentId);
      h.updatedAt = Date.now();
    }
    return h;
  }

  addEvidence(id: string, evidence: string): Hypothesis | null {
    const h = this.hypotheses.get(id);
    if (!h) return null;
    h.evidence.push(evidence);
    h.updatedAt = Date.now();
    return h;
  }

  delete(id: string): boolean {
    return this.hypotheses.delete(id);
  }

  /** Get evolution timeline: all status changes for a hypothesis */
  timeline(): Array<{ hypothesis: Hypothesis; relatedExperiments: number }> {
    return this.list().map(h => ({
      hypothesis: h,
      relatedExperiments: h.experimentIds.length,
    }));
  }

  toJSON(): Hypothesis[] {
    return this.list();
  }

  static fromJSON(data: Hypothesis[]): HypothesisTracker {
    const tracker = new HypothesisTracker();
    for (const h of data) tracker.hypotheses.set(h.id, h);
    return tracker;
  }
}

// ─── Observation Log ──────────────────────────────────────────────────────────

export class ObservationLog {
  private observations: Map<string, Observation> = new Map();

  log(data: { experimentId?: string; date: string; what: string; notes: string }): Observation {
    const obs: Observation = {
      id: obsId(),
      experimentId: data.experimentId ?? null,
      date: data.date,
      what: data.what,
      notes: data.notes,
      createdAt: Date.now(),
    };
    this.observations.set(obs.id, obs);
    return obs;
  }

  get(id: string): Observation | undefined {
    return this.observations.get(id);
  }

  list(filter?: { experimentId?: string }): Observation[] {
    let results = Array.from(this.observations.values());
    if (filter?.experimentId) results = results.filter(o => o.experimentId === filter.experimentId);
    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  delete(id: string): boolean {
    return this.observations.delete(id);
  }

  toJSON(): Observation[] {
    return this.list();
  }

  static fromJSON(data: Observation[]): ObservationLog {
    const log = new ObservationLog();
    for (const o of data) log.observations.set(o.id, o);
    return log;
  }
}

// ─── Experiment Search ────────────────────────────────────────────────────────

export class ExperimentSearch {
  private tracker: ExperimentTracker;

  constructor(tracker: ExperimentTracker) {
    this.tracker = tracker;
  }

  /** Full-text search across experiment fields */
  search(query: string): Experiment[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return this.tracker.list();

    return this.tracker.list().filter(exp => {
      const searchable = [
        exp.title, exp.hypothesis, exp.method, exp.results, exp.conclusion,
        ...exp.tags,
      ].join(' ').toLowerCase();
      return terms.every(term => searchable.includes(term));
    });
  }

  /** Find experiments by date range */
  byDateRange(start: number, end: number): Experiment[] {
    return this.tracker.list().filter(e => e.createdAt >= start && e.createdAt <= end);
  }

  /** Find experiments by status */
  byStatus(status: ExperimentStatus): Experiment[] {
    return this.tracker.list({ status });
  }
}
