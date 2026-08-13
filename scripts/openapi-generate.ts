import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z, type ZodType } from "zod";
import * as schemas from "@/server/http/apiSchemas";

// Generates the committed OpenAPI 3.1 document (spec/07). CI regenerates and
// diffs — a mismatch means a route changed without updating the contract.

function body(schema: ZodType) {
  return {
    required: true,
    content: { "application/json": { schema: z.toJSONSchema(schema, { target: "draft-2020-12" }) } },
  };
}

const problemResponse = {
  description: "Problem details (RFC 9457)",
  content: {
    "application/problem+json": {
      schema: {
        type: "object",
        properties: {
          type: { type: "string" },
          title: { type: "string" },
          status: { type: "integer" },
          code: { type: "string" },
          requestId: { type: "string" },
          detail: { type: "string" },
        },
        required: ["type", "title", "status", "code", "requestId"],
      },
    },
  },
};

const ok = { description: "Success" };
const created = { description: "Created" };
const uniform404 = {
  ...problemResponse,
  description:
    "Not found — returned both for missing objects and for objects the caller may not read (no existence oracle)",
};

const uuidParam = (name: string) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
});

const tenantHeader = {
  name: "x-tenant",
  in: "header",
  required: false,
  description: "Tenant slug; required when the caller belongs to more than one tenant",
  schema: { type: "string" },
};

const ifMatchHeader = {
  name: "If-Match",
  in: "header",
  required: true,
  description: "Current row version; 412 on mismatch, 428 when missing",
  schema: { type: "string" },
};

const idempotencyHeader = {
  name: "Idempotency-Key",
  in: "header",
  required: false,
  description: "Replays the stored response for a repeated create/transition",
  schema: { type: "string" },
};

const document = {
  openapi: "3.1.0",
  info: {
    title: "oPortfolio API",
    version: "0.1.0",
    description:
      "Milestone 1 surface. Browser clients use same-site secure sessions with CSRF origin checks; every endpoint resolves the tenant from authenticated membership before object authorization (default deny).",
  },
  servers: [{ url: "/", description: "Same-origin" }],
  paths: {
    "/api/v1/auth/magic-link": {
      post: {
        summary: "Request a sign-in link (uniform response; rate limited)",
        requestBody: body(schemas.magicLinkRequest),
        responses: { "200": ok },
      },
    },
    "/api/v1/auth/verify": {
      post: {
        summary: "Consume a magic-link token and start a session",
        requestBody: body(schemas.verifyRequest),
        responses: { "200": ok, "422": problemResponse },
      },
    },
    "/api/v1/auth/sign-out": {
      post: { summary: "Revoke the current session", responses: { "200": ok } },
    },
    "/api/v1/me": {
      get: { summary: "Current user and memberships", responses: { "200": ok, "401": problemResponse } },
    },
    "/api/v1/invitations": {
      post: {
        summary: "Create an invitation (faculty/tenant admin); fellow invitations create a provisional enrolment",
        parameters: [idempotencyHeader],
        requestBody: body(schemas.createInvitationRequest),
        responses: { "201": created, "404": uniform404 },
      },
    },
    "/api/v1/invitations/accept": {
      post: {
        summary: "Accept an invitation: create the account, memberships and session",
        requestBody: body(schemas.acceptInvitationRequest),
        responses: { "200": ok, "422": problemResponse },
      },
    },
    "/api/v1/enrolments/{enrolmentId}/evidence": {
      get: {
        summary: "List evidence visible to the caller (visibility-filtered before materialisation)",
        parameters: [uuidParam("enrolmentId"), tenantHeader],
        responses: { "200": ok, "404": uniform404 },
      },
      post: {
        summary: "Create a private draft evidence item",
        parameters: [uuidParam("enrolmentId"), tenantHeader, idempotencyHeader],
        requestBody: body(schemas.createEvidenceRequest),
        responses: { "201": created, "404": uniform404, "422": problemResponse },
      },
    },
    "/api/v1/evidence/{evidenceId}": {
      get: {
        summary: "Read an evidence item (ETag carries the row version)",
        parameters: [uuidParam("evidenceId"), tenantHeader],
        responses: { "200": ok, "404": uniform404 },
      },
      patch: {
        summary: "Update fields with optimistic concurrency; autosaves snapshot on material change",
        parameters: [uuidParam("evidenceId"), tenantHeader, ifMatchHeader],
        requestBody: body(schemas.patchEvidenceRequest),
        responses: {
          "200": ok,
          "404": uniform404,
          "412": { ...problemResponse, description: "Saved elsewhere — current version returned" },
          "428": problemResponse,
        },
      },
      delete: {
        summary: "Soft-delete with a recovery grace period",
        parameters: [uuidParam("evidenceId"), tenantHeader],
        responses: { "200": ok, "404": uniform404 },
      },
    },
    "/api/v1/evidence/{evidenceId}/share": {
      post: {
        summary: "Change the audience after an explicit preview (audited)",
        parameters: [uuidParam("evidenceId"), tenantHeader, idempotencyHeader],
        requestBody: body(schemas.shareEvidenceRequest),
        responses: { "200": ok, "404": uniform404, "409": problemResponse },
      },
    },
    "/api/v1/evidence/{evidenceId}/archive": {
      post: {
        summary: "Archive the item",
        parameters: [uuidParam("evidenceId"), tenantHeader],
        responses: { "200": ok, "404": uniform404 },
      },
    },
    "/api/v1/evidence/{evidenceId}/restore": {
      post: {
        summary: "Restore an archived or grace-period-deleted item",
        parameters: [uuidParam("evidenceId"), tenantHeader],
        responses: { "200": ok, "404": uniform404 },
      },
    },
    "/api/v1/evidence/{evidenceId}/revisions": {
      get: {
        summary: "Append-only revision history",
        parameters: [uuidParam("evidenceId"), tenantHeader],
        responses: { "200": ok, "404": uniform404 },
      },
      post: {
        summary: "Preserve an unsaved body as a conflict-backup revision",
        parameters: [uuidParam("evidenceId"), tenantHeader],
        requestBody: body(schemas.conflictBackupRequest),
        responses: { "201": created, "404": uniform404 },
      },
    },
    "/api/v1/evidence/{evidenceId}/objectives": {
      put: {
        summary: "Replace active objective mappings (pinned-release enforced)",
        parameters: [uuidParam("evidenceId"), tenantHeader],
        requestBody: body(schemas.setObjectivesRequest),
        responses: { "200": ok, "404": uniform404, "422": problemResponse },
      },
    },
    "/api/v1/evidence/{evidenceId}/duties": {
      put: {
        summary: "Replace duty tags",
        parameters: [uuidParam("evidenceId"), tenantHeader],
        requestBody: body(schemas.setDutiesRequest),
        responses: { "200": ok, "404": uniform404 },
      },
    },
    "/api/v1/evidence/{evidenceId}/links": {
      get: {
        summary: "List external links",
        parameters: [uuidParam("evidenceId"), tenantHeader],
        responses: { "200": ok, "404": uniform404 },
      },
      post: {
        summary: "Add an HTTPS link (never fetched server-side)",
        parameters: [uuidParam("evidenceId"), tenantHeader],
        requestBody: body(schemas.addLinkRequest),
        responses: { "201": created, "404": uniform404, "422": problemResponse },
      },
      delete: {
        summary: "Remove a link",
        parameters: [uuidParam("evidenceId"), tenantHeader],
        requestBody: body(schemas.removeLinkRequest),
        responses: { "200": ok, "404": uniform404 },
      },
    },
    "/api/v1/evidence/{evidenceId}/attachments": {
      get: {
        summary: "List attachments with scan status",
        parameters: [uuidParam("evidenceId"), tenantHeader],
        responses: { "200": ok, "404": uniform404 },
      },
    },
    "/api/v1/attachments/initiate": {
      post: {
        summary:
          "Authorize an upload: policy checks, then a single-object short-expiry presigned POST to the quarantine bucket",
        parameters: [tenantHeader],
        requestBody: body(schemas.initiateUploadRequest),
        responses: { "201": created, "404": uniform404, "422": problemResponse },
      },
    },
    "/api/v1/attachments/{attachmentId}/complete": {
      post: {
        summary: "Confirm the upload landed; queues the malware/type scan",
        parameters: [uuidParam("attachmentId"), tenantHeader],
        responses: { "200": ok, "404": uniform404 },
      },
    },
    "/api/v1/attachments/{attachmentId}/download": {
      get: {
        summary:
          "302 to a presigned URL (≤5 min) — only for clean files whose parent the caller can read",
        parameters: [uuidParam("attachmentId"), tenantHeader],
        responses: { "302": { description: "Redirect to signed URL" }, "404": uniform404 },
      },
    },
    "/api/v1/attachments/{attachmentId}": {
      delete: {
        summary: "Soft-delete an attachment",
        parameters: [uuidParam("attachmentId"), tenantHeader],
        responses: { "200": ok, "404": uniform404 },
      },
    },
  },
};

const outPath = path.join(process.cwd(), "docs", "openapi.json");
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(document, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
