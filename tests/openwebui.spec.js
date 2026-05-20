import { test, expect } from "@playwright/test";
import { sendRobOpenWebUI } from "../src/openwebui.js";

test("sendRobOpenWebUI skips cleanly when webhook is missing", async () => {
  const oldWebhook = process.env.OPENWEBUI_ROB_WEBHOOK_URL;
  const oldChannelWebhook = process.env.OPENWEBUI_CHANNEL_WEBHOOK_ROB_URL;
  delete process.env.OPENWEBUI_ROB_WEBHOOK_URL;
  delete process.env.OPENWEBUI_CHANNEL_WEBHOOK_ROB_URL;

  let called = false;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    called = true;
    return { ok: true };
  };

  await sendRobOpenWebUI({
    date: "2026-05-19",
    top_actions: [],
    watchlist: [],
    market_drift: [],
  });

  globalThis.fetch = oldFetch;
  if (oldWebhook) process.env.OPENWEBUI_ROB_WEBHOOK_URL = oldWebhook;
  if (oldChannelWebhook) process.env.OPENWEBUI_CHANNEL_WEBHOOK_ROB_URL = oldChannelWebhook;

  expect(called).toBe(false);
});

test("sendRobOpenWebUI posts ROB text to the configured webhook", async () => {
  const oldWebhook = process.env.OPENWEBUI_ROB_WEBHOOK_URL;
  const oldChannelWebhook = process.env.OPENWEBUI_CHANNEL_WEBHOOK_ROB_URL;
  process.env.OPENWEBUI_ROB_WEBHOOK_URL = "https://openwebui.example/channels/webhooks/id/token";
  delete process.env.OPENWEBUI_CHANNEL_WEBHOOK_ROB_URL;

  let payload = null;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    payload = { url, options };
    return { ok: true, text: async () => "ok" };
  };

  await sendRobOpenWebUI({
    date: "2026-05-19",
    top_actions: [],
    watchlist: [],
    market_drift: [],
  });

  globalThis.fetch = oldFetch;
  if (oldWebhook) process.env.OPENWEBUI_ROB_WEBHOOK_URL = oldWebhook;
  else delete process.env.OPENWEBUI_ROB_WEBHOOK_URL;
  if (oldChannelWebhook) process.env.OPENWEBUI_CHANNEL_WEBHOOK_ROB_URL = oldChannelWebhook;
  else delete process.env.OPENWEBUI_CHANNEL_WEBHOOK_ROB_URL;

  expect(payload.url).toBe("https://openwebui.example/channels/webhooks/id/token");
  const body = JSON.parse(payload.options.body);
  expect(body.content).toContain("The ROB Report - 2026-05-19");
});
