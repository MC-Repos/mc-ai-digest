import { test, expect } from "@playwright/test";
import { formatIncidentTime } from "../src/time.js";

test("formats incident timestamps in Malta time", () => {
  const formatted = formatIncidentTime(new Date("2026-05-21T01:35:40Z"));

  expect(formatted).toContain("Europe/Malta");
  expect(formatted).toContain("21/05/2026");
  expect(formatted).toContain("03:35:40");
});
