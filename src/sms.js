import twilio from "twilio";
import { dateSlug } from "./page.js";
import { logInfo, logError } from "./logger.js";

export async function sendDigestSms(date, items, cfg, podcastUrl = null, brief = null) {
  if (!cfg.sms?.enabled) {
    logInfo("SMS disabled for ROB, skipping SMS");
    return;
  }

  const sid = cfg.twilio.accountSid;
  const token = cfg.twilio.authToken;

  if (!sid || !token) {
    logInfo("Twilio not configured, skipping SMS");
    return;
  }

  const client = twilio(sid, token);

  const slug = dateSlug(date, cfg.timeZone);
  const base = cfg.output.baseUrl.replace(/\/$/,"");
  const url = `${base}/${slug}`;

  // If podcast is available, use podcast-focused format
  if (podcastUrl) {
    const count = items.length;
    const topItem = items[0];

    // Calculate opportunity score (average of business + technical)
    const opportunityScore = topItem?.businessScore && topItem?.technicalScore
      ? Math.round((topItem.businessScore + topItem.technicalScore) / 2)
      : null;

    const scoreInfo = opportunityScore ? ` [🎯 ${opportunityScore}]` : '';
    const headline = (topItem?.title || "Latest AI news").slice(0, 60) + "…";

    let body = `🎧 Your AI Digest Podcast is ready!\n\n${count} articles · Top${scoreInfo}:\n${headline}\n\n${podcastUrl}`;

    if (body.length > 320) {
      body = body.slice(0, 317) + "…";
    }

    try {
      const msg = await client.messages.create({
        body,
        from: cfg.twilio.fromNumber,
        to: cfg.twilio.toNumber
      });
      logInfo(`SMS sent with podcast link: ${msg.sid}`);
    } catch (err) {
      logError("SMS failure", err);
    }
    return;
  }

  // Original format (fallback when no podcast)
  const count = items.length;
  const topItem = items[0];
  const topHeadline = topItem?.title || "Latest AI news";

  // Include viability score if available
  const scoreInfo = topItem?.viabilityScore > 0
    ? ` [💼 ${topItem.viabilityScore}]`
    : '';

  // Truncate headline if needed to fit in SMS
  const maxHeadlineLength = 90;
  const headline = topHeadline.length > maxHeadlineLength
    ? topHeadline.slice(0, maxHeadlineLength) + "…"
    : topHeadline;

  let body = `Matt's AI Digest (${count} articles)\n\nTop: ${headline}${scoreInfo}\n\n${url}`;

  // SMS limit is 160 chars, but we'll allow up to 320 (2 segments) for readability
  if (body.length > 320) {
    body = body.slice(0,317) + "…";
  }

  try {
    const msg = await client.messages.create({
      body,
      from: cfg.twilio.fromNumber,
      to: cfg.twilio.toNumber
    });
    logInfo(`SMS sent: ${msg.sid}`);
  } catch (err) {
    logError("SMS failure", err);
  }
}
