import { logInfo, logError } from "./logger.js";
import { renderRobText } from "./robRenderers.js";

export async function sendRobOpenWebUI(brief, cfg = {}) {
  const webhookUrl =
    process.env.OPENWEBUI_ROB_WEBHOOK_URL ||
    process.env.OPENWEBUI_CHANNEL_WEBHOOK_ROB_URL ||
    cfg.openWebUI?.robWebhookUrl;

  if (!webhookUrl) {
    logInfo("Open WebUI ROB webhook not configured, skipping ROB cockpit delivery");
    return;
  }

  const content = renderRobText(brief);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      throw new Error(`Open WebUI ${res.status}: ${await res.text()}`);
    }

    logInfo("ROB Open WebUI message sent");
  } catch (err) {
    logError("ROB Open WebUI delivery failed", err);
  }
}
