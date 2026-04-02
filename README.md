# sciencelog.ai

A lab notebook that thinks. AI-powered experiment tracking for scientists and researchers.

Built on [Cloudflare Workers](https://workers.cloudflare.com/) with [DeepSeek](https://deepseek.com/) for AI inference.

## Features

- **Experiment Tracker** — Full lifecycle from hypothesis to conclusion, with status badges, result analysis, and reproduction guides
- **Hypothesis Tracker** — Track hypothesis evolution over time with evidence linking and status changes
- **Observation Log** — Timestamped observations with optional experiment linking
- **AI Chat** — Ask questions about your data with streaming responses. "What variables might explain this anomaly?"
- **Literature Search** — AI-generated summaries of research topics with gap analysis
- **Experimental Design** — AI-suggested methods, variables, and controls
- **Data Interpretation** — Help analyzing results with pattern detection
- **Citation Manager** — Track references with APA/MLA/Chicago formatting

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | AI chat (SSE streaming) |
| `GET/POST` | `/api/experiments` | List / create experiments |
| `GET/PUT/DELETE` | `/api/experiments/:id` | Read / update / delete experiment |
| `GET` | `/api/experiments/:id?action=analyze` | Result analysis |
| `GET` | `/api/experiments/:id?action=reproduce` | Reproduction guide |
| `GET/POST` | `/api/observations` | List / create observations |
| `GET/POST` | `/api/hypotheses` | List / create hypotheses |
| `GET/PUT/DELETE` | `/api/hypotheses/:id` | Read / update / delete hypothesis |
| `GET` | `/api/literature?topic=...` | AI literature summary |
| `POST` | `/api/interpret` | AI data interpretation |
| `POST` | `/api/design` | AI experimental design |
| `POST` | `/api/hypothesize` | AI hypothesis generation |
| `GET` | `/api/status` | System status |
| `GET` | `/` | Landing page |

## Setup

```bash
# Install dependencies
npm install

# Set your API key
npx wrangler secret put DEEPSEEK_API_KEY

# Run locally
npm run dev

# Deploy
npm run deploy
```

## Architecture

```
src/
  worker.ts              # Cloudflare Worker — routing, SSE streaming, landing page
  experiments/
    tracker.ts           # Experiment, Observation, Hypothesis CRUD + search + analysis
  research/
    assistant.ts         # Literature summary, hypothesis gen, experimental design, citations
    llm.ts               # Multi-provider LLM client (DeepSeek, OpenAI)
public/
  app.html               # Teal/white lab UI — experiments, hypotheses, chat, literature
```

## Configuration

Set via `wrangler.toml` or environment variables:

- `PROVIDER` — `deepseek` (default) or `openai`
- `MODEL` — Model name (default: `deepseek-chat`)
- `DEEPSEEK_API_KEY` — API key (set via `wrangler secret put`)

## License

MIT

## License

MIT — Built with ❤️ by [Superinstance](https://github.com/superinstance) & [Lucineer](https://github.com/Lucineer) (DiGennaro et al.)
