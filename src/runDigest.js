import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./config.js";
import { consumeFeedWarnings, fetchAllFeeds } from "./feeds.js";
import { filterAndScoreItems } from "./filter.js";
import { summarizeItem } from "./summarize.js";
import { writeHtmlPage } from "./page.js";
import { sendDigestEmail } from "./email.js";
import { sendDigestSms } from "./sms.js";
import { logInfo, logError } from "./logger.js";
import { initializeAI, analyzeArticle, consumeProviderWarnings, getAIClient, validateAIProvider } from "./ai.js";
import { generatePodcast } from "./podcast.js";
import { buildRobBrief } from "./rob.js";
import { renderRobText } from "./robRenderers.js";
import { sendRobTelegram } from "./telegram.js";
import { sendRobOpenWebUI } from "./openwebui.js";

async function run() {
  logInfo("Starting daily digest…");

  try {
    const cfg = loadConfig();
    const now = new Date();

    // Initialize AI if configured
    if (cfg.ai) {
      initializeAI(cfg.ai);
      if (cfg.ai.preflight !== false) {
        await validateAIProvider();
      }
    }

    const raw = await fetchAllFeeds(cfg.feeds);
    const filtered = filterAndScoreItems(raw, cfg.keywords, 24);

    const max = cfg.output.maxItems || 15;
    const topItems = filtered.slice(0, max);

    // Use AI for analysis if available, otherwise fallback to simple summarization
    let items;
    if (cfg.ai) {
      logInfo("Analyzing articles with AI...");
      items = await Promise.all(
        topItems.map(item => analyzeArticle(item, cfg.keywords))
      );
      logInfo("AI analysis complete");
    } else {
      logInfo("AI not configured, using simple summarization");
      items = topItems.map(i => ({
        ...i,
        summary: summarizeItem(i),
        viabilityScore: 0,
        relevanceScore: 0,
      }));
    }

    const brief = buildRobBrief(items, now, cfg.timeZone);
    logInfo(`ROB brief generated with ${brief.top_actions.length} top actions`);
    logInfo(`Hermes/Telegram ROB preview:\n${renderRobText(brief)}`);

    const { slug } = writeHtmlPage(now, items, cfg);
    const robTextPath = path.join(cfg.output.webDir, `${slug}.rob.txt`);
    fs.writeFileSync(robTextPath, renderRobText(brief), "utf8");
    logInfo(`Wrote ROB text artifact ${robTextPath}`);

    // Generate podcast if enabled
    let podcastUrl = null;
    if (cfg.podcast?.enabled && process.env.ELEVENLABS_API_KEY && cfg.ai) {
      try {
        const aiClient = getAIClient();
        const podcast = await generatePodcast(
          items,
          aiClient,
          process.env.ELEVENLABS_API_KEY,
          slug,
          cfg.podcast.audioDir,
          cfg.podcast.audioBaseUrl
        );
        podcastUrl = podcast.audioUrl;
        logInfo(`Podcast generated: ${podcastUrl}`);
      } catch (error) {
        logError('Podcast generation failed (continuing with digest):', error);
      }
    }

    await sendDigestEmail(now, items, cfg, brief);
    await sendRobTelegram(brief, cfg);
    await sendRobOpenWebUI(brief, cfg);
    await sendDigestSms(now, items, cfg, podcastUrl, brief);
    await postOperationalWarnings(
      "The ROB Report had source feed failures",
      consumeFeedWarnings(),
      "The report completed, but source coverage needs attention."
    );
    await postOperationalWarnings(
      "The ROB Report used an AI fallback",
      consumeProviderWarnings(),
      "The report completed, but the primary AI route needs attention."
    );

    logInfo(`Digest completed for ${slug}`);
  } catch (err) {
    logError("Digest run failed", err);
    await postIncident(err).catch((incidentErr) => {
      logError("Incident post failed", incidentErr);
    });
    process.exitCode = 1;
  }
}

async function postIncident(err) {
  const webhookUrl = process.env.OPENWEBUI_CHANNEL_WEBHOOK_INCIDENTS_URL;
  if (!webhookUrl) return;
  const content = [
    "The ROB Report failed",
    "",
    `Time: ${new Date().toISOString()}`,
    `Reason: ${err.message}`,
    "",
    "This should be treated as a loud failure: provider auth, credits, rate limits, feeds, or webhook delivery may need attention.",
  ].join("\n");
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Incident webhook HTTP ${res.status}: ${await res.text()}`);
}

async function postOperationalWarnings(title, warnings, footer) {
  if (!warnings.length) return;
  const webhookUrl = process.env.OPENWEBUI_CHANNEL_WEBHOOK_INCIDENTS_URL;
  if (!webhookUrl) return;
  const content = [
    title,
    "",
    `Time: ${new Date().toISOString()}`,
    "",
    ...warnings.map((warning) => `- ${warning}`),
    "",
    footer,
  ].join("\n");
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Incident webhook HTTP ${res.status}: ${await res.text()}`);
}

run().finally(() => {
  process.exit(process.exitCode ?? 0);
});
