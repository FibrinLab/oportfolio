import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";

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
  await page.getByRole("button", { name: "Continue to oPortfolio" }).click();
  await page.waitForURL(/\/t\/.+\/today/);
  return page;
}

export function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}
