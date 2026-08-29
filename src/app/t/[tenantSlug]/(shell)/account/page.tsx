import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getActor, resolveTenant } from "@/server/policy/actor";
import { SignOutButton } from "./SignOutButton";
import { BodyFontToggle } from "./BodyFontToggle";
import { DiaryLockSettings } from "@/components/lock/DiaryLockSettings";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const actor = await getActor();
  if (!actor) notFound();
  const { tenantSlug } = await params;
  const tenantContext = await resolveTenant(actor, tenantSlug);
  if (!tenantContext) notFound();

  const cookieStore = await cookies();
  const bodyFont = cookieStore.get("body-font")?.value === "sans" ? "sans" : "mono";

  return (
    <>
      <h1 style={{ marginBottom: "var(--space-5)" }}>Account</h1>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          gap: "var(--space-2) var(--space-4)",
          marginBottom: "var(--space-6)",
          maxWidth: "var(--measure)",
        }}
      >
        <dt style={{ fontWeight: 700 }}>Name</dt>
        <dd>{actor.displayName}</dd>
        <dt style={{ fontWeight: 700 }}>Email</dt>
        <dd>{actor.emailNormalised}</dd>
        <dt style={{ fontWeight: 700 }}>Tenant</dt>
        <dd>{tenantContext.tenantName}</dd>
      </dl>

      <section aria-labelledby="a11y-heading" style={{ marginBottom: "var(--space-6)" }}>
        <h2 id="a11y-heading" style={{ marginBottom: "var(--space-3)" }}>
          Reading preferences
        </h2>
        <BodyFontToggle current={bodyFont} />
      </section>

      {actor.memberships.some((m) => m.tenantId === tenantContext.tenantId && m.role === "fellow") ? (
        <DiaryLockSettings />
      ) : null}

      <SignOutButton />
    </>
  );
}
