import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Automated accessibility scan.
 *
 * The Win95 palette is the risk this exists to police: grey text on a grey face
 * is exactly the kind of thing that looks fine to a designer and fails contrast
 * outright. Claims about contrast should be measured, not eyeballed.
 *
 * Scoped to WCAG 2.1 A and AA. Automated tooling catches perhaps a third of
 * real accessibility problems, so a green run here is a floor rather than a
 * certificate.
 */

const PAGES = [
  "/",
  "/tools/compress",
  "/tools/passport",
  "/tools/crop",
  "/tools/pdf-merge",
  "/tools/pdf-split",
  "/tools/images-to-pdf",
  "/tools/upscale",
  "/tools/format",
  "/tools/office-to-pdf",
  "/privacy",
  "/offline",
  "/login",
];

for (const path of PAGES) {
  test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    // Report the rule and the offending markup, so a failure is actionable
    // without re-running locally.
    const summary = results.violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.html.slice(0, 120)),
    }));

    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });
}
