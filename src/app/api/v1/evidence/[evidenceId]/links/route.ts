import { NextResponse } from "next/server";
import { addLinkRequest, removeLinkRequest } from "@/server/http/apiSchemas";
import { getEvidenceWithAccess } from "@/server/portfolio/evidence";
import { addLink, listLinks, removeLink } from "@/server/portfolio/links";
import { notFoundProblem, problem } from "@/server/http/problem";
import { withApi } from "@/server/http/withApi";
import { resolveTenantForApi } from "@/server/http/tenant";

export const POST = withApi({ bodySchema: addLinkRequest }, async ({ actor, body, params, request, requestId }) => {
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

export const DELETE = withApi({ bodySchema: removeLinkRequest }, async ({ actor, body, params, request, requestId }) => {
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
