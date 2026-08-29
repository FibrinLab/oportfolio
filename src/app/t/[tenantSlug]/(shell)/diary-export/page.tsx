import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { exportJob } from "@/server/db/schema";
import { getOwnEnrolment } from "@/server/framework/queries";
import { getActor, resolveTenant } from "@/server/policy/actor";
import { DiaryExportClient } from "./DiaryExportClient";

export const metadata: Metadata = { title: "Export diary" };

export default async function DiaryExportPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const actor = await getActor();
  if (!actor) notFound();
  const { tenantSlug } = await params;
  const tenantContext = await resolveTenant(actor, tenantSlug);
  if (!tenantContext) notFound();
  const enrolment = await getOwnEnrolment(actor, tenantContext.tenantId);
  if (!enrolment) notFound();

  const jobs = await getDb()
    .select({
      id: exportJob.id,
      status: exportJob.status,
      kind: exportJob.kind,
      failureDetail: exportJob.failureDetail,
    })
    .from(exportJob)
    .where(
      and(
        eq(exportJob.enrolmentId, enrolment.id),
        eq(exportJob.requestedBy, actor.userId),
      ),
    )
    .orderBy(desc(exportJob.createdAt))
    .limit(1);
  const latest = jobs[0] ?? null;

  return (
    <div style={{ maxWidth: "var(--measure)" }}>
      <h1 style={{ marginBottom: "var(--space-2)" }}>Export your diary</h1>
      <p style={{ marginBottom: "var(--space-5)" }}>
        Only you can create or download a diary export.
      </p>
      <DiaryExportClient
        tenantSlug={tenantSlug}
        enrolmentId={enrolment.id}
        diaryState={enrolment.diaryState}
        accessEndsAt={enrolment.diaryAccessEndsAt?.toISOString() ?? null}
        initialExport={
          latest
            ? { ...latest, downloadUrl: latest.status === "ready" ? `/api/v1/exports/${latest.id}/download` : null }
            : null
        }
      />
    </div>
  );
}
