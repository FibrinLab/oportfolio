import { DiaryLockGate } from "@/components/lock/DiaryLockGate";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActor, resolveTenant } from "@/server/policy/actor";
import { getOwnEnrolment } from "@/server/framework/queries";
import { listEvidence } from "@/server/portfolio/evidence";
import { formatDateUk } from "@/lib/dates";
import { aad } from "@/lib/crypto/envelope";
import { SealedText } from "@/components/lock/Sealed";

export const metadata: Metadata = { title: "Diary" };

export default async function LogPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const actor = await getActor();
  if (!actor) notFound();
  const { tenantSlug } = await params;
  const tenantContext = await resolveTenant(actor, tenantSlug);
  if (!tenantContext) notFound();

  const enrolment = await getOwnEnrolment(actor, tenantContext.tenantId);
  if (!enrolment) notFound();

  const items = await listEvidence(actor, enrolment);

  // Group by month, reverse chronological (S-04).
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.activityDate?.slice(0, 7) ?? "Undated";
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  return (
    <DiaryLockGate>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--space-3)",
          marginBottom: "var(--space-5)",
          flexWrap: "wrap",
        }}
      >
        <h1>
          Diary{" "}
          <span style={{ fontWeight: 400, fontSize: "var(--text-body)" }}>
            ({items.length} {items.length === 1 ? "entry" : "entries"})
          </span>
        </h1>
        {enrolment.diaryState === "open" ? (
          <Link
            href={`/t/${tenantSlug}/log/new`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: "var(--target-min)",
              padding: "0 var(--space-5)",
              background: "var(--ink)",
              color: "var(--paper)",
              border: "2px solid var(--ink)",
              borderRadius: "var(--radius-control)",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            New entry
          </Link>
        ) : null}
      </div>

      {enrolment.diaryState === "finished" ? (
        <p className="stamp" style={{ marginBottom: "var(--space-4)" }}>
          [READ ONLY] This diary is finished. Use Export to download or reopen it.
        </p>
      ) : null}

      {items.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--rule)",
            padding: "var(--space-6)",
            maxWidth: "var(--measure)",
          }}
        >
          <p style={{ fontWeight: 700, marginBottom: "var(--space-2)" }}>No entries yet</p>
          <p>
            Start with something small — a workshop you attended, a dataset you explored, a
            conversation that changed your thinking. Entries start private to you.
          </p>
        </div>
      ) : (
        [...groups.entries()].map(([month, groupItems]) => (
          <section key={month} aria-label={month} style={{ marginBottom: "var(--space-5)" }}>
            <h2
              style={{
                fontSize: "var(--text-sm)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                borderBottom: "2px solid var(--ink)",
                paddingBottom: "var(--space-1)",
                marginBottom: "var(--space-2)",
              }}
            >
              {month === "Undated" ? "Undated" : formatDateUk(`${month}-01`).slice(2)}
            </h2>
            <ul style={{ listStyle: "none", padding: 0, maxWidth: "var(--content-max)" }}>
              {groupItems.map((item) => (
                <li
                  key={item.id}
                  style={{
                    borderBottom: "1px solid var(--rule)",
                    padding: "var(--space-3) 0",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "var(--space-4)",
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    <Link href={`/t/${tenantSlug}/log/${item.id}`} style={{ fontWeight: 700 }}>
                      <SealedText envelope={item.titleEnc} aad={aad.evidenceTitle(item.id)} fallback={item.title || "(untitled)"} />
                    </Link>
                    <span style={{ display: "block", fontSize: "var(--text-sm)", color: "var(--disabled-text)" }}>
                      {item.activityDate ? `${formatDateUk(item.activityDate)} · ` : ""}
                      {item.typeLabel}
                      {item.objectiveCount > 0
                        ? ` · ${item.objectiveCount} objective${item.objectiveCount === 1 ? "" : "s"} mapped`
                        : ""}
                    </span>
                  </span>
                  <span style={{ fontSize: "var(--text-sm)", whiteSpace: "nowrap" }}>
                    <span className="stamp">[{item.archivedAt ? "ARCHIVED" : "PRIVATE"}]</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </DiaryLockGate>
  );
}
