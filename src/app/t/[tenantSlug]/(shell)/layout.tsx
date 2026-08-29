import { notFound, redirect } from "next/navigation";
import { AppShell, type NavItem } from "@/components/ds/AppShell";
import { getOwnEnrolment } from "@/server/framework/queries";
import { getActor, resolveTenant } from "@/server/policy/actor";

// Every authenticated page lives under this layout: session required, tenant
// resolved from the slug and intersected with memberships — a non-member sees
// the same 404 as a missing tenant (no existence oracle).

export default async function ShellLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");

  const { tenantSlug } = await params;
  const tenantContext = await resolveTenant(actor, tenantSlug);
  if (!tenantContext) notFound();

  const roles = new Set(
    actor.memberships.filter((m) => m.tenantId === tenantContext.tenantId).map((m) => m.role),
  );

  const base = `/t/${tenantSlug}`;
  const navItems: NavItem[] = [];
  if (roles.has("fellow")) {
    const ownEnrolment = await getOwnEnrolment(actor, tenantContext.tenantId);
    navItems.push(
      { href: `${base}/today`, label: "Today" },
      { href: `${base}/log`, label: "Diary" },
      { href: `${base}/diary-export`, label: "Export" },
    );
    if (ownEnrolment?.frameworkReleaseId) {
      navItems.splice(2, 0, { href: `${base}/curriculum`, label: "Curriculum" });
    }
  }
  if (roles.has("faculty") || roles.has("tenant_admin")) {
    navItems.push({ href: `${base}/faculty/people`, label: "People" });
  }

  const roleLabel = [...roles]
    .filter((role) => role !== "fellow")
    .map((role) =>
      role === "tenant_admin" ? "Tenant admin" : role.charAt(0).toUpperCase() + role.slice(1),
    )
    .join(", ");

  return (
    <AppShell
      tenantName={tenantContext.tenantName}
      roleLabel={roleLabel}
      navItems={navItems}
      accountHref={`${base}/account`}
    >
      {children}
    </AppShell>
  );
}
