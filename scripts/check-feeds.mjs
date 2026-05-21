import fs from "node:fs";
import path from "node:path";
import Parser from "rss-parser";
import yaml from "js-yaml";

const configPath =
  process.env.DIGEST_CONFIG_PATH ||
  firstExisting([
    path.join(process.cwd(), "config", "workshop.yaml"),
    path.join(process.cwd(), "config", "config.yaml"),
    path.join(process.cwd(), "config", "workshop.example.yaml"),
    path.join(process.cwd(), "config", "config.example.yaml"),
  ]);

if (!configPath) {
  console.error("No config file found.");
  process.exit(2);
}

const cfg = yaml.load(fs.readFileSync(configPath, "utf8"));
const parser = new Parser({
  headers: {
    "User-Agent": "mc-ai-digest/0.1 feed-health",
  },
});

let failures = 0;
console.log(`Checking feeds from ${configPath}`);

for (const feed of cfg.feeds || []) {
  try {
    const parsed = await parser.parseURL(feed.url);
    const count = parsed.items?.length ?? 0;
    console.log(`OK   ${feed.url} (${count} items)`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${feed.url} (${error.message})`);
  }
}

if (failures > 0) {
  console.error(`${failures} feed${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}

process.exit(0);

function firstExisting(paths) {
  return paths.find((candidate) => fs.existsSync(candidate));
}
