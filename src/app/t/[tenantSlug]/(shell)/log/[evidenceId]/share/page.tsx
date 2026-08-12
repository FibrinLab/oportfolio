import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { appUser, attachment, externalLink, supervisorAssignment } from "@/server/db/schema";
import { getActor, resolveTenant } from "@/server/policy/actor";
import { canShareEvidence } from "@/server/policy/policy";
import { getEvidenceWithAccess } from "@/server/portfolio/evidence";
import { ShareForm } from "./ShareForm";

export const metadata: Metadata = { title: "Share evidence" };

// The share confirmation page (spec/09 S-05): the fellow previews exactly who
// will see the item — named people groups, files and links included — before
// deliberately confirming (ADR-002, DoD step 5).

export default async function SharePage({
  params,
}: {
  params: Promise<{ tenantSlug: string; evidenceId: string }>;
}) {
  const actor = await getActor();
  if (!actor) notFound();
  const { tenantSlug, evidenceId } = await params;
  const tenantContext = await resolveTenant(actor, tenantSlug);
  if (!tenantContext) notFound();

  const access = await getEvidenceWithAccess(actor, tenantContext.tenantId, evidenceId);
  if (!access || !access.decision.allow) notFound();
  if (!canShareEvidence(actor, access.evidence, access.enrolment).allow) notFound();

  const db = getDb();
  const supervisors = await db
    .select({ displayName: appUser.displayName, assignmentType: supervisorAssignment.assignmentType })
    .from(supervisorAssignment)
    .innerJoin(appUser, eq(supervisorAssignment.supervisorUserId, appUser.id))
    .where(
      and(
        eq(supervisorAssignment.enrolmentId, access.enrolment.id),
        isNull(supervisorAssignment.endsAt),
      ),
    );

  const attachments = await db
    .select({ id: attachment.id, displayName: attachment.displayName, scanStatus: attachment.scanStatus })
    .from(attachment)
    .where(
      and(
        eq(attachment.parentType, "evidence_item"),
        eq(attachment.parentId, evidenceId),
        isNull(attachment.deletedAt),
      ),
    );

  const links = await db
    .select({ id: externalLink.id, host: externalLink.host, label: externalLink.label })
    .from(externalLink)
    .where(and(eq(externalLink.evidenceItemId, evidenceId), isNull(externalLink.deletedAt)));

  const missing: string[] = [];
  if (access.evidence.title.trim().length < 5) missing.push("a title of at least 5 characters");
  if (!access.evidence.activityDate) missing.push("an activity date");
  if (access.evidence.narrativeText.length < 20) missing.push("a narrative of at least 20 characters");
  if (!access.evidence.provenanceId) missing.push("a delivery source");
  const { getActiveObjectiveIds } = await import("@/server/portfolio/evidence");
  const objectiveIds = await getActiveObjectiveIds(evidenceId);
  if (objectiveIds.length === 0) missing.push("at least one curriculum objective");

  return (
    <div style={{ maxWidth: "var(--measure)" }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
        <Link href={`/t/${tenantSlug}/log/${evidenceId}`}>Back to entry</Link>
      </nav>

      <h1 style={{ marginBottom: "var(--space-2)" }}>Choose who can see this entry</h1>
      <p style={{ marginBottom: "var(--space-5)" }}>
        <strong>{access.evidence.title}</strong>
      </p>

      <ShareForm
        tenantSlug={tenantSlug}
        evidenceId={evidenceId}
        currentVisibility={access.evidence.visibility}
        supervisorNames={supervisors.map(
          (s) => `${s.displayName}${s.assignmentType === "primary" ? " (primary supervisor)" : " (co-supervisor)"}`,
        )}
        attachments={attachments.map((a) => ({
          displayName: a.displayName,
          scanStatus: a.scanStatus,
        }))}
        links={links.map((l) => l.label ?? l.host)}
        missingForSharing={missing}
      />
    </div>
  );
}
