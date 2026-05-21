const PROJECT_TAG_RULES = [
  ["mc-aphasia", /\baphasia|speech recovery|language therapy|speech therapy\b/i],
  ["speech-to-text", /\bASR|automatic speech recognition|speech-to-text|transcription|whisper|parakeet\b/i],
  ["voice-ux", /\bvoice UX|voice interface|spoken dialog|speech interaction|conversation\b/i],
  ["rf-signal-analysis", /\bradio frequency|RF sensing|wireless sensing|radar|CSI\b/i],
  ["sentiment-from-signals", /\bsentiment|emotion recognition|affective|non-text signal\b/i],
  ["audio-video", /\baudio|video|multimodal media|signal processing\b/i],
  ["multimodal", /\bmultimodal|vision-language|audio-language|cross-modal\b/i],
  ["agents-hermes", /\bagent|tool use|workflow|orchestration|Hermes\b/i],
  ["inference-infra", /\binference|latency|serving|quantization|distillation|compute infrastructure|datacenter|data center\b/i],
  ["solo-founder-wedge", /\bdeveloper tool|workflow|automation|API|SaaS|prototype\b/i],
];

export function inferProjectTags(item) {
  const haystack = `${item.title || ""}\n${item.summary || ""}\n${item.content || ""}`;
  const tags = PROJECT_TAG_RULES
    .filter(([, pattern]) => pattern.test(haystack))
    .map(([tag]) => tag);

  return [...new Set(tags.length ? tags : ["research-only"])].slice(0, 3);
}

export function normalizeCodeEvidence(item) {
  const explicit = item.code || {};
  const text = `${item.link || ""}\n${item.summary || ""}\n${item.content || ""}`;
  const githubMatch = text.match(/https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/);
  const hfMatch = text.match(/https?:\/\/huggingface\.co\/[A-Za-z0-9_./-]+/);
  const url = explicit.url || githubMatch?.[0] || hfMatch?.[0] || null;

  let status = explicit.status || "none";
  if (!explicit.status && url) {
    status = item.link && item.link.includes(url) ? "attached" : "found";
  }

  return {
    status,
    url,
    license: explicit.license || null,
    recentActivity: Boolean(explicit.recentActivity),
    runnableLikelihood: explicit.runnableLikelihood || (url ? "unknown" : "none"),
  };
}

export function scoreRobCandidate(item) {
  const projectTags = inferProjectTags(item);
  const code = normalizeCodeEvidence(item);
  const projectFitScore = projectTags.includes("research-only")
    ? 25
    : Math.min(100, 45 + projectTags.length * 18);
  const codeScore = code.status === "attached" ? 85 : code.status === "found" ? 70 : 15;
  const relevance = Number(item.relevanceScore || item.score || 0);
  const viability = Number(item.viabilityScore || 35);
  const actionScore = Math.round((relevance * 0.45) + (projectFitScore * 0.35) + (codeScore * 0.20));
  const noveltyScore = Math.max(40, Math.min(90, relevance || 50));
  const marketScore = Math.max(20, Math.min(90, viability));
  const rankScore = Math.round(
    actionScore * 0.35 +
    projectFitScore * 0.25 +
    codeScore * 0.20 +
    noveltyScore * 0.10 +
    marketScore * 0.10
  );

  const scored = {
    ...item,
    projectTags,
    code,
    actionScore,
    projectFitScore,
    codeScore,
    noveltyScore,
    marketScore,
    rankScore,
  };

  return {
    ...scored,
    productAngle: makeProductAngle(scored),
    recommendation: makeRecommendation(scored),
  };
}

export function buildRobBrief(items, date = new Date(), timeZone = "Europe/Malta") {
  const candidates = items
    .map(scoreRobCandidate)
    .sort((a, b) => b.rankScore - a.rankScore);

  return {
    date: dateSlug(date, timeZone),
    generated_at: formatGeneratedAt(date, timeZone),
    top_actions: candidates.filter(item => item.rankScore >= 55).slice(0, 3),
    watchlist: candidates.filter(item => item.rankScore < 55).slice(0, 5),
    market_drift: deriveMarketDrift(candidates),
    sources_checked: [...new Set(items.map(item => item.source).filter(Boolean))],
    generation_notes: [],
  };
}

function makeProductAngle(item) {
  if (item.projectTags.includes("mc-aphasia")) {
    return "Possible speech recovery or aphasia assessment prototype.";
  }
  if (item.projectTags.includes("rf-signal-analysis")) {
    return "Possible Kenneth/RF signal intelligence building block.";
  }
  if (item.projectTags.includes("speech-to-text")) {
    return "Possible STT benchmark, workflow, or voice product leverage.";
  }
  if (item.projectTags.includes("agents-hermes")) {
    return "Possible Hermes or agent workflow leverage.";
  }
  if (item.code.url) {
    return "Open implementation may be reusable in a prototype or internal tool.";
  }
  return "Research signal worth watching for a stronger product wedge.";
}

function makeRecommendation(item) {
  if (item.code.url && item.rankScore >= 70) {
    return `Clone/test ${item.code.url} and compare it against the relevant project baseline.`;
  }
  if (item.projectTags.includes("mc-aphasia")) {
    return "Save for MC Aphasia and inspect whether the method can support a prototype.";
  }
  if (item.projectTags.includes("rf-signal-analysis")) {
    return "Track for Kenneth/RF sentiment and watch for code or dataset release.";
  }
  if (item.rankScore >= 55) {
    return "Investigate and decide whether this should become a project note or Linear ticket.";
  }
  return "Watch only; not an immediate action.";
}

function deriveMarketDrift(candidates) {
  const counts = new Map();
  for (const tag of candidates.flatMap(item => item.projectTags || [])) {
    if (tag === "research-only") continue;
    counts.set(tag, (counts.get(tag) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([tag, count]) => `${tag}: ${count} signal${count === 1 ? "" : "s"} in today's research/news flow.`);
}

function dateSlug(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatGeneratedAt(date, timeZone) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}
