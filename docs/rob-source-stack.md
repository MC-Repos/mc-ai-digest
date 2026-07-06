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

Known-good checks from Workshop:

```bash
cd /home/sysop/projects/mc-ai-digest
pnpm feeds:check
systemctl --user status rob-report.service --no-pager -l
journalctl --user -u rob-report.service -n 80 --no-pager
```

As of 2026-05-21 05:22 CEST:

- `pnpm feeds:check` is green for all configured feeds.
- `rob-report.service` last exited `status=0/SUCCESS`.
- The latest run posted to Open WebUI `#rob` and Telegram.
- The Open WebUI `#incidents` unresolved scan returned `count: 0`.

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

Feed health is checked by:

- `scripts/check-feeds.mjs`
- npm script: `pnpm feeds:check`

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

Provider routing rules:

- `openrouter` uses `OPENROUTER_API_KEY`.
- `openai` and `openai-compatible` use `OPENAI_API_KEY` unless an explicit
  config key is supplied.
- Auth failures and all-route failures fail loudly.
- Quota, billing, rate-limit, temporary provider, and model availability
  failures can try the configured model fallback list first.
- If a fallback succeeds, a warning is posted to `#incidents`; this is degraded
  mode, not silent success.

Do not store provider/model/fallback route names in Infisical. They are not
secrets and should remain auditable in YAML.

## Tool And Code Path

The ROB pipeline is intentionally small:

- `src/runDigest.js`: main orchestration, delivery, and incident posting.
- `src/config.js`: YAML config loading.
- `src/feeds.js`: RSS fetch and feed-warning capture.
- `src/filter.js`: keyword filtering and initial scoring.
- `src/ai.js`: OpenAI-compatible analysis, model routing, fallbacks, preflight.
- `src/rob.js`: action-first ROB brief construction.
- `src/robRenderers.js`: plain-text report output with source links.
- `src/openwebui.js`: `#rob` webhook delivery.
- `src/telegram.js`: Telegram fallback delivery.
- `src/time.js`: Malta-local incident/report timestamps.

External tools/services used at runtime:

- Infisical for provider keys and webhook URLs.
- OpenRouter for the configured primary and fallback model route.
- Open WebUI channel webhooks for `#rob` and `#incidents`.
- Telegram Bot API as fallback delivery.
- systemd user timers/services on Workshop.

External tools/services deliberately not used as production runtime:

- GitHub Actions. It may remain a manual artifact/fallback path, but Workshop
  systemd is the live scheduler.
- Anthropic. Old dependencies may exist elsewhere, but ROB should not route
  through Anthropic unless explicitly reintroduced.

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

The Open WebUI incident scanner in Kraken reads `#incidents` every 15 minutes
and stays quiet unless a new unresolved incident appears. Resolutions can be
recorded with a message containing `[resolved]` and `Resolves: <incident title>`.

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
