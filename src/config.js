import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

export function loadConfig() {
  const configPath =
    process.env.DIGEST_CONFIG_PATH ||
    path.join(process.cwd(), "config", "config.yaml");

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file missing: ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, "utf8");
  const cfg = yaml.load(raw);

  cfg.smtp.user = process.env.SMTP_USER || cfg.smtp.user;
  cfg.smtp.pass = process.env.SMTP_PASS || cfg.smtp.pass;
  cfg.twilio.accountSid =
    process.env.TWILIO_ACCOUNT_SID || cfg.twilio.accountSid;
  cfg.twilio.authToken =
    process.env.TWILIO_AUTH_TOKEN || cfg.twilio.authToken;

  // Secrets come from env; non-secret AI routing lives in the config file.
  if (cfg.ai) {
    if (cfg.ai.provider === "openrouter") {
      cfg.ai.apiKey = process.env.OPENROUTER_API_KEY || cfg.ai.apiKey;
    } else if (
      cfg.ai.provider === "openai" ||
      cfg.ai.provider === "openai-compatible"
    ) {
      cfg.ai.apiKey = process.env.OPENAI_API_KEY || cfg.ai.apiKey;
    }
  }

  return cfg;
}
