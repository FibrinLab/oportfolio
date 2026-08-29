import { z } from "zod";

// Request-body schemas for every /api/v1 endpoint, shared by the route
// handlers and the OpenAPI generator (spec/07: OpenAPI 3.1 generated and
// committed; CI fails on drift).

export const magicLinkRequest = z.object({ email: z.string().email().max(320) });

export const verifyRequest = z.object({ token: z.string().min(20).max(200) });

export const acceptInvitationRequest = z.object({
  token: z.string().min(20).max(200),
  preferredName: z.string().min(1).max(160),
  professionalGroup: z.string().max(160).optional(),
  homeSpecialtyOrRole: z.string().max(160).optional(),
  organisation: z.string().max(160).optional(),
  acknowledgedNotices: z
    .array(
      z.object({
        noticeType: z.enum(["privacy_notice", "acceptable_use", "no_patient_data"]),
        noticeVersion: z.string().max(40),
      }),
    )
    .min(3),
});

export const createInvitationRequest = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email().max(320),
  displayName: z.string().min(1).max(160),
  role: z.enum(["fellow", "supervisor", "faculty"]),
  cohortId: z.string().uuid().optional(),
  primarySupervisorUserId: z.string().uuid().optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const createEvidenceRequest = z.object({
  title: z.string().min(1).max(160),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  evidenceTypeId: z.string().uuid().nullable().optional(),
  narrativeDoc: z.unknown().optional(),
  reflectionAcknowledged: z.boolean().optional(),
});

export const patchEvidenceRequest = z.object({
  title: z.string().min(1).max(160).optional(),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  evidenceTypeId: z.string().uuid().nullable().optional(),
  narrativeDoc: z.unknown().optional(),
  explicitSave: z.boolean().optional(),
});

export const conflictBackupRequest = z.object({
  snapshot: z.record(z.string(), z.unknown()),
});

export const setObjectivesRequest = z.object({
  objectiveIds: z.array(z.string().uuid()).max(50),
});

export const addLinkRequest = z.object({
  url: z.string().min(9).max(2000),
  label: z.string().max(160).optional(),
  linkType: z
    .enum(["general", "repository", "commit", "pull_request", "release", "notebook", "other"])
    .optional(),
  description: z.string().max(1000).optional(),
});

export const removeLinkRequest = z.object({ linkId: z.string().uuid() });

export const initiateUploadRequest = z.object({
  entryId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  mediaTypeClaimed: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive(),
  patientDataConfirmed: z.literal(true),
});

export const exportDiaryRequest = z.object({
  enrolmentId: z.string().uuid(),
});

export const finishDiaryRequest = z.object({
  confirmation: z.literal("FINISH MY DIARY"),
});

export const reopenDiaryRequest = z.object({
  confirmation: z.literal("REOPEN MY DIARY"),
});

export const placeRetentionHoldRequest = z.object({
  reason: z.string().trim().min(10).max(500),
});

export const releaseRetentionHoldRequest = z.object({
  confirmation: z.literal("RELEASE HOLD"),
});
