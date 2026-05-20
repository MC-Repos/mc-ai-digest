import nodemailer from "nodemailer";
import { dateSlug } from "./page.js";
import { logInfo, logError } from "./logger.js";
import { renderRobEmailHtml } from "./robRenderers.js";

export async function sendDigestEmail(date, items, cfg, brief = null) {
  if (cfg.email?.enabled === false) {
    logInfo("Email disabled, skipping digest email");
    return;
  }

  const slug = dateSlug(date, cfg.timeZone);
  const subject = brief
    ? `The ROB Report - ${brief.date}: ${brief.top_actions.length || "no"} things worth your attention`
    : `AI Daily Digest – ${slug}`;

  const tx = nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.secure || false,
    auth: { user: cfg.smtp.user, pass: cfg.smtp.pass }
  });

  const html = brief ? renderRobEmailHtml(brief) : buildHtml(date, items, cfg);

  try {
    const info = await tx.sendMail({
      from: cfg.email.from,
      to: cfg.email.to,
      subject,
      html
    });
    logInfo(`Email sent: ${info.messageId}`);
  } catch (err) {
    logError("Email failure", err);
  }
}

function buildHtml(date, items, cfg) {
  const slug = dateSlug(date, cfg.timeZone);
  const base = cfg.output.baseUrl.replace(/\/$/, "");
  const url = `${base}/${slug}`;

  const rows = items
    .map(
      i => {
        const viabilityBadge = i.viabilityScore > 0
          ? `<span style="display:inline-block;background:${getScoreColor(i.viabilityScore)};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;margin-right:6px;">💼 ${i.viabilityScore}</span>`
          : '';
        const relevanceBadge = i.relevanceScore > 0
          ? `<span style="display:inline-block;background:${getScoreColor(i.relevanceScore)};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">⚡ ${i.relevanceScore}</span>`
          : '';
        const badges = viabilityBadge || relevanceBadge
          ? `<div style="margin-top:8px;margin-bottom:4px;">${viabilityBadge}${relevanceBadge}</div>`
          : '';

        return `
<tr>
  <td style="padding:12px 0;border-bottom:1px solid #333;">
    <div><a href="${i.link}" style="color:#4ea8ff;">${esc(i.title)}</a></div>
    <div style="color:#888;font-size:12px;">
      ${esc(i.source || "")}
      ${i.pubDate ? " · " + i.pubDate.toISOString().slice(0,10) : ""}
    </div>
    ${badges}
    <div style="font-size:14px;margin-top:4px;">${esc(i.summary)}</div>
  </td>
</tr>`;
      }
    )
    .join("\n");

  return `
<!doctype html>
<html>
<body style="background:#0b0c10;padding:20px;">
  <table width="600" align="center" style="background:#11141a;padding:20px;border-radius:12px;color:#e5e5e5;font-family:system-ui;">
    <tr><td style="font-weight:bold;font-size:18px;padding-bottom:10px;">AI Daily Digest – ${slug}</td></tr>
    ${rows}
    <tr><td style="color:#777;font-size:12px;padding-top:16px;">View online: <a href="${url}" style="color:#4ea8ff;">${url}</a></td></tr>
  </table>
</body>
</html>`;
}

function getScoreColor(score) {
  if (score >= 80) return '#10b981'; // green
  if (score >= 60) return '#3b82f6'; // blue
  if (score >= 40) return '#f59e0b'; // orange
  return '#6b7280'; // gray
}

function esc(s = "") {
  return s
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}
