import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createConflictBackup,
  getEvidenceWithAccess,
  listRevisions,
} from "@/server/portfolio/evidence";
import { notFoundProblem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { resolveTenantForApi } from "@/server/http/tenant";

const backupSchema = z.object({
  // The losing tab's unsaved body, preserved verbatim as a revision (AC-04).
  snapshot: z.record(z.string(), z.unknown()),
});

export const POST = withApi({ bodySchema: backupSchema }, async ({ actor, body, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);

  const result = await createConflictBackup(
    actor,
    access,
    { ...body.snapshot, conflictBackup: true },
    requestId,
  );
  if (!result.ok) return notFoundProblem(requestId);
  return NextResponse.json({ ok: true }, { status: 201 });
});

export const GET = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);

  const revisions = await listRevisions(actor, access);
  if (!revisions) return notFoundProblem(requestId);
  return NextResponse.json({ revisions });
});
