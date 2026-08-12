import { readFileSync } from "node:fs";
import { getDb, getPool } from "@/server/db/client";
import { importFrameworkPackage, publishFrameworkRelease } from "@/server/framework/import";
import { validateFrameworkPackage } from "@/server/framework/validate";

// Usage: pnpm framework:import <path/to/framework.json> [--publish]
// Validates against spec/schemas/framework.schema.json plus semantic checks,
// imports as `validated`, and optionally publishes (immutable from then on).

async function main() {
  const args = process.argv.slice(2);
  const publish = args.includes("--publish");
  const filePath = args.find((a) => !a.startsWith("--"));
  if (!filePath) {
    console.error("Usage: pnpm framework:import <path/to/framework.json> [--publish]");
    process.exit(2);
  }

  const rawJson = readFileSync(filePath, "utf8");
  const validation = validateFrameworkPackage(rawJson);

  console.log(`Package SHA-256: ${validation.packageSha256}`);
  if (!validation.valid) {
    console.error(`VALIDATION FAILED (${validation.issues.length} issue(s)):`);
    for (const issue of validation.issues) {
      console.error(`  ${issue.pointer}: ${issue.message}`);
    }
    process.exit(1);
  }
  console.log(
    `Valid: ${validation.counts!.domains} domains, ${validation.counts!.objectives} objectives, ` +
      `${validation.counts!.deliveryMethods} delivery methods, ${validation.counts!.duties} duties, ` +
      `${validation.counts!.externalFrameworks} external frameworks, ${validation.counts!.crossMappings} cross-mappings.`,
  );

  const db = getDb();
  const result = await importFrameworkPackage(db, { validation });
  console.log(`Imported release ${result.releaseId} (status: validated).`);

  if (publish) {
    await publishFrameworkRelease(db, result.releaseId, {});
    console.log("Release published — now immutable and assignable.");
  } else {
    console.log("Not published. Re-run with --publish after faculty preview.");
  }

  await getPool().end();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
