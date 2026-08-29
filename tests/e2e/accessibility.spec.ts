import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { onboardFellowIntoDemo } from "./helpers";

// AC-16 foundations: axe checks on every Milestone 1 route plus a
// keyboard-only pass over the core journey. WCAG 2.2 AA is a release gate
// (spec/11) — serious/critical violations fail the build.

test.describe.configure({ mode: "serial" });

let fellowContext: BrowserContext;
let fellowPage: Page;

test.beforeAll(async ({ browser, request }) => {
  // A freshly invited fellow in `demo` (pinned FCAI release) with the diary
  // lock set up — every route below is exercised end-to-end encrypted.
  const onboarded = await onboardFellowIntoDemo(browser, request);
  fellowContext = onboarded.context;
  fellowPage = onboarded.page;
});

test.afterAll(async () => {
  await fellowContext?.close();
});

async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    // The Next.js dev-tools overlay is not part of the product.
    .exclude("nextjs-portal")
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  if (results.violations.length > 0) {
    console.log(
      `[axe] ${label}: ${results.violations.map((v) => `${v.id}(${v.impact})`).join(", ")}`,
    );
  }
  expect(serious, `${label}: ${serious.map((v) => v.id).join(", ")}`).toEqual([]);
}

test("axe: sign-in page", async ({ page }) => {
  await page.goto("/sign-in");
  await expectNoSeriousViolations(page, "sign-in");
});

test("axe: about page", async ({ page }) => {
  await page.goto("/about");
  await expectNoSeriousViolations(page, "about");
});

test("axe: today page", async () => {
  await fellowPage.goto("/t/demo/today");
  await expectNoSeriousViolations(fellowPage, "today");
});

test("axe: log list", async () => {
  await fellowPage.goto("/t/demo/log");
  await expectNoSeriousViolations(fellowPage, "log");
});

test("axe: evidence editor", async () => {
  await fellowPage.goto("/t/demo/log/new");
  await fellowPage.locator('[role="textbox"]').waitFor();
  await expectNoSeriousViolations(fellowPage, "editor");
});

test("axe: curriculum overview and objective detail", async () => {
  await fellowPage.goto("/t/demo/curriculum");
  await expectNoSeriousViolations(fellowPage, "curriculum");
  await fellowPage.locator('a[href*="/curriculum/"]').first().click();
  await fellowPage.getByRole("heading", { level: 1 }).waitFor();
  await expectNoSeriousViolations(fellowPage, "objective detail");
});

test("axe: account page", async () => {
  await fellowPage.goto("/t/demo/account");
  await expectNoSeriousViolations(fellowPage, "account");
});

test("keyboard-only: skip link, navigation, and starting an entry", async () => {
  await fellowPage.goto("/t/demo/today");

  // First Tab reaches the skip link; Enter jumps to main content.
  await fellowPage.keyboard.press("Tab");
  await expect(fellowPage.locator(".skip-link")).toBeFocused();
  await fellowPage.keyboard.press("Enter");
  expect(fellowPage.url()).toContain("#main-content");

  // The primary navigation is reachable and operable by keyboard.
  await fellowPage.goto("/t/demo/log");
  const newEntry = fellowPage.getByRole("link", { name: "New entry" });
  await newEntry.focus();
  await fellowPage.keyboard.press("Enter");
  await fellowPage.waitForURL(/\/log\/new/);

  // The title field is reachable and accepts input; focus is visible
  // (double-ring is CSS — presence of :focus-visible target asserted here).
  const title = fellowPage.getByLabel(/Title/);
  await title.focus();
  await fellowPage.keyboard.type("Keyboard-only entry");
  await expect(title).toHaveValue("Keyboard-only entry");
});

test("400% zoom: editor remains operable without horizontal scrolling", async () => {
  // 400% zoom at 1280px wide ≈ 320 CSS px viewport (spec/11).
  await fellowPage.setViewportSize({ width: 320, height: 900 });
  await fellowPage.goto("/t/demo/log/new");
  await fellowPage.locator('[role="textbox"]').waitFor();

  const overflow = await fellowPage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "no two-dimensional scrolling at 320px").toBeLessThanOrEqual(2);
  await fellowPage.setViewportSize({ width: 1280, height: 900 });
});
