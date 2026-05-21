export function renderRobEmailHtml(brief) {
  const top = brief.top_actions.map(renderEmailItem).join("");
  const watch = brief.watchlist.length
    ? `<h2 style="font-size:16px;margin-top:20px;">Watchlist</h2>${brief.watchlist.map(renderEmailItem).join("")}`
    : "";
  const drift = brief.market_drift.length
    ? `<h2 style="font-size:16px;margin-top:20px;">Market Drift</h2><ul>${brief.market_drift.map(line => `<li>${esc(line)}</li>`).join("")}</ul>`
    : "";

  return `<!doctype html>
<html>
<body style="background:#0b0c10;padding:20px;">
  <table width="600" align="center" style="background:#11141a;padding:20px;border-radius:12px;color:#e5e5e5;font-family:system-ui;">
    <tr><td style="font-weight:bold;font-size:18px;padding-bottom:10px;">The ROB Report - ${esc(brief.date)}</td></tr>
    <tr><td style="color:#888;font-size:12px;padding-bottom:12px;">Generated ${esc(brief.generated_at || brief.date)}</td></tr>
    <tr><td><h2 style="font-size:16px;margin-top:0;">Top Actions</h2>${top || "<p>No strong action candidates today.</p>"}${watch}${drift}</td></tr>
  </table>
</body>
</html>`;
}

export function renderRobText(brief) {
  const lines = [
    `The ROB Report - ${brief.generated_at || brief.date}`,
    "",
    "Top Actions",
    "",
  ];

  if (!brief.top_actions.length) {
    lines.push("No strong action candidates today.", "");
  }

  brief.top_actions.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.title}`);
    lines.push(`Source: ${formatSource(item)}`);
    lines.push(`Why now: ${item.summary || "No summary available."}`);
    lines.push(`Mattie fit: ${(item.projectTags || []).join(", ") || "research-only"}`);
    lines.push(`Code status: ${formatCode(item.code)}`);
    lines.push(`Product angle: ${item.productAngle || item.recommendation || "Investigate for leverage."}`);
    lines.push(`Next move: ${item.recommendation || "Inspect manually."}`, "");
  });

  if (brief.watchlist.length) {
    lines.push("Watchlist", "");
    brief.watchlist.slice(0, 5).forEach(item => {
      lines.push(`- ${item.title}: ${formatSource(item)}`);
    });
    lines.push("");
  }

  if (brief.market_drift.length) {
    lines.push("Market Drift", "");
    brief.market_drift.forEach(line => lines.push(`- ${line}`));
  }

  return lines.join("\n").slice(0, 3900);
}

function renderEmailItem(item) {
  return `<article style="padding:12px 0;border-bottom:1px solid #333;">
    <h3 style="font-size:15px;margin:0 0 6px;"><a href="${esc(item.link)}" style="color:#4ea8ff;">${esc(item.title)}</a></h3>
    <p style="color:#888;font-size:12px;margin:0 0 8px;">${esc(item.source || "")} · score ${esc(String(item.rankScore || "n/a"))} · ${esc(item.link || "")}</p>
    <p style="margin:0 0 8px;">${esc(item.summary || "")}</p>
    <p style="margin:0 0 6px;"><strong>Mattie fit:</strong> ${esc((item.projectTags || []).join(", ") || "research-only")}</p>
    <p style="margin:0 0 6px;"><strong>Code:</strong> ${esc(formatCode(item.code))}</p>
    <p style="margin:0;"><strong>Next move:</strong> ${esc(item.recommendation || "Inspect manually.")}</p>
  </article>`;
}

function formatCode(code = {}) {
  const base = code.status || "none";
  const license = code.license ? `, ${code.license}` : "";
  const url = code.url ? `, ${code.url}` : "";
  return `${base}${license}${url}`;
}

function formatSource(item = {}) {
  const source = item.source ? `${item.source} - ` : "";
  return `${source}${item.link || "no link"}`;
}

function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
