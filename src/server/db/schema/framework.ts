import {
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { mutableColumns } from "./common";
import { tenant } from "./identity";

export const releaseStatus = pgEnum("release_status", [
  "draft",
  "validated",
  "published",
  "superseded",
  "retired",
]);
export const crossMappingLevel = pgEnum("cross_mapping_level", ["domain", "objective"]);
export const crossMappingRelationship = pgEnum("cross_mapping_relationship", [
  "exact",
  "broader",
  "narrower",
  "related",
]);
export const crossMappingProvenance = pgEnum("cross_mapping_provenance", [
  "published",
  "faculty_authored",
  "imported",
]);
export const crossMappingVerification = pgEnum("cross_mapping_verification", [
  "verified_against_source",
  "unverified",
  "deprecated",
]);

// tenant_id nullable: bundled public frameworks (fcai) belong to no tenant.
export const framework = pgTable(
  "framework",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenant.id),
    namespace: text("namespace").notNull(),
    title: text("title").notNull(),
    publisher: text("publisher").notNull(),
    canonicalUrl: text("canonical_url"),
    description: text("description"),
    ...mutableColumns,
  },
  (t) => [uniqueIndex("framework_namespace_unique").on(t.namespace)],
);

export const frameworkRelease = pgTable(
  "framework_release",
  {
    id: uuid("id").primaryKey(),
    frameworkId: uuid("framework_id")
      .notNull()
      .references(() => framework.id),
    version: text("version").notNull(),
    status: releaseStatus("status").notNull().default("draft"),
    label: text("label"),
    publishedOn: date("published_on"),
    effectiveFrom: date("effective_from"),
    sourceUrl: text("source_url").notNull(),
    sourceDocumentLabel: text("source_document_label"),
    sourceSha256: text("source_sha256"),
    packageSha256: text("package_sha256").notNull(),
    schemaVersion: text("schema_version").notNull(),
    locale: text("locale").notNull().default("en-GB"),
    verificationNote: text("verification_note"),
    releaseNotes: text("release_notes"),
    releasedBy: uuid("released_by"),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    supersedesReleaseId: uuid("supersedes_release_id"),
    ...mutableColumns,
  },
  (t) => [uniqueIndex("framework_release_version_unique").on(t.frameworkId, t.version)],
);

export const domain = pgTable(
  "domain",
  {
    id: uuid("id").primaryKey(),
    frameworkReleaseId: uuid("framework_release_id")
      .notNull()
      .references(() => frameworkRelease.id),
    stableId: text("stable_id").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [uniqueIndex("domain_release_stable_unique").on(t.frameworkReleaseId, t.stableId)],
);

export const objective = pgTable(
  "objective",
  {
    id: uuid("id").primaryKey(),
    frameworkReleaseId: uuid("framework_release_id")
      .notNull()
      .references(() => frameworkRelease.id),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domain.id),
    stableId: text("stable_id").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    sourceText: text("source_text").notNull(),
    sortOrder: integer("sort_order").notNull(),
    status: text("status").notNull().default("active"),
  },
  (t) => [
    uniqueIndex("objective_release_stable_unique").on(t.frameworkReleaseId, t.stableId),
    index("objective_domain_idx").on(t.domainId),
  ],
);

export const deliveryMethod = pgTable(
  "delivery_method",
  {
    id: uuid("id").primaryKey(),
    frameworkReleaseId: uuid("framework_release_id")
      .notNull()
      .references(() => frameworkRelease.id),
    stableId: text("stable_id").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [
    uniqueIndex("delivery_method_release_stable_unique").on(t.frameworkReleaseId, t.stableId),
  ],
);

export const domainDeliveryMethod = pgTable(
  "domain_delivery_method",
  {
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domain.id),
    deliveryMethodId: uuid("delivery_method_id")
      .notNull()
      .references(() => deliveryMethod.id),
  },
  (t) => [unique("domain_delivery_method_unique").on(t.domainId, t.deliveryMethodId)],
);

export const externalFramework = pgTable(
  "external_framework",
  {
    id: uuid("id").primaryKey(),
    frameworkReleaseId: uuid("framework_release_id")
      .notNull()
      .references(() => frameworkRelease.id),
    namespace: text("namespace").notNull(),
    title: text("title").notNull(),
    publisher: text("publisher").notNull(),
    version: text("version").notNull(),
    sourceUrl: text("source_url"),
    mappingAvailability: text("mapping_availability").notNull(),
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("external_framework_release_ns_unique").on(t.frameworkReleaseId, t.namespace),
  ],
);

export const externalNode = pgTable(
  "external_node",
  {
    id: uuid("id").primaryKey(),
    externalFrameworkId: uuid("external_framework_id")
      .notNull()
      .references(() => externalFramework.id),
    stableId: text("stable_id").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    parentNodeId: uuid("parent_node_id"),
  },
  (t) => [
    uniqueIndex("external_node_framework_stable_unique").on(t.externalFrameworkId, t.stableId),
    foreignKey({
      name: "external_node_parent_fk",
      columns: [t.parentNodeId],
      foreignColumns: [t.id],
    }),
  ],
);

export const crossMapping = pgTable(
  "cross_mapping",
  {
    id: uuid("id").primaryKey(),
    sourceReleaseId: uuid("source_release_id")
      .notNull()
      .references(() => frameworkRelease.id),
    sourceLevel: crossMappingLevel("source_level").notNull(),
    // Domain or objective id; a trigger validates it belongs to the stated
    // level and release (spec/05).
    sourceId: uuid("source_id").notNull(),
    targetNodeId: uuid("target_node_id")
      .notNull()
      .references(() => externalNode.id),
    relationship: crossMappingRelationship("relationship").notNull(),
    provenance: crossMappingProvenance("provenance").notNull(),
    verificationStatus: crossMappingVerification("verification_status").notNull(),
    citation: text("citation"),
    notes: text("notes"),
  },
  (t) => [index("cross_mapping_source_idx").on(t.sourceReleaseId, t.sourceLevel, t.sourceId)],
);
