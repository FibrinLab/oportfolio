import { DiaryLockGate } from "@/components/lock/DiaryLockGate";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

  return (
    <div style={{ maxWidth: "var(--measure)" }}>
      <h1 style={{ marginBottom: "var(--space-2)" }}>Export your diary</h1>
      <p style={{ marginBottom: "var(--space-5)" }}>
        Only you can create or download a diary export — it is built in your browser from your
        encrypted entries.
      </p>
      <DiaryLockGate>
        <DiaryExportClient
          tenantSlug={tenantSlug}
          enrolmentId={enrolment.id}
          diaryState={enrolment.diaryState}
          accessEndsAt={enrolment.diaryAccessEndsAt?.toISOString() ?? null}
        />
      </DiaryLockGate>
    </div>
  );
}
