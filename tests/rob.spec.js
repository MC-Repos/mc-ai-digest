import { test, expect } from "@playwright/test";
import { buildRobBrief, inferProjectTags, scoreRobCandidate } from "../src/rob.js";
import { renderRobEmailHtml, renderRobText } from "../src/robRenderers.js";

test("inferProjectTags maps speech and aphasia items to active project tags", () => {
  const tags = inferProjectTags({
    title: "Aphasia speech recovery with on-device ASR",
    summary: "A speech-to-text system for aphasia therapy and voice recovery.",
    link: "https://example.com/paper",
  });

  expect(tags).toContain("mc-aphasia");
  expect(tags).toContain("speech-to-text");
});

test("scoreRobCandidate prioritizes actionable project leverage over generic business value", () => {
  const candidate = scoreRobCandidate({
    title: "Open-source RF sentiment model",
    summary: "A radio frequency sensing model with GitHub code for non-text sentiment inference.",
    link: "https://example.com/paper",
    viabilityScore: 55,
    relevanceScore: 90,
    code: {
      status: "found",
      url: "https://github.com/example/rf-sentiment",
      license: "MIT",
      recentActivity: true,
    },
  });

  expect(candidate.projectTags).toContain("rf-signal-analysis");
  expect(candidate.projectTags).toContain("sentiment-from-signals");
  expect(candidate.rankScore).toBeGreaterThan(70);
  expect(candidate.recommendation).toMatch(/clone|test|investigate/i);
});

test("buildRobBrief returns top actions before watchlist items", () => {
  const brief = buildRobBrief([
    {
      title: "Generic AI funding news",
      summary: "A company raised money.",
      link: "https://example.com/news",
      viabilityScore: 70,
      relevanceScore: 20,
    },
    {
      title: "Speech recovery model with GitHub code",
      summary: "A paper releases code for aphasia speech recovery evaluation.",
      link: "https://example.com/paper",
      viabilityScore: 40,
      relevanceScore: 95,
      code: { status: "attached", url: "https://github.com/example/speech-recovery", license: "Apache-2.0" },
    },
  ], new Date("2026-05-19T06:00:00Z"));

  expect(brief.top_actions[0].title).toMatch(/Speech recovery/);
  expect(brief.generated_at).toContain("19/05/2026");
  expect(brief.generated_at).toContain("08:00");
  expect(brief.watchlist.map(item => item.title)).toContain("Generic AI funding news");
});

test("renderRobEmailHtml has no website footer", () => {
  const brief = {
    date: "2026-05-19",
    top_actions: [{
      title: "Speech recovery model with code",
      link: "https://example.com/paper",
      summary: "A useful aphasia/STT research item.",
      source: "arXiv",
      projectTags: ["mc-aphasia", "speech-to-text"],
      code: { status: "attached", url: "https://github.com/example/repo", license: "MIT" },
      rankScore: 88,
      recommendation: "Clone/test https://github.com/example/repo and compare it against the relevant project baseline.",
    }],
    watchlist: [],
    market_drift: ["speech-to-text: 2 signals in today's research/news flow."],
  };

  const html = renderRobEmailHtml(brief);
  expect(html).toContain("The ROB Report - 2026-05-19");
  expect(html).toContain("Top Actions");
  expect(html).toContain("Code:</strong> attached");
  expect(html).not.toMatch(/View online/i);
  expect(html).not.toMatch(/mattcarpenter\.com\/news/i);
});

test("renderRobText is Hermes and Telegram friendly", () => {
  const brief = buildRobBrief([
    {
      title: "RF sensing paper with code",
      summary: "A radio frequency sensing paper for non-text sentiment detection.",
      link: "https://example.com/paper",
      relevanceScore: 95,
      viabilityScore: 60,
      code: { status: "attached", url: "https://github.com/example/rf", license: "MIT" },
    },
  ], new Date("2026-05-19T06:00:00Z"));

  const text = renderRobText(brief);
  expect(text).toContain("The ROB Report - 19/05/2026");
  expect(text).toContain("08:00");
  expect(text).toContain("Source: https://example.com/paper");
  expect(text).toContain("Next move:");
  expect(text.length).toBeLessThan(3900);
});
