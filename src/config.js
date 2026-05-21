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

  // AI configuration - env vars override YAML so Workshop routing lives in Infisical.
  if (cfg.ai) {
    cfg.ai.provider = process.env.ROB_AI_PROVIDER || cfg.ai.provider;
    cfg.ai.model = process.env.ROB_AI_MODEL || cfg.ai.model;
    cfg.ai.baseUrl = process.env.ROB_AI_BASE_URL || cfg.ai.baseUrl;
    cfg.ai.fallbackModels = parseListEnv(
      process.env.ROB_AI_FALLBACK_MODELS,
      cfg.ai.fallbackModels
    );
    cfg.ai.timeoutMs = parseIntEnv(process.env.ROB_AI_TIMEOUT_MS, cfg.ai.timeoutMs);
    cfg.ai.preflight = parseBoolEnv(process.env.ROB_AI_PREFLIGHT, cfg.ai.preflight);

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

function parseListEnv(value, fallback) {
  if (!value) return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseIntEnv(value, fallback) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolEnv(value, fallback) {
  if (value == null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(value);
}
