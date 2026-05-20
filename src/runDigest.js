import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./config.js";
import { fetchAllFeeds } from "./feeds.js";
import { filterAndScoreItems } from "./filter.js";
import { summarizeItem } from "./summarize.js";
import { writeHtmlPage } from "./page.js";
import { sendDigestEmail } from "./email.js";
import { sendDigestSms } from "./sms.js";
import { logInfo, logError } from "./logger.js";
import { initializeAI, analyzeArticle, getAIClient } from "./ai.js";
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

    logInfo(`Digest completed for ${slug}`);
  } catch (err) {
    logError("Digest run failed", err);
    process.exitCode = 1;
  }
}

run();
