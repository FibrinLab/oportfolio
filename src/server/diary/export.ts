import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db } from "@/server/db/client";
import {
  appUser,
  attachment,
  cohort,
  domain,
  enrolment as enrolmentTable,
  evidenceItem,
  evidenceObjective,
  evidenceType,
  exportJob,
  externalLink,
  objective,
  programme,
} from "@/server/db/schema";
import { enqueue } from "@/server/outbox/outbox";
import type { Actor } from "@/server/policy/actor";
import { canExportDiary, type EnrolmentContext } from "@/server/policy/policy";

const STANDARD_ARTIFACT_DAYS = 7;

export interface DiaryExportAttachmentSnapshot {
  id: string;
  displayName: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  objectKey: string;
}

export interface DiaryExportEntrySnapshot {
  id: string;
  title: string;
  activityDate: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  entryType: { code: string; label: string } | null;
  body: unknown;
  bodyText: string;
  objectives: Array<{
    stableId: string;
    code: string;
    title: string;
    domainCode: string;
    domainTitle: string;
  }>;
  links: Array<{
    type: string;
    url: string;
    label: string | null;
    description: string | null;
  }>;
  attachments: DiaryExportAttachmentSnapshot[];
}

export interface DiaryExportSnapshot {
  schemaVersion: "1.0.0";
  snapshotAt: string;
  fellow: { displayName: string };
  fellowship: {
    programme: string;
    cohort: string;
    startsOn: string | null;
    endsOn: string | null;
  };
  entries: DiaryExportEntrySnapshot[];
}

export class DiaryExportValidationError extends Error {
  constructor(
    public readonly code: "attachments_not_ready",
    public readonly attachmentNames: string[],
  ) {
    super("Every retained attachment must be clean and available before exporting.");
  }
}

export async function createDiaryExportJob(
  tx: Db,
  actor: Actor,
  enrolment: EnrolmentContext,
  input: { kind: "standard" | "final"; finishCycle?: number },
): Promise<{ id: string; artifactExpiresAt: Date }> {
  if (!canExportDiary(actor, enrolment).allow) {
    throw new Error("denied");
  }

  const snapshot = await buildDiaryExportSnapshot(tx, enrolment);
  const now = new Date();
  const artifactExpiresAt =
    input.kind === "final" && enrolment.diaryAccessEndsAt
      ? enrolment.diaryAccessEndsAt
      : new Date(now.getTime() + STANDARD_ARTIFACT_DAYS * 24 * 60 * 60 * 1000);
  const id = uuidv7();

  await tx.insert(exportJob).values({
    id,
    tenantId: enrolment.tenantId,
    enrolmentId: enrolment.id,
    requestedBy: actor.userId,
    kind: input.kind,
    finishCycle: input.finishCycle ?? null,
    snapshotJson: snapshot,
    artifactExpiresAt,
  });
  await enqueue(tx, "generate_diary_export", { exportJobId: id });
  // Final artifacts are removed by the purge workflow. Scheduling an
  // independent expiry at the same instant could expire the only final copy
  // before the purge worker verifies that it was generated successfully.
  if (input.kind === "standard") {
    await enqueue(tx, "expire_diary_export", { exportJobId: id }, artifactExpiresAt);
  }
  return { id, artifactExpiresAt };
}

export async function buildDiaryExportSnapshot(
  tx: Db,
  enrolment: EnrolmentContext,
): Promise<DiaryExportSnapshot> {
  const metadataRows = await tx
    .select({
      displayName: appUser.displayName,
      programmeName: programme.name,
      cohortName: cohort.name,
      startsOn: enrolmentTable.startsOn,
      endsOn: enrolmentTable.endsOn,
    })
    .from(enrolmentTable)
    .innerJoin(appUser, eq(enrolmentTable.fellowUserId, appUser.id))
    .innerJoin(cohort, eq(enrolmentTable.cohortId, cohort.id))
    .innerJoin(programme, eq(cohort.programmeId, programme.id))
    .where(
      and(
        eq(enrolmentTable.id, enrolment.id),
        eq(enrolmentTable.tenantId, enrolment.tenantId),
      ),
    )
    .limit(1);
  const metadata = metadataRows[0];
  if (!metadata) throw new Error("Diary enrolment no longer exists.");

  const entries = await tx
    .select({
      id: evidenceItem.id,
      title: evidenceItem.title,
      activityDate: evidenceItem.activityDate,
      archivedAt: evidenceItem.archivedAt,
      createdAt: evidenceItem.createdAt,
      updatedAt: evidenceItem.updatedAt,
      typeCode: evidenceType.stableCode,
      typeLabel: evidenceType.label,
      body: evidenceItem.narrativeDoc,
      bodyText: evidenceItem.narrativeText,
    })
    .from(evidenceItem)
    .leftJoin(evidenceType, eq(evidenceItem.evidenceTypeId, evidenceType.id))
    .where(
      and(
        eq(evidenceItem.tenantId, enrolment.tenantId),
        eq(evidenceItem.enrolmentId, enrolment.id),
        isNull(evidenceItem.deletedAt),
      ),
    )
    .orderBy(asc(evidenceItem.activityDate), asc(evidenceItem.createdAt));

  const entryIds = entries.map((entry) => entry.id);
  const [objectiveRows, linkRows, attachmentRows] = entryIds.length
    ? await Promise.all([
        tx
          .select({
            evidenceItemId: evidenceObjective.evidenceItemId,
            stableId: objective.stableId,
            code: objective.code,
            title: objective.title,
            domainCode: domain.code,
            domainTitle: domain.title,
          })
          .from(evidenceObjective)
          .innerJoin(objective, eq(evidenceObjective.objectiveId, objective.id))
          .innerJoin(domain, eq(objective.domainId, domain.id))
          .where(
            and(
              inArray(evidenceObjective.evidenceItemId, entryIds),
              isNull(evidenceObjective.validTo),
            ),
          ),
        tx
          .select({
            evidenceItemId: externalLink.evidenceItemId,
            type: externalLink.linkType,
            url: externalLink.url,
            label: externalLink.label,
            description: externalLink.description,
          })
          .from(externalLink)
          .where(
            and(
              inArray(externalLink.evidenceItemId, entryIds),
              isNull(externalLink.deletedAt),
            ),
          ),
        tx
          .select({
            parentId: attachment.parentId,
            id: attachment.id,
            displayName: attachment.displayName,
            mediaType: attachment.mediaTypeDetected,
            sizeBytes: attachment.sizeBytes,
            sha256: attachment.sha256,
            objectKey: attachment.objectKey,
            scanStatus: attachment.scanStatus,
          })
          .from(attachment)
          .where(
            and(
              eq(attachment.tenantId, enrolment.tenantId),
              eq(attachment.parentType, "evidence_item"),
              inArray(attachment.parentId, entryIds),
              isNull(attachment.deletedAt),
            ),
          ),
      ])
    : [[], [], []];

  const unavailable = attachmentRows.filter(
    (file) => file.scanStatus !== "clean" || !file.sha256 || !file.mediaType,
  );
  if (unavailable.length) {
    throw new DiaryExportValidationError(
      "attachments_not_ready",
      unavailable.map((file) => file.displayName),
    );
  }

  return {
    schemaVersion: "1.0.0",
    snapshotAt: new Date().toISOString(),
    fellow: { displayName: metadata.displayName },
    fellowship: {
      programme: metadata.programmeName,
      cohort: metadata.cohortName,
      startsOn: metadata.startsOn,
      endsOn: metadata.endsOn,
    },
    entries: entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      activityDate: entry.activityDate,
      archived: Boolean(entry.archivedAt),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      entryType:
        entry.typeCode && entry.typeLabel
          ? { code: entry.typeCode, label: entry.typeLabel }
          : null,
      body: entry.body,
      bodyText: entry.bodyText,
      objectives: objectiveRows
        .filter((row) => row.evidenceItemId === entry.id)
        .map((row) => ({
          stableId: row.stableId,
          code: row.code,
          title: row.title,
          domainCode: row.domainCode,
          domainTitle: row.domainTitle,
        })),
      links: linkRows
        .filter((row) => row.evidenceItemId === entry.id)
        .map((row) => ({
          type: row.type,
          url: row.url,
          label: row.label,
          description: row.description,
        })),
      attachments: attachmentRows
        .filter((file) => file.parentId === entry.id)
        .map((file) => ({
          id: file.id,
          displayName: file.displayName,
          mediaType: file.mediaType!,
          sizeBytes: file.sizeBytes,
          sha256: file.sha256!,
          objectKey: file.objectKey,
        })),
    })),
  };
}

export function toPortableDiaryJson(snapshot: DiaryExportSnapshot) {
  return {
    schemaVersion: snapshot.schemaVersion,
    exportedAt: snapshot.snapshotAt,
    fellow: snapshot.fellow,
    fellowship: snapshot.fellowship,
    entries: snapshot.entries.map((entry) => ({
      ...entry,
      attachments: entry.attachments.map((file) => ({
        id: file.id,
        displayName: file.displayName,
        mediaType: file.mediaType,
        sizeBytes: file.sizeBytes,
        sha256: file.sha256,
      })),
    })),
  };
}
