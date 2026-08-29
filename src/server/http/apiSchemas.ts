import { z } from "zod";

// Request-body schemas for every /api/v1 endpoint, shared by the route
// handlers and the OpenAPI generator (spec/07: OpenAPI 3.1 generated and
// committed; CI fails on drift).

export const magicLinkRequest = z.object({ email: z.string().email().max(320) });

const noticeAcknowledgementInput = z.object({
  noticeType: z.enum(["privacy_notice", "acceptable_use", "no_patient_data"]),
  noticeVersion: z.string().max(40),
});

// Every sign-in confirms the current notices (recorded once per version):
// a first verified link creates the diary, so this is the affirmative act
// for the privacy notice and usage rules (spec/05, docs/dpia.md).
export const verifyRequest = z.object({
  token: z.string().min(20).max(200),
  acknowledgedNotices: z.array(noticeAcknowledgementInput).min(3),
});

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

// End-to-end encryption (ADR-007): an AES-256-GCM envelope produced in the
// browser. The server validates shape and size only — it cannot open it.
export const envelopeSchema = z.object({
  v: z.literal(1),
  alg: z.literal("A256GCM"),
  kid: z.number().int().min(1).max(10_000),
  iv: z.string().min(16).max(24),
  ct: z.string().min(22).max(1_500_000),
});

export const contentEncSchema = z.object({
  title: envelopeSchema,
  narrative: envelopeSchema,
});

const wrappedKeySchema = z.object({ iv: z.string().min(16).max(24), ct: z.string().min(40).max(200) });

export const diaryKeyMaterialSchema = z.object({
  keyVersion: z.number().int().min(1).max(10_000),
  kdf: z.object({
    alg: z.literal("PBKDF2-SHA256"),
    iterations: z.number().int().min(100_000).max(5_000_000),
  }),
  passphraseSalt: z.string().min(16).max(64),
  wrappedByPassphrase: wrappedKeySchema,
  recoverySalt: z.string().min(16).max(64),
  wrappedByRecovery: wrappedKeySchema,
});

export const putDiaryKeyRequest = z.object({ material: diaryKeyMaterialSchema });

export const createEvidenceRequest = z.object({
  // Sealed entries supply their own id so the ciphertext can be bound to it.
  id: z.string().uuid().optional(),
  title: z.string().max(160).optional(),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  evidenceTypeId: z.string().uuid().nullable().optional(),
  narrativeDoc: z.unknown().optional(),
  contentEnc: contentEncSchema.optional(),
  reflectionAcknowledged: z.boolean().optional(),
});

export const patchEvidenceRequest = z.object({
  title: z.string().min(1).max(160).optional(),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  evidenceTypeId: z.string().uuid().nullable().optional(),
  narrativeDoc: z.unknown().optional(),
  contentEnc: contentEncSchema.optional(),
  explicitSave: z.boolean().optional(),
});

export const conflictBackupRequest = z.object({
  snapshot: z.record(z.string(), z.unknown()),
});

export const setObjectivesRequest = z.object({
  objectiveIds: z.array(z.string().uuid()).max(50),
});

export const addLinkRequest = z.object({
  id: z.string().uuid().optional(),
  url: z.string().min(9).max(2000).optional(),
  // Sealed link: envelope over { url, host, label } bound to `id`.
  linkEnc: envelopeSchema.optional(),
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
  // Sealed upload (ADR-007): bytes are an OPE1 container, the real name and
  // media type are in `nameEnc`, bound to the client-chosen `attachmentId`.
  attachmentId: z.string().uuid().optional(),
  encrypted: z.boolean().optional(),
  nameEnc: envelopeSchema.optional(),
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
