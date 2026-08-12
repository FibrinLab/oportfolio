import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateFrameworkPackage } from "@/server/framework/validate";

// Framework/package rejection cases (spec/15:181): unsupported schema,
// duplicate ID, dangling mapping, script/HTML string, invalid URL — plus the
// canonical FCAI v3.2 counts.

const packagePath = path.join(process.cwd(), "spec/frameworks/fcai/v3.2/framework.json");
const rawJson = readFileSync(packagePath, "utf8");
const basePackage = () => JSON.parse(rawJson);

describe("validateFrameworkPackage — FCAI v3.2", () => {
  it("accepts the bundled package with exactly the declared counts", () => {
    const result = validateFrameworkPackage(rawJson);
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.counts).toEqual({
      domains: 5,
      objectives: 30,
      deliveryMethods: 4,
      duties: 7,
      externalFrameworks: 4,
      crossMappings: 48,
    });
  });

  it("published cross-mappings stay domain-level (spec/15)", () => {
    const pkg = basePackage();
    const levels = new Set(pkg.crossMappings.map((m: { sourceLevel: string }) => m.sourceLevel));
    expect(levels).toEqual(new Set(["domain"]));
  });
});

describe("validateFrameworkPackage — rejections", () => {
  it("rejects an unsupported schema version", () => {
    const pkg = basePackage();
    pkg.schemaVersion = "9.9.9";
    const result = validateFrameworkPackage(JSON.stringify(pkg));
    expect(result.valid).toBe(false);
  });

  it("rejects duplicate objective stable IDs", () => {
    const pkg = basePackage();
    pkg.domains[1].objectives[0].stableId = pkg.domains[0].objectives[0].stableId;
    const result = validateFrameworkPackage(JSON.stringify(pkg));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("Duplicate objective"))).toBe(true);
  });

  it("rejects dangling cross-mapping targets", () => {
    const pkg = basePackage();
    pkg.crossMappings[0].targetNodeStableId = "does.not.exist";
    const result = validateFrameworkPackage(JSON.stringify(pkg));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("Unknown target node"))).toBe(true);
  });

  it("rejects script/HTML strings anywhere in the package", () => {
    // The JSON Schema's plainText pattern catches this first; the semantic
    // active-content check is the second layer. Either way it must fail.
    const pkg = basePackage();
    pkg.domains[0].objectives[0].title = "Learn <script>alert(1)</script> basics";
    const result = validateFrameworkPackage(JSON.stringify(pkg));
    expect(result.valid).toBe(false);

    // A string that passes the schema pattern but is still active content is
    // caught by the semantic layer.
    const pkg2 = basePackage();
    pkg2.domains[0].objectives[0].title = "Learn about onload=stealth attributes";
    const result2 = validateFrameworkPackage(JSON.stringify(pkg2));
    expect(result2.valid).toBe(false);
    expect(result2.issues.some((i) => i.message.includes("active content"))).toBe(true);
  });

  it("rejects javascript: URLs disguised as text", () => {
    const pkg = basePackage();
    pkg.duties[0].description = "javascript:alert(document.cookie)";
    const result = validateFrameworkPackage(JSON.stringify(pkg));
    expect(result.valid).toBe(false);
  });

  it("rejects non-HTTPS source URLs", () => {
    const pkg = basePackage();
    pkg.release.sourceUrl = "http://insecure.example.org/doc.pdf";
    const result = validateFrameworkPackage(JSON.stringify(pkg));
    expect(result.valid).toBe(false);
  });

  it("rejects malformed JSON", () => {
    const result = validateFrameworkPackage("{not json");
    expect(result.valid).toBe(false);
  });

  it("rejects unknown delivery method references", () => {
    const pkg = basePackage();
    pkg.domains[0].deliveryMethodRefs = ["fcai.delivery.nonexistent"];
    const result = validateFrameworkPackage(JSON.stringify(pkg));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("Unknown delivery method"))).toBe(true);
  });
});
