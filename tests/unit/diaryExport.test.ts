import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  toPortableDiaryJson,
  type DiaryExportSnapshot,
} from "@/server/diary/export";
import { renderDiaryPdfToFile } from "@/server/diary/pdf";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

function snapshot(): DiaryExportSnapshot {
  return {
    schemaVersion: "1.0.0",
    snapshotAt: "2026-08-28T12:00:00.000Z",
    fellow: { displayName: "Test Fellow" },
    fellowship: {
      programme: "Clinical AI Fellowship",
      cohort: "Cohort 5",
      startsOn: "2026-09-01",
      endsOn: "2027-08-31",
    },
    entries: [
      {
        id: "018f0000-0000-7000-8000-000000000001",
        title: "What I learned",
        activityDate: "2026-08-27",
        archived: true,
        createdAt: "2026-08-27T09:00:00.000Z",
        updatedAt: "2026-08-28T10:00:00.000Z",
        entryType: { code: "reflection", label: "Reflection" },
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "A private reflection." }],
            },
          ],
        },
        bodyText: "A private reflection.",
        objectives: [
          {
            stableId: "fcai.af.01",
            code: "AF-01",
            title: "Test objective",
            domainCode: "AF",
            domainTitle: "AI Foundations",
          },
        ],
        links: [
          {
            type: "repository",
            url: "https://example.org/repository",
            label: "Repository",
            description: null,
          },
        ],
        attachments: [
          {
            id: "018f0000-0000-7000-8000-000000000002",
            displayName: "notes.txt",
            mediaType: "text/plain",
            sizeBytes: 5,
            sha256: "a".repeat(64),
            objectKey: "tenant/private-internal-object-key",
          },
        ],
      },
    ],
  };
}

describe("portable diary export", () => {
  it("keeps portable metadata while stripping internal storage keys", () => {
    const portable = toPortableDiaryJson(snapshot());
    const encoded = JSON.stringify(portable);
    expect(portable.schemaVersion).toBe("1.0.0");
    expect(portable.entries[0]?.archived).toBe(true);
    expect(portable.entries[0]?.attachments[0]?.sha256).toBe("a".repeat(64));
    expect(encoded).not.toContain("objectKey");
    expect(encoded).not.toContain("private-internal-object-key");
  });

  it("renders a non-empty PDF with the expected file signature", async () => {
    const directory = await mkdtemp(join(tmpdir(), "diary-pdf-test-"));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, "diary.pdf");
    await renderDiaryPdfToFile(snapshot(), outputPath);
    const pdf = await readFile(outputPath);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1_000);
  });
});
