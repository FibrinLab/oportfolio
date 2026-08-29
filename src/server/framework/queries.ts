import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  cohort,
  crossMapping,
  domain,
  enrolment,
  externalFramework,
  externalNode,
  framework,
  frameworkRelease,
  objective,
  programme,
} from "@/server/db/schema";
import type { Actor } from "@/server/policy/actor";
import { canReadCurriculum, type EnrolmentContext } from "@/server/policy/policy";

// Curriculum reads join ONLY through enrolment.framework_release_id — the
// pinned release. Publishing a later release never changes what an enrolled
// fellow sees (FR-FW-003, AC-01).

export async function loadEnrolmentContext(
  tenantId: string,
  enrolmentId: string,
): Promise<(EnrolmentContext & { frameworkReleaseId: string | null }) | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: enrolment.id,
      tenantId: enrolment.tenantId,
      fellowUserId: enrolment.fellowUserId,
      cohortId: enrolment.cohortId,
      programmeId: cohort.programmeId,
      frameworkReleaseId: enrolment.frameworkReleaseId,
      diaryState: enrolment.diaryState,
      diaryFinishCycle: enrolment.diaryFinishCycle,
      diaryAccessEndsAt: enrolment.diaryAccessEndsAt,
    })
    .from(enrolment)
    .innerJoin(cohort, eq(enrolment.cohortId, cohort.id))
    // Tenant filter FIRST — cross-tenant ids resolve to nothing (spec/12).
    .where(and(eq(enrolment.tenantId, tenantId), eq(enrolment.id, enrolmentId)))
    .limit(1);
  return rows[0] ?? null;
}

export interface ReleaseBanner {
  releaseId: string;
  frameworkTitle: string;
  publisher: string;
  version: string;
  label: string | null;
  status: string;
  sourceUrl: string;
  sourceDocumentLabel: string | null;
  publishedOn: string | null;
}

export interface CurriculumDomain {
  id: string;
  stableId: string;
  code: string;
  title: string;
  description: string | null;
  sortOrder: number;
  objectives: Array<{
    id: string;
    stableId: string;
    code: string;
    title: string;
    sourceText: string;
    sortOrder: number;
  }>;
}

export interface Curriculum {
  release: ReleaseBanner;
  domains: CurriculumDomain[];
}

export async function getCurriculumForEnrolment(
  actor: Actor,
  enrolmentContext: EnrolmentContext & { frameworkReleaseId?: string | null },
): Promise<Curriculum | null> {
  const decision = canReadCurriculum(actor, enrolmentContext);
  if (!decision.allow) return null;

  const releaseId = enrolmentContext.frameworkReleaseId;
  if (!releaseId) return null;

  const db = getDb();
  const releases = await db
    .select({
      releaseId: frameworkRelease.id,
      frameworkTitle: framework.title,
      publisher: framework.publisher,
      version: frameworkRelease.version,
      label: frameworkRelease.label,
      status: frameworkRelease.status,
      sourceUrl: frameworkRelease.sourceUrl,
      sourceDocumentLabel: frameworkRelease.sourceDocumentLabel,
      publishedOn: frameworkRelease.publishedOn,
    })
    .from(frameworkRelease)
    .innerJoin(framework, eq(frameworkRelease.frameworkId, framework.id))
    .where(eq(frameworkRelease.id, releaseId))
    .limit(1);
  const release = releases[0];
  if (!release) return null;

  const domains = await db
    .select()
    .from(domain)
    .where(eq(domain.frameworkReleaseId, releaseId))
    .orderBy(asc(domain.sortOrder));

  const objectives = await db
    .select()
    .from(objective)
    .where(eq(objective.frameworkReleaseId, releaseId))
    .orderBy(asc(objective.sortOrder));

  return {
    release,
    domains: domains.map((d) => ({
      id: d.id,
      stableId: d.stableId,
      code: d.code,
      title: d.title,
      description: d.description,
      sortOrder: d.sortOrder,
      objectives: objectives
        .filter((o) => o.domainId === d.id)
        .map((o) => ({
          id: o.id,
          stableId: o.stableId,
          code: o.code,
          title: o.title,
          sourceText: o.sourceText,
          sortOrder: o.sortOrder,
        })),
    })),
  };
}

export interface ObjectiveDetail {
  release: ReleaseBanner;
  domain: { id: string; code: string; title: string };
  objective: {
    id: string;
    stableId: string;
    code: string;
    title: string;
    sourceText: string;
  };
  externalMappings: Array<{
    level: "domain" | "objective";
    relationship: string;
    provenance: string;
    verificationStatus: string;
    citation: string | null;
    targetFramework: string;
    targetFrameworkVersion: string;
    targetNodeCode: string;
    targetNodeTitle: string;
    mappingAvailability: string;
  }>;
}

export async function getObjectiveDetail(
  actor: Actor,
  enrolmentContext: EnrolmentContext & { frameworkReleaseId?: string | null },
  objectiveId: string,
): Promise<ObjectiveDetail | null> {
  const decision = canReadCurriculum(actor, enrolmentContext);
  if (!decision.allow) return null;
  const releaseId = enrolmentContext.frameworkReleaseId;
  if (!releaseId) return null;

  const db = getDb();
  const rows = await db
    .select({
      objectiveId: objective.id,
      objectiveStableId: objective.stableId,
      objectiveCode: objective.code,
      objectiveTitle: objective.title,
      sourceText: objective.sourceText,
      domainId: domain.id,
      domainCode: domain.code,
      domainTitle: domain.title,
      domainStableId: domain.stableId,
    })
    .from(objective)
    .innerJoin(domain, eq(objective.domainId, domain.id))
    // Pinned-release filter first: an objective id from another release 404s.
    .where(and(eq(objective.frameworkReleaseId, releaseId), eq(objective.id, objectiveId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const releases = await db
    .select({
      releaseId: frameworkRelease.id,
      frameworkTitle: framework.title,
      publisher: framework.publisher,
      version: frameworkRelease.version,
      label: frameworkRelease.label,
      status: frameworkRelease.status,
      sourceUrl: frameworkRelease.sourceUrl,
      sourceDocumentLabel: frameworkRelease.sourceDocumentLabel,
      publishedOn: frameworkRelease.publishedOn,
    })
    .from(frameworkRelease)
    .innerJoin(framework, eq(frameworkRelease.frameworkId, framework.id))
    .where(eq(frameworkRelease.id, releaseId))
    .limit(1);
  const release = releases[0];
  if (!release) return null;

  // Objective-level mappings for this objective plus domain-level mappings
  // for its domain — always labelled with their level (FR-FW-008).
  const mappings = await db
    .select({
      sourceLevel: crossMapping.sourceLevel,
      sourceId: crossMapping.sourceId,
      relationship: crossMapping.relationship,
      provenance: crossMapping.provenance,
      verificationStatus: crossMapping.verificationStatus,
      citation: crossMapping.citation,
      targetNodeCode: externalNode.code,
      targetNodeTitle: externalNode.title,
      targetFramework: externalFramework.title,
      targetFrameworkVersion: externalFramework.version,
      mappingAvailability: externalFramework.mappingAvailability,
    })
    .from(crossMapping)
    .innerJoin(externalNode, eq(crossMapping.targetNodeId, externalNode.id))
    .innerJoin(externalFramework, eq(externalNode.externalFrameworkId, externalFramework.id))
    .where(eq(crossMapping.sourceReleaseId, releaseId));

  const relevant = mappings.filter(
    (m) =>
      (m.sourceLevel === "objective" && m.sourceId === row.objectiveId) ||
      (m.sourceLevel === "domain" && m.sourceId === row.domainId),
  );

  return {
    release,
    domain: { id: row.domainId, code: row.domainCode, title: row.domainTitle },
    objective: {
      id: row.objectiveId,
      stableId: row.objectiveStableId,
      code: row.objectiveCode,
      title: row.objectiveTitle,
      sourceText: row.sourceText,
    },
    externalMappings: relevant.map((m) => ({
      level: m.sourceLevel,
      relationship: m.relationship,
      provenance: m.provenance,
      verificationStatus: m.verificationStatus,
      citation: m.citation,
      targetFramework: m.targetFramework,
      targetFrameworkVersion: m.targetFrameworkVersion,
      targetNodeCode: m.targetNodeCode,
      targetNodeTitle: m.targetNodeTitle,
      mappingAvailability: m.mappingAvailability,
    })),
  };
}

// The fellow's own active enrolment in a tenant (most pages start here).
export async function getOwnEnrolment(
  actor: Actor,
  tenantId: string,
): Promise<(EnrolmentContext & { frameworkReleaseId: string | null }) | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: enrolment.id,
      tenantId: enrolment.tenantId,
      fellowUserId: enrolment.fellowUserId,
      cohortId: enrolment.cohortId,
      programmeId: cohort.programmeId,
      frameworkReleaseId: enrolment.frameworkReleaseId,
      diaryState: enrolment.diaryState,
      diaryFinishCycle: enrolment.diaryFinishCycle,
      diaryAccessEndsAt: enrolment.diaryAccessEndsAt,
    })
    .from(enrolment)
    .innerJoin(cohort, eq(enrolment.cohortId, cohort.id))
    .innerJoin(programme, eq(cohort.programmeId, programme.id))
    .where(and(eq(enrolment.tenantId, tenantId), eq(enrolment.fellowUserId, actor.userId)))
    .limit(1);
  return rows[0] ?? null;
}
