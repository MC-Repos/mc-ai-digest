# The ROB Report Source Stack

Updated: 2026-05-21

The ROB Report is a research-opportunity brief, not a generic newsletter. It
should produce action candidates with enough source evidence for follow-up.

## Runtime

- Workshop service: `rob-report.service`
- Schedule: `rob-report.timer`
- Config: `/home/sysop/projects/mc-ai-digest/config/workshop.yaml`
- Secrets: Infisical project resolved from `/home/sysop/projects/mc-the-kraken`
- Primary delivery: Open WebUI `#rob`
- Incident delivery: Open WebUI `#incidents`
- Fallback delivery: Telegram

## Config vs Secrets

Non-secret app behavior belongs in YAML config:

- feed URLs
- keywords
- primary model
- fallback model list
- timeouts
- preflight flag
- delivery enable/disable flags

Secrets and secret-like handles belong in Infisical:

- provider API keys
- Open WebUI webhook URLs/tokens
- Telegram bot credentials
- SMTP/Twilio credentials if enabled

## Current Feeds

- `https://openai.com/news/rss.xml`
- `https://blog.google/technology/ai/rss/`
- `https://venturebeat.com/category/ai/feed/`
- `https://www.marktechpost.com/feed/`
- `https://rss.arxiv.org/rss/cs.AI`
- `https://rss.arxiv.org/rss/cs.CV`
- `https://rss.arxiv.org/rss/eess.AS`

The previously configured feeds below were removed because they produced
repeatable source failures:

- `https://openai.com/blog/rss/` -> HTTP 403
- `https://ai.googleblog.com/feeds/posts/default` -> HTTP 404

## AI Route

Provider: OpenRouter.

Primary model:

- `openai/gpt-5.5`

Fallback order:

1. `openai/gpt-5.4`
2. `google/gemini-2.5-pro`
3. `moonshotai/kimi-k2.6`
4. `deepseek/deepseek-v4-pro`

Fallback logic lives in `src/ai.js`. Config only declares the route.

## Incident Policy

Hard failures:

- provider auth failure
- provider quota/billing/credit exhaustion after all viable fallbacks fail
- all AI routes fail
- webhook delivery failure that prevents required incident reporting

Operational warnings:

- source feed failures when the report still completes
- AI model fallback was used and the report still completes

Warnings should post to `#incidents` because stale sources and degraded model
routes are real operational drift, even when they do not block delivery.

## Source Review Queue

Next review pass should decide whether to add or remove sources by signal
quality. Candidate additions:

- Google Research Blog RSS: `https://research.google/blog/rss/`
- Google DeepMind Blog RSS: `https://deepmind.google/blog/rss.xml`
- Hacker News / Lobsters filtered AI infrastructure items
- Papers With Code trending tasks for audio, video, multimodal, ASR, and agents
- GitHub releases or search feeds for relevant open-source implementation drops

Review criteria:

- actionable links
- code/dataset availability
- relevance to Mattie's current portfolio
- low duplicate volume
- reliable RSS/API behavior
- enough source diversity beyond vendor blogs
