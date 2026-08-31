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
      "Private personal diary surface. A verified email creates its own isolated diary; entries, links, files, revisions and exports are readable only by their author.",
  },
  servers: [{ url: "/", description: "Same-origin" }],
  paths: {
    "/api/v1/auth/magic-link": {
      post: {
        summary: "Request an access link for sign-up or sign-in (uniform response; rate limited)",
        requestBody: body(schemas.magicLinkRequest),
        responses: { "200": ok },
      },
    },
    "/api/v1/auth/verify": {
      post: {
        summary: "Verify the email, create a private diary when needed, and start a session",
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
    "/api/v1/enrolments/{enrolmentId}/diary-entries": {
      get: {
        summary: "List the fellow's current and archived private diary entries",
        parameters: [uuidParam("enrolmentId"), tenantHeader],
        responses: { "200": ok, "404": uniform404 },
      },
      post: {
        summary: "Create a private diary entry",
        parameters: [uuidParam("enrolmentId"), tenantHeader, idempotencyHeader],
        requestBody: body(schemas.createEvidenceRequest),
        responses: { "201": created, "404": uniform404, "422": problemResponse },
      },
    },
    "/api/v1/diary-entries/{evidenceId}": {
      get: {
        summary: "Read the owner's private diary entry (ETag carries the row version)",
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
    "/api/v1/diary-entries/{evidenceId}/archive": {
      post: {
        summary: "Archive the item",
        parameters: [uuidParam("evidenceId"), tenantHeader],
        responses: { "200": ok, "404": uniform404 },
      },
    },
    "/api/v1/diary-entries/{evidenceId}/restore": {
      post: {
        summary: "Restore an archived or grace-period-deleted item",
        parameters: [uuidParam("evidenceId"), tenantHeader],
        responses: { "200": ok, "404": uniform404 },
      },
    },
    "/api/v1/diary-entries/{evidenceId}/revisions": {
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
    "/api/v1/diary-entries/{evidenceId}/objectives": {
      put: {
        summary: "Replace active objective mappings (pinned-release enforced)",
        parameters: [uuidParam("evidenceId"), tenantHeader],
        requestBody: body(schemas.setObjectivesRequest),
        responses: { "200": ok, "404": uniform404, "422": problemResponse },
      },
    },
    "/api/v1/diary-entries/{evidenceId}/links": {
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
    "/api/v1/diary-entries/{evidenceId}/attachments": {
      get: {
        summary: "List attachments with scan status",
        parameters: [uuidParam("evidenceId"), tenantHeader],
        responses: { "200": ok, "404": uniform404 },
      },
    },
    "/api/v1/attachments/initiate": {
      post: {
        summary: "Authorize an encrypted attachment upload and create its pending record",
        parameters: [tenantHeader],
        requestBody: body(schemas.initiateUploadRequest),
        responses: { "201": created, "404": uniform404, "422": problemResponse },
      },
    },
    "/api/v1/attachments/{attachmentId}/content": {
      put: {
        summary: "Upload browser-encrypted attachment bytes to private quarantine storage",
        parameters: [uuidParam("attachmentId"), tenantHeader],
        requestBody: {
          required: true,
          content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } },
        },
        responses: { "200": ok, "404": uniform404, "422": problemResponse },
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
    "/api/v1/exports": {
      post: {
        summary: "Create a point-in-time portable diary ZIP",
        parameters: [tenantHeader],
        requestBody: body(schemas.exportDiaryRequest),
        responses: { "202": { description: "Export queued" }, "404": uniform404, "422": problemResponse },
      },
    },
    "/api/v1/exports/{exportId}": {
      get: {
        summary: "Read the owner's diary export status",
        parameters: [uuidParam("exportId"), tenantHeader],
        responses: { "200": ok, "404": uniform404 },
      },
    },
    "/api/v1/exports/{exportId}/download": {
      get: {
        summary: "Issue a short-lived download redirect for a ready diary ZIP",
        parameters: [uuidParam("exportId"), tenantHeader],
        responses: { "303": { description: "Redirect to signed URL" }, "404": uniform404 },
      },
    },
    "/api/v1/enrolments/{enrolmentId}/diary/finish": {
      post: {
        summary: "Finish and lock the diary, queue its final copy and start the 90-day window",
        parameters: [uuidParam("enrolmentId"), tenantHeader],
        requestBody: body(schemas.finishDiaryRequest),
        responses: { "200": ok, "404": uniform404, "422": problemResponse },
      },
    },
    "/api/v1/enrolments/{enrolmentId}/diary/reopen": {
      post: {
        summary: "Reopen a finished diary during its access window and cancel that finish cycle",
        parameters: [uuidParam("enrolmentId"), tenantHeader],
        requestBody: body(schemas.reopenDiaryRequest),
        responses: { "200": ok, "404": uniform404, "422": problemResponse },
      },
    },
    "/api/v1/enrolments/{enrolmentId}/retention-hold": {
      post: {
        summary: "Place an exceptional retention hold (tenant administrator only)",
        parameters: [uuidParam("enrolmentId"), tenantHeader],
        requestBody: body(schemas.placeRetentionHoldRequest),
        responses: { "201": created, "404": uniform404, "422": problemResponse },
      },
      delete: {
        summary: "Release the active exceptional retention hold (tenant administrator only)",
        parameters: [uuidParam("enrolmentId"), tenantHeader],
        requestBody: body(schemas.releaseRetentionHoldRequest),
        responses: { "200": ok, "404": uniform404, "422": problemResponse },
      },
    },
  },
};

const outPath = path.join(process.cwd(), "docs", "openapi.json");
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(document, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
