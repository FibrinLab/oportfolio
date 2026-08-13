import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020";
import addFormats from "ajv-formats";

// Framework package validation (spec/07:126-139): JSON Schema first, then
// semantic checks. Errors carry JSON pointers for the import preview.

export interface FrameworkPackage {
  schemaVersion: string;
  framework: {
    namespace: string;
    title: string;
    publisher: string;
    description: string;
    canonicalUrl?: string;
  };
  release: {
    version: string;
    label: string;
    publicationYear: number;
    effectiveFrom?: string | null;
    sourceUrl: string;
    sourceDocumentLabel: string;
    status: string;
    locale?: string;
    verificationNote: string;
    releaseNotes?: string;
  };
  domains: Array<{
    stableId: string;
    code: string;
    title: string;
    description?: string;
    sortOrder: number;
    deliveryMethodRefs: string[];
    objectives: Array<{
      stableId: string;
      code: string;
      title: string;
      sourceText: string;
      sortOrder: number;
    }>;
  }>;
  deliveryMethods: Array<TaxonomyItem>;
  duties: Array<TaxonomyItem>;
  externalFrameworks: Array<{
    namespace: string;
    title: string;
    publisher: string;
    version: string;
    sourceUrl?: string;
    mappingAvailability: string;
    notes?: string;
    nodes: Array<{ stableId: string; code: string; title: string; parentStableId?: string }>;
  }>;
  crossMappings: Array<{
    sourceLevel: "domain" | "objective";
    sourceStableId: string;
    targetFrameworkNamespace: string;
    targetNodeStableId: string;
    relationship: "exact" | "broader" | "narrower" | "related";
    provenance: "published" | "faculty_authored" | "imported";
    verificationStatus: "verified_against_source" | "unverified" | "deprecated";
    citation: string;
  }>;
}

interface TaxonomyItem {
  stableId: string;
  code: string;
  title: string;
  description: string;
  sortOrder: number;
}

export interface ValidationIssue {
  pointer: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  packageSha256: string;
  counts: {
    domains: number;
    objectives: number;
    deliveryMethods: number;
    duties: number;
    externalFrameworks: number;
    crossMappings: number;
  } | null;
  package: FrameworkPackage | null;
}

const SUPPORTED_SCHEMA_VERSIONS = new Set(["1.0.0"]);

// No active content anywhere in package strings (spec/07).
const ACTIVE_CONTENT = /<\s*[a-z!/]|javascript:|on\w+\s*=/i;
 
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

let compiledSchema: ReturnType<Ajv2020["compile"]> | null = null;

function getSchema() {
  if (!compiledSchema) {
    const schemaPath = path.join(process.cwd(), "spec", "schemas", "framework.schema.json");
    const schemaJson = JSON.parse(readFileSync(schemaPath, "utf8"));
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    compiledSchema = ajv.compile(schemaJson);
  }
  return compiledSchema;
}

export function validateFrameworkPackage(rawJson: string): ValidationResult {
  const packageSha256 = createHash("sha256").update(rawJson).digest("hex");
  const issues: ValidationIssue[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    return {
      valid: false,
      issues: [{ pointer: "", message: `Not valid JSON: ${(error as Error).message}` }],
      packageSha256,
      counts: null,
      package: null,
    };
  }

  const schema = getSchema();
  if (!schema(parsed)) {
    for (const error of schema.errors ?? []) {
      issues.push({ pointer: error.instancePath || "/", message: error.message ?? "invalid" });
    }
    return { valid: false, issues, packageSha256, counts: null, package: null };
  }

  const pkg = parsed as FrameworkPackage;

  if (!SUPPORTED_SCHEMA_VERSIONS.has(pkg.schemaVersion)) {
    issues.push({ pointer: "/schemaVersion", message: `Unsupported schema version ${pkg.schemaVersion}` });
  }

  // Every string in the package must be inert.
  walkStrings(pkg, "", (value, pointer) => {
    if (ACTIVE_CONTENT.test(value)) {
      issues.push({ pointer, message: "String contains active content (HTML/script)" });
    }
    if (CONTROL_CHARS.test(value)) {
      issues.push({ pointer, message: "String contains control characters" });
    }
  });

  // HTTPS-only URLs (the JSON Schema already patterns most; re-check all).
  for (const [pointer, url] of collectUrls(pkg)) {
    if (!/^https:\/\//.test(url)) {
      issues.push({ pointer, message: "URLs must use https" });
    }
  }

  // Unique stable IDs and codes.
  const domainIds = new Map<string, string>();
  const objectiveIds = new Map<string, string>();
  const deliveryIds = new Set(pkg.deliveryMethods.map((d) => d.stableId));
  checkUnique(pkg.deliveryMethods.map((d, i) => [d.stableId, `/deliveryMethods/${i}/stableId`]), issues);
  checkUnique(pkg.duties.map((d, i) => [d.stableId, `/duties/${i}/stableId`]), issues);

  pkg.domains.forEach((dom, di) => {
    if (domainIds.has(dom.stableId)) {
      issues.push({ pointer: `/domains/${di}/stableId`, message: `Duplicate domain stable ID ${dom.stableId}` });
    }
    domainIds.set(dom.stableId, `/domains/${di}`);
    dom.deliveryMethodRefs.forEach((ref, ri) => {
      if (!deliveryIds.has(ref)) {
        issues.push({
          pointer: `/domains/${di}/deliveryMethodRefs/${ri}`,
          message: `Unknown delivery method ${ref}`,
        });
      }
    });
    dom.objectives.forEach((obj, oi) => {
      if (objectiveIds.has(obj.stableId)) {
        issues.push({
          pointer: `/domains/${di}/objectives/${oi}/stableId`,
          message: `Duplicate objective stable ID ${obj.stableId}`,
        });
      }
      objectiveIds.set(obj.stableId, `/domains/${di}/objectives/${oi}`);
      // Stable IDs must not contain the release version (spec/05).
      if (obj.stableId.includes(pkg.release.version)) {
        issues.push({
          pointer: `/domains/${di}/objectives/${oi}/stableId`,
          message: "Stable IDs must not contain the release version",
        });
      }
    });
  });

  // External frameworks + nodes.
  const externalNodes = new Map<string, Set<string>>();
  pkg.externalFrameworks.forEach((ext, ei) => {
    if (externalNodes.has(ext.namespace)) {
      issues.push({
        pointer: `/externalFrameworks/${ei}/namespace`,
        message: `Duplicate external framework namespace ${ext.namespace}`,
      });
    }
    const nodes = new Set<string>();
    ext.nodes.forEach((node, ni) => {
      if (nodes.has(node.stableId)) {
        issues.push({
          pointer: `/externalFrameworks/${ei}/nodes/${ni}/stableId`,
          message: `Duplicate node stable ID ${node.stableId}`,
        });
      }
      nodes.add(node.stableId);
    });
    ext.nodes.forEach((node, ni) => {
      if (node.parentStableId && !nodes.has(node.parentStableId)) {
        issues.push({
          pointer: `/externalFrameworks/${ei}/nodes/${ni}/parentStableId`,
          message: `Unknown parent node ${node.parentStableId}`,
        });
      }
    });
    externalNodes.set(ext.namespace, nodes);
  });

  // Cross-mappings: source and target must resolve; level must be explicit.
  pkg.crossMappings.forEach((mapping, mi) => {
    const sourceKnown =
      mapping.sourceLevel === "domain"
        ? domainIds.has(mapping.sourceStableId)
        : objectiveIds.has(mapping.sourceStableId);
    if (!sourceKnown) {
      issues.push({
        pointer: `/crossMappings/${mi}/sourceStableId`,
        message: `Unknown ${mapping.sourceLevel} ${mapping.sourceStableId}`,
      });
    }
    const targetNodes = externalNodes.get(mapping.targetFrameworkNamespace);
    if (!targetNodes) {
      issues.push({
        pointer: `/crossMappings/${mi}/targetFrameworkNamespace`,
        message: `Unknown external framework ${mapping.targetFrameworkNamespace}`,
      });
    } else if (!targetNodes.has(mapping.targetNodeStableId)) {
      issues.push({
        pointer: `/crossMappings/${mi}/targetNodeStableId`,
        message: `Unknown target node ${mapping.targetNodeStableId}`,
      });
    }
  });

  const counts = {
    domains: pkg.domains.length,
    objectives: pkg.domains.reduce((sum, d) => sum + d.objectives.length, 0),
    deliveryMethods: pkg.deliveryMethods.length,
    duties: pkg.duties.length,
    externalFrameworks: pkg.externalFrameworks.length,
    crossMappings: pkg.crossMappings.length,
  };

  return {
    valid: issues.length === 0,
    issues,
    packageSha256,
    counts,
    package: issues.length === 0 ? pkg : null,
  };
}

function checkUnique(entries: Array<[string, string]>, issues: ValidationIssue[]) {
  const seen = new Set<string>();
  for (const [value, pointer] of entries) {
    if (seen.has(value)) {
      issues.push({ pointer, message: `Duplicate stable ID ${value}` });
    }
    seen.add(value);
  }
}

function walkStrings(
  value: unknown,
  pointer: string,
  visit: (value: string, pointer: string) => void,
): void {
  if (typeof value === "string") {
    visit(value, pointer || "/");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, `${pointer}/${index}`, visit));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walkStrings(child, `${pointer}/${key}`, visit);
    }
  }
}

function collectUrls(pkg: FrameworkPackage): Array<[string, string]> {
  const urls: Array<[string, string]> = [];
  if (pkg.framework.canonicalUrl) urls.push(["/framework/canonicalUrl", pkg.framework.canonicalUrl]);
  urls.push(["/release/sourceUrl", pkg.release.sourceUrl]);
  pkg.externalFrameworks.forEach((ext, i) => {
    if (ext.sourceUrl) urls.push([`/externalFrameworks/${i}/sourceUrl`, ext.sourceUrl]);
  });
  return urls;
}
