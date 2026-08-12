import type { Metadata } from "next";
import { VerifyClient } from "./VerifyClient";

export const metadata: Metadata = { title: "Sign in" };

// Interstitial: the GET renders a button; only the POST consumes the token,
// so mailbox link scanners cannot spend it (spec risk: magic-link prefetch).
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main
      style={{
        maxWidth: "34rem",
        margin: "0 auto",
        padding: "var(--space-8) var(--gutter)",
      }}
    >
      <h1 style={{ marginBottom: "var(--space-4)" }}>Continue to oPortfolio</h1>
      {token ? (
        <VerifyClient token={token} />
      ) : (
        <p>
          This sign-in link is incomplete. Request a new one from the sign-in page.
        </p>
      )}
    </main>
  );
}
