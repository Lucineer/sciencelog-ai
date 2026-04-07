# sciencelog-ai
🔬 An AI-assisted log for scientific work. Track papers, experiments, and notes in one place.

You read a paper, run an experiment, and take notes. This tool helps you connect them so you can find what you need later.

**Live URL:** https://sciencelog-ai.casey-digennaro.workers.dev

---

## Why it exists
Research tools often impose rigid structures. AI notetakers can produce outputs that aren't useful for actual experimental work. This is a simple, self-contained tool that helps you link your work without getting in your way.

## What it provides
- **You own your data:** No accounts or telemetry. You deploy it. Your data stays in your worker.
- **One Cloudflare Worker:** Zero runtime dependencies. No database or external services required.
- **Structured for work:** Summaries and logs are formatted for practical use.
- **Part of the Fleet:** A native Cocapn Fleet agent. Connect it to other fleet tools or extend its functionality.

---

## Quick Start
1.  **Fork this repository.** The project is designed to be forked and owned by you.
2.  Deploy to Cloudflare Workers using `wrangler deploy`.
3.  Add your LLM API key as a worker secret.

## Core Features
- **Paper Summaries:** Upload a PDF or provide an ArXiv/DOI link. Get a structured summary including key findings and cited follow-up work.
- **Experiment Logging:** Log your setup, parameters, and results. Entries are timestamped.
- **Note Management:** Write research notes and connect them to related papers or experiments.
- **Connection Tracking:** Entries can be linked manually, helping you see relationships in your work.

## Bring Your Own Keys
Set an `OPENAI_API_KEY` or compatible key via `wrangler secret put`. The model interface is modular and can be swapped.

## An Honest Limitation
This is a self-hosted tool. Setup and maintenance—like managing your API key and deploying updates—is your responsibility. The AI's output quality depends on the model you configure.

## Contributing
This is an open-source vessel in the Cocapn Fleet. The philosophy is fork-first: adapt it for your lab. Pull requests for clear improvements are welcome.

## License
MIT License.

Superinstance & Lucineer (DiGennaro et al.).

---

<div align="center">
  <a href="https://the-fleet.casey-digennaro.workers.dev">The Fleet</a> • 
  <a href="https://cocapn.ai">Cocapn</a>
</div>