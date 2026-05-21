import Parser from "rss-parser";
import { logInfo, logError } from "./logger.js";

const parser = new Parser();
let feedWarnings = [];

export async function fetchAllFeeds(feeds) {
  const items = [];
  feedWarnings = [];

  for (const feed of feeds) {
    try {
      logInfo(`Fetching feed ${feed.url}`);
      const parsed = await parser.parseURL(feed.url);

      for (const item of parsed.items || []) {
        items.push({
          title: item.title || "",
          link: item.link || "",
          pubDate: item.pubDate ? new Date(item.pubDate) : null,
          content: item.contentSnippet || item.content || "",
          source: parsed.title || feed.url
        });
      }
    } catch (err) {
      logError(`Feed failed: ${feed.url}`, err);
      feedWarnings.push(`Feed failed: ${feed.url}: ${err.message}`);
    }
  }

  logInfo(`Fetched ${items.length} items`);
  return items;
}

export function consumeFeedWarnings() {
  const warnings = feedWarnings;
  feedWarnings = [];
  return warnings;
}
