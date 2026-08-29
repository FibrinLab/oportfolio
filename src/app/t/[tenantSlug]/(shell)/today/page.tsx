import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActor, resolveTenant } from "@/server/policy/actor";
import { getFellowContext } from "@/server/tenancy/fellowContext";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const actor = await getActor();
  if (!actor) notFound();
  const { tenantSlug } = await params;
  const tenantContext = await resolveTenant(actor, tenantSlug);
  if (!tenantContext) notFound();

  const fellow = await getFellowContext(actor, tenantContext.tenantId);

  return (
    <>
      <h1 style={{ marginBottom: "var(--space-5)" }}>
        Hello, {fellow?.preferredName ?? actor.displayName}.
      </h1>

      {fellow ? (
        <section
          aria-labelledby="diary-heading"
          style={{
            border: "1px solid var(--rule)",
            padding: "var(--space-4)",
            marginBottom: "var(--space-5)",
            maxWidth: "var(--measure)",
          }}
        >
          <h2 id="diary-heading" style={{ borderBottom: "2px solid var(--ink)", paddingBottom: "var(--space-2)", marginBottom: "var(--space-3)" }}>
            Your private log
          </h2>
          <p style={{ marginBottom: "var(--space-4)" }}>
            Add a short note, a longer reflection, or a useful link. There is no programme
            approval workflow—this space is for your own record.
          </p>
          <Link
            href={`/t/${tenantSlug}/log/new`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: "var(--target-min)",
              padding: "0 var(--space-5)",
              background: "var(--ink)",
              color: "var(--paper)",
              border: "2px solid var(--ink)",
              borderRadius: "var(--radius-control)",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            New entry
          </Link>
          <p style={{ marginTop: "var(--space-4)", fontSize: "var(--text-sm)" }}>
            Only you can read your entries, dates, links, and files within oPortfolio.
          </p>
        </section>
      ) : (
        <p style={{ maxWidth: "var(--measure)" }}>
          Your diary is not available in this workspace.
        </p>
      )}
    </>
  );
}
