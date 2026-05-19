import { test, expect } from "@playwright/test";
import { sendRobTelegram } from "../src/telegram.js";

test("sendRobTelegram skips cleanly when credentials are missing", async () => {
  const oldToken = process.env.TELEGRAM_BOT_TOKEN;
  const oldChat = process.env.TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;

  let called = false;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    called = true;
    return { ok: true };
  };

  await sendRobTelegram({
    date: "2026-05-19",
    top_actions: [],
    watchlist: [],
    market_drift: [],
  });

  globalThis.fetch = oldFetch;
  if (oldToken) process.env.TELEGRAM_BOT_TOKEN = oldToken;
  if (oldChat) process.env.TELEGRAM_CHAT_ID = oldChat;

  expect(called).toBe(false);
});

test("sendRobTelegram posts ROB text when credentials are present", async () => {
  const oldToken = process.env.TELEGRAM_BOT_TOKEN;
  const oldChat = process.env.TELEGRAM_CHAT_ID;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CHAT_ID = "test-chat";

  let payload = null;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    payload = { url, options };
    return { ok: true, text: async () => "ok" };
  };

  await sendRobTelegram({
    date: "2026-05-19",
    top_actions: [],
    watchlist: [],
    market_drift: [],
  });

  globalThis.fetch = oldFetch;
  if (oldToken) process.env.TELEGRAM_BOT_TOKEN = oldToken;
  else delete process.env.TELEGRAM_BOT_TOKEN;
  if (oldChat) process.env.TELEGRAM_CHAT_ID = oldChat;
  else delete process.env.TELEGRAM_CHAT_ID;

  expect(payload.url).toContain("https://api.telegram.org/bottest-token/sendMessage");
  const body = JSON.parse(payload.options.body);
  expect(body.chat_id).toBe("test-chat");
  expect(body.text).toContain("ROB - 2026-05-19");
  expect(body.disable_web_page_preview).toBe(true);
});
