import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { noticeAcknowledgement } from "@/server/db/schema";
import { getActor, resolveTenant } from "@/server/policy/actor";
import { getEditorContext } from "@/server/portfolio/editorData";
import { EvidenceEditor } from "@/components/evidence/EvidenceEditor";

export const metadata: Metadata = { title: "New entry" };

export default async function NewEvidencePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ objective?: string }>;
}) {
  const actor = await getActor();
  if (!actor) notFound();
  const { tenantSlug } = await params;
  const { objective: preselectedObjective } = await searchParams;
  const tenantContext = await resolveTenant(actor, tenantSlug);
  if (!tenantContext) notFound();

  const context = await getEditorContext(actor, tenantContext.tenantId);
  if (!context || context.enrolment.diaryState !== "open") notFound();

  const priorReflectionAck = await getDb()
    .select({ id: noticeAcknowledgement.id })
    .from(noticeAcknowledgement)
    .where(
      and(
        eq(noticeAcknowledgement.tenantId, tenantContext.tenantId),
        eq(noticeAcknowledgement.userId, actor.userId),
        eq(noticeAcknowledgement.noticeType, "reflection_safety"),
      ),
    )
    .limit(1);

  return (
    <EvidenceEditor
      tenantSlug={tenantSlug}
      enrolmentId={context.enrolment.id}
      initial={{
        id: null,
        title: "",
        activityDate: new Date().toISOString().slice(0, 10),
        evidenceTypeId: null,
        narrativeDoc: { type: "doc", content: [{ type: "paragraph" }] },
        // "Add evidence for this objective" preselects it; the entry still
        // starts private (spec/09 S-07).
        objectiveIds: context.pickerObjectives.some((o) => o.id === preselectedObjective)
          ? [preselectedObjective!]
          : [],
        rowVersion: 1,
      }}
      options={context.options}
      pickerObjectives={context.pickerObjectives}
      frameworkLabel={context.frameworkLabel}
      reflectionAcknowledgedBefore={priorReflectionAck.length > 0}
    />
  );
}
