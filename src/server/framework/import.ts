import { eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Db } from "@/server/db/client";
import {
  crossMapping,
  deliveryMethod,
  domain,
  domainDeliveryMethod,
  externalFramework,
  externalNode,
  framework,
  frameworkRelease,
  objective,
} from "@/server/db/schema";
import { appendAudit } from "@/server/audit/audit";
import type { FrameworkPackage, ValidationResult } from "./validate";

// Transactional import of a validated package (spec/07). The release lands as
// `validated`; publishing is a separate explicit transition after preview
// (spec/04 §7). Published releases are immutable (ADR-001) — enforced by a
// database trigger added in the framework migration.

export interface ImportInput {
  validation: ValidationResult;
  // Bundled public frameworks (fcai) have no tenant; audit still needs one —
  // the acting tenant for CLI imports is the operating tenant, nullable for
  // bootstrap seeding.
  auditTenantId?: string | null;
  actorUserId?: string | null;
  requestId?: string | null;
}

export interface ImportResult {
  frameworkId: string;
  releaseId: string;
  created: boolean;
}

export async function importFrameworkPackage(
  db: Db,
  input: ImportInput,
): Promise<ImportResult> {
  if (!input.validation.valid || !input.validation.package) {
    throw new Error("Cannot import an invalid package");
  }
  const pkg: FrameworkPackage = input.validation.package;

  return db.transaction(async (tx) => {
    // Framework row (global namespace).
    let frameworkId: string;
    const existingFramework = await tx
      .select({ id: framework.id })
      .from(framework)
      .where(eq(framework.namespace, pkg.framework.namespace))
      .limit(1);
    if (existingFramework[0]) {
      frameworkId = existingFramework[0].id;
    } else {
      frameworkId = uuidv7();
      await tx.insert(framework).values({
        id: frameworkId,
        tenantId: null,
        namespace: pkg.framework.namespace,
        title: pkg.framework.title,
        publisher: pkg.framework.publisher,
        canonicalUrl: pkg.framework.canonicalUrl,
        description: pkg.framework.description,
      });
    }

    // Re-importing the same (namespace, version) is rejected once published;
    // a draft/validated release is replaced in full.
    const existingRelease = await tx
      .select({ id: frameworkRelease.id, status: frameworkRelease.status })
      .from(frameworkRelease)
      .where(
        sql`${frameworkRelease.frameworkId} = ${frameworkId} AND ${frameworkRelease.version} = ${pkg.release.version}`,
      )
      .limit(1);
    if (existingRelease[0]) {
      if (existingRelease[0].status === "published") {
        throw new Error(
          `Release ${pkg.framework.namespace}@${pkg.release.version} is published and immutable; corrections require a new release (ADR-001).`,
        );
      }
      await deleteReleaseContents(tx, existingRelease[0].id);
      await tx.delete(frameworkRelease).where(eq(frameworkRelease.id, existingRelease[0].id));
    }

    const releaseId = uuidv7();
    await tx.insert(frameworkRelease).values({
      id: releaseId,
      frameworkId,
      version: pkg.release.version,
      status: "validated",
      label: pkg.release.label,
      effectiveFrom: pkg.release.effectiveFrom ?? null,
      sourceUrl: pkg.release.sourceUrl,
      sourceDocumentLabel: pkg.release.sourceDocumentLabel,
      packageSha256: input.validation.packageSha256,
      schemaVersion: pkg.schemaVersion,
      locale: pkg.release.locale ?? "en-GB",
      verificationNote: pkg.release.verificationNote,
      releaseNotes: pkg.release.releaseNotes,
    });

    // Delivery methods.
    const deliveryIdByStable = new Map<string, string>();
    for (const item of pkg.deliveryMethods) {
      const id = uuidv7();
      deliveryIdByStable.set(item.stableId, id);
      await tx.insert(deliveryMethod).values({
        id,
        frameworkReleaseId: releaseId,
        stableId: item.stableId,
        code: item.code,
        title: item.title,
        description: item.description,
        sortOrder: item.sortOrder,
      });
    }

    // Domains + objectives.
    const domainIdByStable = new Map<string, string>();
    const objectiveIdByStable = new Map<string, string>();
    for (const dom of pkg.domains) {
      const domainId = uuidv7();
      domainIdByStable.set(dom.stableId, domainId);
      await tx.insert(domain).values({
        id: domainId,
        frameworkReleaseId: releaseId,
        stableId: dom.stableId,
        code: dom.code,
        title: dom.title,
        description: dom.description,
        sortOrder: dom.sortOrder,
      });
      for (const ref of dom.deliveryMethodRefs) {
        await tx.insert(domainDeliveryMethod).values({
          domainId,
          deliveryMethodId: deliveryIdByStable.get(ref)!,
        });
      }
      for (const obj of dom.objectives) {
        const objectiveId = uuidv7();
        objectiveIdByStable.set(obj.stableId, objectiveId);
        await tx.insert(objective).values({
          id: objectiveId,
          frameworkReleaseId: releaseId,
          domainId,
          stableId: obj.stableId,
          code: obj.code,
          title: obj.title,
          sourceText: obj.sourceText,
          sortOrder: obj.sortOrder,
        });
      }
    }

    // External frameworks + nodes.
    const nodeIdByNamespaceAndStable = new Map<string, string>();
    for (const ext of pkg.externalFrameworks) {
      const externalFrameworkId = uuidv7();
      await tx.insert(externalFramework).values({
        id: externalFrameworkId,
        frameworkReleaseId: releaseId,
        namespace: ext.namespace,
        title: ext.title,
        publisher: ext.publisher,
        version: ext.version,
        sourceUrl: ext.sourceUrl,
        mappingAvailability: ext.mappingAvailability,
        notes: ext.notes,
      });
      // Two passes: create nodes, then wire parents.
      const nodeIds = new Map<string, string>();
      for (const node of ext.nodes) {
        const nodeId = uuidv7();
        nodeIds.set(node.stableId, nodeId);
        nodeIdByNamespaceAndStable.set(`${ext.namespace}:${node.stableId}`, nodeId);
        await tx.insert(externalNode).values({
          id: nodeId,
          externalFrameworkId,
          stableId: node.stableId,
          code: node.code,
          title: node.title,
        });
      }
      for (const node of ext.nodes) {
        if (node.parentStableId) {
          await tx
            .update(externalNode)
            .set({ parentNodeId: nodeIds.get(node.parentStableId)! })
            .where(eq(externalNode.id, nodeIds.get(node.stableId)!));
        }
      }
    }

    // Cross-mappings.
    for (const mapping of pkg.crossMappings) {
      const sourceId =
        mapping.sourceLevel === "domain"
          ? domainIdByStable.get(mapping.sourceStableId)!
          : objectiveIdByStable.get(mapping.sourceStableId)!;
      await tx.insert(crossMapping).values({
        id: uuidv7(),
        sourceReleaseId: releaseId,
        sourceLevel: mapping.sourceLevel,
        sourceId,
        targetNodeId: nodeIdByNamespaceAndStable.get(
          `${mapping.targetFrameworkNamespace}:${mapping.targetNodeStableId}`,
        )!,
        relationship: mapping.relationship,
        provenance: mapping.provenance,
        verificationStatus: mapping.verificationStatus,
        citation: mapping.citation,
      });
    }

    if (input.auditTenantId) {
      await appendAudit(tx, {
        tenantId: input.auditTenantId,
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorUserId ? "user" : "system",
        action: "framework.validated",
        targetType: "framework_release",
        targetId: releaseId,
        requestId: input.requestId ?? null,
        metadata: {
          namespace: pkg.framework.namespace,
          version: pkg.release.version,
          packageSha256: input.validation.packageSha256,
          counts: input.validation.counts,
        },
      });
    }

    return { frameworkId, releaseId, created: true };
  });
}

export async function publishFrameworkRelease(
  db: Db,
  releaseId: string,
  input: { auditTenantId?: string | null; actorUserId?: string | null; requestId?: string | null },
): Promise<void> {
  await db.transaction(async (tx) => {
    const updated = await tx.execute(sql`
      UPDATE framework_release
      SET status = 'published', published_on = CURRENT_DATE,
          released_by = ${input.actorUserId ?? null}, released_at = now()
      WHERE id = ${releaseId} AND status = 'validated'
      RETURNING id
    `);
    if (updated.rows.length === 0) {
      throw new Error("Release not found or not in 'validated' state");
    }
    if (input.auditTenantId) {
      await appendAudit(tx, {
        tenantId: input.auditTenantId,
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorUserId ? "user" : "system",
        action: "framework.published",
        targetType: "framework_release",
        targetId: releaseId,
        requestId: input.requestId ?? null,
      });
    }
  });
}

async function deleteReleaseContents(tx: Db, releaseId: string): Promise<void> {
  await tx.execute(sql`DELETE FROM cross_mapping WHERE source_release_id = ${releaseId}`);
  await tx.execute(sql`
    DELETE FROM external_node WHERE external_framework_id IN
      (SELECT id FROM external_framework WHERE framework_release_id = ${releaseId})
  `);
  await tx.execute(sql`DELETE FROM external_framework WHERE framework_release_id = ${releaseId}`);
  await tx.execute(sql`
    DELETE FROM domain_delivery_method WHERE domain_id IN
      (SELECT id FROM domain WHERE framework_release_id = ${releaseId})
  `);
  await tx.execute(sql`DELETE FROM objective WHERE framework_release_id = ${releaseId}`);
  await tx.execute(sql`DELETE FROM delivery_method WHERE framework_release_id = ${releaseId}`);
  await tx.execute(sql`DELETE FROM domain WHERE framework_release_id = ${releaseId}`);
}
