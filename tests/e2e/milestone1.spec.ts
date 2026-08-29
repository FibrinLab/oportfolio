import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { ensureDiaryUnlocked, latestEmailLink, signInViaMagicLink, uniqueSuffix } from "./helpers";

// Private-diary definition-of-done journey: onboarding and pinned curriculum,
// owner-only entries, mappings, conflict recovery, links, portable export and
// the finish/reopen lifecycle. Serial: later steps use earlier state.

test.describe.configure({ mode: "serial" });

const suffix = uniqueSuffix();
const fellowEmail = `e2e-fellow-${suffix}@example.org`;
const fellowName = `E2E Fellow ${suffix}`;
const CANARY = `E2E-PRIVATE-CANARY-${suffix}`;

let fellowContext: BrowserContext;
let fellowPage: Page;
let evidenceUrl: string;

test.afterAll(async () => {
  await fellowContext?.close();
});

test("AC-01: faculty invites; fellow onboards and sees the pinned curriculum", async ({
  browser,
  request,
}) => {
  // Faculty sends the invitation through the People page.
  const facultyContext = await browser.newContext();
  const facultyPage = await signInViaMagicLink(facultyContext, request, "frankie.faculty@example.org");
  await facultyPage.goto("/t/demo/faculty/people");
  await facultyPage.getByLabel("Email address (Required)").fill(fellowEmail);
  await facultyPage.getByLabel("Name (Required)").fill(fellowName);
  await facultyPage.getByRole("button", { name: "Send invitation" }).click();
  await expect(facultyPage.getByRole("status")).toContainText("Invitation sent");
  await facultyContext.close();

  // The fellow accepts from the emailed link.
  const inviteLink = await latestEmailLink(
    request,
    fellowEmail,
    /https?:\/\/localhost:\d+\/invite\/[\w-]+/,
  );
  fellowContext = await browser.newContext();
  fellowPage = await fellowContext.newPage();
  await fellowPage.goto(inviteLink);
  await expect(fellowPage.getByRole("heading", { name: "Welcome to oPortfolio" })).toBeVisible();
  await expect(fellowPage.getByText(/visible only to you/i)).toBeVisible();

  await fellowPage.getByLabel(/Preferred name/).fill(fellowName);
  for (const label of [
    /privacy notice/i,
    /programme learning records only/i,
    /must not contain patient-identifiable data/i,
  ]) {
    await fellowPage.getByRole("checkbox", { name: label }).check();
  }
  await fellowPage.getByRole("button", { name: "Accept invitation and continue" }).click();
  await fellowPage.waitForURL(/\/t\/demo\/today/);
  await fellowPage.goto("/t/demo/log");
  await ensureDiaryUnlocked(fellowPage);
  await fellowPage.goto("/t/demo/today");

  // The private diary space, then the pinned curriculum version.
  await expect(fellowPage.getByRole("heading", { name: "Your private log" })).toBeVisible();
  await expect(fellowPage.getByText(/Only you can read your entries/)).toBeVisible();

  // Exactly 5 domains / 30 objectives from the pinned release.
  await fellowPage.goto("/t/demo/curriculum");
  await expect(fellowPage.getByText(/version 3\.2/)).toBeVisible();
  await expect(fellowPage.getByText("5 domains, 30 objectives")).toBeVisible();
  await expect(fellowPage.getByText("mapped evidence, not competence")).toBeVisible();
  const objectiveLinks = fellowPage.locator('a[href*="/curriculum/"]');
  await expect(objectiveLinks).toHaveCount(30);
});

test("AC-01: another tenant's URLs return not-found", async () => {
  const probe = await fellowPage.request.get("/t/another-tenant/today");
  expect(probe.status()).toBe(404);
});

test("AC-02: a reflection starts private with safety guidance", async () => {
  await fellowPage.goto("/t/demo/log/new");
  await fellowPage.getByLabel(/Title/).fill(`${CANARY} reflection`);
  await fellowPage.getByLabel(/Entry type/).selectOption({ label: "Reflection" });

  // Safety panel + first-save acknowledgement (FR-EV-008).
  await expect(fellowPage.getByText(/not a clinical record/)).toBeVisible();
  await fellowPage
    .getByRole("checkbox", { name: /removed identifiable patient and third-party details/ })
    .check();

  await fellowPage.locator('[role="textbox"]').click();
  await fellowPage
    .locator('[role="textbox"]')
    .fill(`Private narrative ${CANARY}. What I learned about model validation this week.`);

  await fellowPage.getByRole("button", { name: "Save draft" }).click();
  await expect(fellowPage.getByText(/Saved \d/)).toBeVisible();
  await fellowPage.waitForURL(/\/t\/demo\/log\/[0-9a-f-]+$/);
  evidenceUrl = fellowPage.url();

  await expect(fellowPage.getByText("[PRIVATE DIARY]")).toBeVisible();
  await expect(fellowPage.getByText(/visible only to you/i)).toBeVisible();
});

test("AC-02: staff cannot discover or read the private reflection", async ({
  browser,
  request,
}) => {
  const supervisorContext = await browser.newContext();
  const supervisorPage = await signInViaMagicLink(
    supervisorContext,
    request,
    "sam.supervisor@example.org",
  );

  // There is no diary-list surface for staff. Direct page and API probing
  // both return the uniform not-found without the canary.
  const formerList = await supervisorPage.request.get("/t/demo/supervisor/fellows");
  expect(formerList.status()).toBe(404);
  const directPage = await supervisorPage.request.get(evidenceUrl);
  expect(directPage.status()).toBe(404);
  expect(await directPage.text()).not.toContain(CANARY);
  const evidenceId = evidenceUrl.split("/").pop();
  const directApi = await supervisorPage.request.get(`/api/v1/diary-entries/${evidenceId}`, {
    headers: { "x-tenant": "demo" },
  });
  expect(directApi.status()).toBe(404);
  expect(await directApi.text()).not.toContain(CANARY);

  await supervisorContext.close();
});

test("AC-03: map objectives; coverage counts the item without competence claims", async () => {
  await fellowPage.goto(evidenceUrl);

  // Map two objectives through the combobox.
  const combo = fellowPage.getByRole("combobox", { name: /Curriculum objectives/ });
  const listboxOption = fellowPage.getByRole("listbox").getByRole("option");
  await combo.fill("AF-01");
  await listboxOption.first().click();
  await combo.fill("AF-02");
  await listboxOption.first().click();
  await expect(fellowPage.getByRole("button", { name: "Remove AF-01" })).toBeVisible();
  await expect(fellowPage.getByRole("button", { name: "Remove AF-02" })).toBeVisible();

  // Wait until the mappings are persisted server-side before navigating —
  // navigation would abort in-flight PUTs at automation speed.
  const evidenceId = evidenceUrl.split("/").pop();
  await expect
    .poll(async () => {
      const response = await fellowPage.request.get(`/api/v1/diary-entries/${evidenceId}`, {
        headers: { "x-tenant": "demo" },
      });
      const item = (await response.json()) as { objectiveIds?: string[] };
      return item.objectiveIds?.length ?? 0;
    })
    .toBe(2);

  // Coverage on the curriculum view counts it, labelled as evidence only.
  await fellowPage.goto("/t/demo/curriculum");
  await expect(fellowPage.getByText(/Coverage: [12] of 30 objectives/)).toBeVisible();

  // Drill-down shows the item on the objective page.
  await fellowPage.getByRole("link", { name: /AF-01/ }).click();
  await expect(fellowPage.getByText(`${CANARY} reflection`)).toBeVisible();
  await expect(fellowPage.getByText("not proof of competence")).toBeVisible();
});

test("AC-04: concurrent saves surface the conflict; no silent overwrite", async () => {
  const tabA = fellowPage;
  const tabB = await fellowContext.newPage();
  await tabA.goto(evidenceUrl);
  await tabB.goto(evidenceUrl);

  await tabA.getByLabel(/Title/).fill(`${CANARY} tab A wording`);
  await tabA.getByRole("button", { name: "Save draft" }).click();
  await expect(tabA.getByText(/Saved \d/)).toBeVisible();

  await tabB.getByLabel(/Title/).fill(`${CANARY} tab B wording`);
  await tabB.getByRole("button", { name: "Save draft" }).click();

  // Tab B must see the conflict panel, not a silent overwrite.
  await expect(tabB.getByText("This item was saved elsewhere")).toBeVisible();
  await expect(tabB.getByRole("button", { name: "Keep my version" })).toBeVisible();
  await expect(tabB.getByRole("button", { name: "Use the newer version" })).toBeVisible();

  // Both bodies are recoverable: the losing words landed in revision history.
  const revisions = await tabB.request.get(
    `/api/v1/diary-entries/${evidenceUrl.split("/").pop()}/revisions`,
    { headers: { "x-tenant": "demo" } },
  );
  const body = (await revisions.json()) as { revisions: Array<{ changeReason: string }> };
  expect(body.revisions.some((r) => r.changeReason === "conflict_backup")).toBe(true);

  // Keep tab B's words: retry lands cleanly.
  await tabB.getByRole("button", { name: "Keep my version" }).click();
  await expect(tabB.getByText(/Saved \d/)).toBeVisible();
  await tabB.close();
});

test("AC-05: attach an HTTPS link with visible destination host", async () => {
  await fellowPage.goto(evidenceUrl);
  await fellowPage.getByLabel(/Link address/).fill("https://github.com/example/clinical-ai-notes");
  await expect(fellowPage.getByText("Destination: github.com")).toBeVisible();
  await fellowPage.getByLabel(/^Label$/).fill("Project notes repo");
  await fellowPage.getByRole("button", { name: "Add link" }).click();
  await expect(fellowPage.getByRole("link", { name: /Project notes repo/ })).toBeVisible();
});

test("The fellow can archive an entry without exposing or deleting it", async () => {
  await fellowPage.goto(evidenceUrl);
  await fellowPage.getByRole("button", { name: "Archive entry" }).click();
  await expect(fellowPage.getByText("[ARCHIVED]")).toBeVisible();
  await expect(fellowPage.getByRole("button", { name: "Restore entry" })).toBeVisible();
});

test("The fellow builds a complete ZIP in the browser, finishes read-only, then reopens", async () => {
  await fellowPage.goto("/t/demo/diary-export");
  await ensureDiaryUnlocked(fellowPage);
  // ADR-007: the archive is decrypted and assembled client-side; the
  // server only ever hands over ciphertext.
  await fellowPage.getByRole("button", { name: "Build my export" }).click();
  await expect(fellowPage.getByText("[EXPORT READY]")).toBeVisible({ timeout: 60_000 });

  const [download] = await Promise.all([
    fellowPage.waitForEvent("download"),
    fellowPage.getByRole("link", { name: "Download ZIP" }).click(),
  ]);
  const { readFileSync } = await import("node:fs");
  const zipBytes = readFileSync((await download.path())!);
  expect(zipBytes.subarray(0, 2).toString("ascii")).toBe("PK");
  expect(zipBytes.length).toBeGreaterThan(1000);

  await fellowPage.getByLabel(/Type FINISH MY DIARY/).fill("FINISH MY DIARY");
  await fellowPage.getByRole("checkbox", { name: /downloaded my export/i }).check();
  await fellowPage.getByRole("button", { name: "Finish my diary" }).click();
  await expect(fellowPage.getByRole("heading", { name: "Diary finished" })).toBeVisible();

  await fellowPage.goto("/t/demo/log");
  await expect(fellowPage.getByText(/\[READ ONLY\]/)).toBeVisible();
  await expect(fellowPage.getByRole("link", { name: "New entry" })).toHaveCount(0);

  await fellowPage.goto("/t/demo/diary-export");
  await fellowPage.getByLabel(/Type REOPEN MY DIARY/).fill("REOPEN MY DIARY");
  await fellowPage.getByRole("button", { name: "Reopen my diary" }).click();
  await expect(fellowPage.getByRole("heading", { name: "Finish diary" })).toBeVisible();

  await fellowPage.goto(evidenceUrl);
  await fellowPage.getByRole("button", { name: "Restore entry" }).click();
  await expect(fellowPage.getByText("[PRIVATE DIARY]")).toBeVisible();
});
