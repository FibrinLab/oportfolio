import type { APIRequestContext, Browser, BrowserContext, Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

async function newestMessageId(request: APIRequestContext, to: string): Promise<string | null> {
  const search = await request.get(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(to)}`);
  const body = (await search.json()) as { messages?: Array<{ ID: string }> };
  return body.messages?.[0]?.ID ?? null;
}

// Waits for a message NEWER than `afterId` — older runs leave consumed links
// in the mailbox, and the outbox worker delivers asynchronously.
export async function latestEmailLink(
  request: APIRequestContext,
  to: string,
  linkPattern: RegExp,
  afterId: string | null = null,
): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const messageId = await newestMessageId(request, to);
    if (messageId && messageId !== afterId) {
      const message = await request.get(`${MAILPIT}/api/v1/message/${messageId}`);
      const detail = (await message.json()) as { Text: string };
      const match = linkPattern.exec(detail.Text);
      if (match) return match[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`No new email link for ${to} matching ${linkPattern}`);
}

// End-to-end encryption (ADR-007): the first visit to a diary page asks for
// a passphrase and shows a recovery key; later visits ask to unlock. One
// fixed test passphrase keeps every persona's synthetic diary openable.
export const TEST_PASSPHRASE = "e2e synthetic diary passphrase";

export async function ensureDiaryUnlocked(page: Page): Promise<void> {
  const setup = page.getByRole("heading", { name: "Create your diary passphrase" });
  const unlock = page.getByRole("heading", { name: "Unlock your diary" });
  await Promise.race([
    setup.waitFor({ timeout: 15_000 }).catch(() => undefined),
    unlock.waitFor({ timeout: 15_000 }).catch(() => undefined),
    page.getByRole("main").getByRole("heading", { level: 1 }).first().waitFor({ timeout: 15_000 }).catch(() => undefined),
  ]);
  if (await setup.isVisible()) {
    await page.getByLabel("Passphrase", { exact: true }).fill(TEST_PASSPHRASE);
    await page.getByLabel("Repeat passphrase").fill(TEST_PASSPHRASE);
    await page.getByRole("button", { name: "Create diary lock" }).click();
    await page.getByRole("checkbox", { name: /stored my recovery key/i }).check();
    await page.getByRole("button", { name: "Open my diary" }).click();
    return;
  }
  if (await unlock.isVisible()) {
    await page.getByLabel("Passphrase", { exact: true }).fill(TEST_PASSPHRASE);
    await page.getByRole("button", { name: "Unlock", exact: true }).click();
    await unlock.waitFor({ state: "detached" });
  }
}

export async function signInViaMagicLink(
  context: BrowserContext,
  request: APIRequestContext,
  email: string,
): Promise<Page> {
  const page = await context.newPage();
  const beforeId = await newestMessageId(request, email);
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByRole("status").waitFor();

  const link = await latestEmailLink(
    request,
    email,
    /https?:\/\/localhost:\d+\/auth\/verify\?token=[\w-]+/,
    beforeId,
  );
  await page.goto(link);
  // Every sign-in confirms the privacy notice and usage rules (spec/05).
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue to oPortfolio" }).click();
  await page.waitForURL(/\/t\/.+\/today/);
  // Fellows: visit the diary once so the lock is set up / unlocked for this context.
  if (await page.getByRole("link", { name: "Diary" }).count()) {
    await page.goto(page.url().replace(/\/today$/, "/log"));
    await ensureDiaryUnlocked(page);
  }
  return page;
}

// Faculty invites a brand-new synthetic fellow into the seeded `demo`
// tenant and the fellow accepts, sets up the diary lock and lands on Today.
// Used by suites that need a fellow with a pinned curriculum (self-service
// sign-in would create a personal workspace without one).
export async function onboardFellowIntoDemo(
  browser: Browser,
  request: APIRequestContext,
): Promise<{ context: BrowserContext; page: Page; email: string; name: string }> {
  const suffix = uniqueSuffix();
  const email = `e2e-fellow-${suffix}@example.org`;
  const name = `E2E Fellow ${suffix}`;

  const facultyContext = await browser.newContext();
  const facultyPage = await signInViaMagicLink(facultyContext, request, "frankie.faculty@example.org");
  await facultyPage.goto("/t/demo/faculty/people");
  await facultyPage.getByLabel("Email address (Required)").fill(email);
  await facultyPage.getByLabel("Name (Required)").fill(name);
  await facultyPage.getByRole("button", { name: "Send invitation" }).click();
  await facultyPage.getByRole("status").waitFor();
  await facultyContext.close();

  const inviteLink = await latestEmailLink(request, email, /https?:\/\/localhost:\d+\/invite\/[\w-]+/);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(inviteLink);
  await page.getByLabel(/Preferred name/).fill(name);
  for (const label of [/privacy notice/i, /programme learning records only/i, /must not contain patient-identifiable data/i]) {
    await page.getByRole("checkbox", { name: label }).check();
  }
  await page.getByRole("button", { name: "Accept invitation and continue" }).click();
  await page.waitForURL(/\/t\/demo\/today/);
  await page.goto("/t/demo/log");
  await ensureDiaryUnlocked(page);
  await page.goto("/t/demo/today");
  return { context, page, email, name };
}

export function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}
