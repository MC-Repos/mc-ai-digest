import { logInfo, logError } from "./logger.js";
import { renderRobText } from "./robRenderers.js";

export async function sendRobTelegram(brief, cfg = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN || cfg.telegram?.botToken;
  const chatId = process.env.TELEGRAM_CHAT_ID || cfg.telegram?.chatId;

  if (!token || !chatId) {
    logInfo("Telegram not configured, skipping ROB Telegram delivery");
    return;
  }

  const text = renderRobText(brief);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`Telegram ${res.status}: ${await res.text()}`);
    }

    logInfo("ROB Telegram message sent");
  } catch (err) {
    logError("ROB Telegram delivery failed", err);
  }
}
