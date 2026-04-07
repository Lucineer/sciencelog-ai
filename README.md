# sciencelog-ai 📓

A tool that helps you keep track of papers and experiments. Paste an ArXiv link or drop a PDF to get structured summaries and maintain a permanent, private log for your research. It runs on your own Cloudflare Worker. No accounts, no external servers.

**Live Instance:** https://sciencelog-ai.casey-digennaro.workers.dev

## Why This Exists
Most research tools are either locked into a platform or overloaded with features. This is built for the working process: capturing notes on papers and experiment parameters without trusting a third party with your unfinished work.

## Quick Start
1.  **Fork this repository.** The project is designed to be forked first.
2.  **Deploy** to Cloudflare Workers using `wrangler deploy`.
3.  **Add your LLM API key** once as a worker secret. No other setup is required.

## Features
*   **Structured Paper Summaries:** Extracts title, authors, key points, methodology, and cited follow-up work.
*   **Experiment Logging:** Timestamped logs for test parameters and results.
*   **Linked Notes:** Connect your thoughts directly to a source paper or log entry.
*   **Private Operation:** No telemetry or external analytics. Data stays in your Worker and connected KV store.
*   **LLM Flexibility:** Configure it for OpenAI, Anthropic, Ollama, or any compatible API endpoint.
*   **Fleet Native:** Designed to connect with other Cocapn Fleet tools.

## What Makes This Different
*   **You Deploy and Control It.** This is not a SaaS. You run the entire instance, so there is no central service to sunset or monitor your data.
*   **Zero Runtime Dependencies.** The Worker is a single, self-contained codebase without external npm packages, minimizing maintenance.
*   **Fork-First Philosophy.** You are expected to clone and modify this for your own use. You do not need to contribute back or ask for permission.

## Setup
Set an `OPENAI_API_KEY` or a key for a compatible provider using `wrangler secret put`. You supply the key and manage the costs directly with your LLM provider.

## Honest Limitation
The quality and accuracy of the automated paper summarization depend entirely on the LLM you configure. It can make mistakes or omit important context. You should treat its output as a helpful starting draft, not a verified source.

## Contributing
Pull requests for clear, minor improvements are welcome. The primary intended use is for you to fork the repository and adapt it for your own needs.

## License
MIT License.

Superinstance and Lucineer (DiGennaro et al.).

<div style="text-align:center;padding:16px;color:#64748b;font-size:.8rem"><a href="https://the-fleet.casey-digennaro.workers.dev" style="color:#64748b">The Fleet</a> &middot; <a href="https://cocapn.ai" style="color:#64748b">Cocapn</a></div>