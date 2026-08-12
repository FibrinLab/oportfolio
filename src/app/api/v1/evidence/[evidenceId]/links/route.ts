import { NextResponse } from "next/server";
import { z } from "zod";
import { getEvidenceWithAccess } from "@/server/portfolio/evidence";
import { addLink, listLinks, removeLink } from "@/server/portfolio/links";
import { notFoundProblem, problem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { resolveTenantForApi } from "@/server/http/tenant";

const addSchema = z.object({
  url: z.string().min(9).max(2000),
  label: z.string().max(160).optional(),
  linkType: z
    .enum(["general", "repository", "commit", "pull_request", "release", "notebook", "other"])
    .optional(),
  description: z.string().max(1000).optional(),
});

export const POST = withApi({ bodySchema: addSchema }, async ({ actor, body, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);

  const result = await addLink(actor, access, body, requestId);
  if (!result.ok) {
    if (result.reason === "denied") return notFoundProblem(requestId);
    return problem("validation-failed", requestId, { detail: result.reason });
  }
  return NextResponse.json(result, { status: 201 });
});

const deleteSchema = z.object({ linkId: z.string().uuid() });

export const DELETE = withApi({ bodySchema: deleteSchema }, async ({ actor, body, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);

  const ok = await removeLink(actor, access, body.linkId, requestId);
  if (!ok) return notFoundProblem(requestId);
  return NextResponse.json({ ok: true });
});

export const GET = withApi({}, async ({ actor, params, request, requestId }) => {
  const tenantId = await resolveTenantForApi(actor, request);
  if (!tenantId) return notFoundProblem(requestId);
  const access = await getEvidenceWithAccess(actor, tenantId, params.evidenceId!);
  if (!access || !access.decision.allow) return notFoundProblem(requestId);
  return NextResponse.json({ links: await listLinks(params.evidenceId!, tenantId) });
});
