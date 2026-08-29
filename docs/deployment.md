# Deployment and go-live

This is the operational companion to
[`spec/12-security-privacy-governance.md`](../spec/12-security-privacy-governance.md).
It covers what the code enforces, what the platform must provide, and the
governance gates that must be closed **before any real fellow's data enters the
system**. Nothing here is legal advice; the adopting organisation's IG, DPO,
cyber and records leads approve go-live.

## 1. Topology

```
Internet ──TLS──▶ reverse proxy / load balancer ──▶ web (Next.js, port 3000)
                                                 └─▶ (internal only) worker
web + worker ──▶ PostgreSQL (TLS)   ──▶ S3-compatible object storage (3 private buckets)
             ──▶ ClamAV (clamd)     ──▶ SMTP relay (authenticated, TLS)
Browser ────────▶ S3_PUBLIC_ENDPOINT (presigned upload/download only)
```

- `web` and `worker` are built from the same `Dockerfile` (`--target web` /
  `--target worker`); both run as an unprivileged user with no dev tooling.
- Migrations run once per release from the worker image:
  `node_modules/.bin/tsx scripts/migrate.ts` (never `drizzle-kit push`).
- `docker-compose.prod.yml` is a reference topology for a single host; on a
  platform (ECS, Kubernetes, Azure Container Apps…) map it 1:1.

## 2. Configuration

All settings are environment variables, validated at process start by
`src/server/config/env.ts`. **In production the process refuses to start** if a
required value is missing, an `http://` origin is used, or any docker-compose
development credential is present.

| Variable | Required (prod) | Purpose |
|---|---|---|
| `NODE_ENV` | `production` | Enables `__Host-` secure cookies, HSTS, strict checks |
| `APP_BASE_URL` | yes, `https://` | Public origin: links in email, CSRF origin check |
| `DATABASE_URL` | yes | PostgreSQL; add `?sslmode=verify-full` for TLS |
| `S3_ENDPOINT` | yes, `https://` | Server-side object storage endpoint |
| `S3_PUBLIC_ENDPOINT` | if different | Endpoint browsers reach for presigned URLs (also allow-listed in CSP `connect-src`) |
| `S3_REGION` | yes | Region string |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | yes | Least-privilege key (see §3) |
| `S3_BUCKET_QUARANTINE` / `_CLEAN` / `_EXPORT` | yes | Three **private** buckets |
| `CLAMD_HOST` / `CLAMD_PORT` | yes | clamd reachable from the worker only |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_FROM` | yes | Relay; `SMTP_FROM` must be a real sending domain (SPF/DKIM/DMARC configured) |
| `SMTP_USER` / `SMTP_PASS` | usually | Relay credentials |
| `SMTP_SECURE` | — | `true` for implicit TLS (465); otherwise STARTTLS |
| `SMTP_REQUIRE_TLS` | — | Defaults to `true` in production: STARTTLS is mandatory |
| `TRUSTED_PROXY_HOPS` | — | Number of reverse proxies in front of `web` (default 1 in prod). Used only for the auth rate limit; wrong values weaken or disable IP limiting |
| `SECURITY_CONTACT` | recommended | Publishes `/.well-known/security.txt` (RFC 9116) |
| `SECURITY_POLICY_URL` | — | `Policy:` line in security.txt |
| `ALLOW_SEED` | must be unset | Synthetic fixtures are refused in production |

Secrets come from the platform's secret store (never a committed `.env`).
Rotate `S3_*` and SMTP credentials on a schedule and on any suspected exposure;
sessions and magic links are already hash-stored and need no rotation.

## 3. Platform controls the code relies on

**TLS and headers.** Terminate TLS at the proxy; forward `Host` unchanged and
append the client address to `X-Forwarded-For`. The app sets CSP (nonce,
`strict-dynamic`), HSTS (2 years, subdomains), `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, COOP/CORP and a restrictive Permissions-Policy.
Do not let the proxy strip or override them. Do not cache `/api/*` or any
authenticated page.

**PostgreSQL.** Dedicated database and role; TLS (`sslmode=verify-full`);
encryption at rest; automated backups with a tested restore; point-in-time
recovery if available. The audit log, revisions and outbox are append-only —
never grant the app role `TRUNCATE`/`DROP`.

**Object storage.** Three private buckets, public access blocked at the account
level, server-side encryption on, versioning off for quarantine (objects are
deleted after scanning), lifecycle rule to expire quarantine objects older than
1 day. The app key needs only: `s3:PutObject` (via presigned POST) on
quarantine; `GetObject`/`DeleteObject`/`HeadObject` on quarantine;
`PutObject`/`GetObject`/`DeleteObject` on clean and export. Presigned URLs are
valid for 5 minutes.

**ClamAV.** Run `clamav/clamav-debian` with a persistent signature volume and
freshclam enabled; reachable from the worker network only. Files stay in
`pending_scan` (not downloadable) until clamd is healthy.

**SMTP.** Authenticated relay over TLS; SPF, DKIM and DMARC for the `SMTP_FROM`
domain (magic links are the only credential — spoofable mail is an account
takeover path). Emails carry no diary content.

**Network.** Only the proxy is internet-facing. Worker, database, storage
(server endpoint), clamd and SMTP are on private networks. `web` needs no
inbound access except from the proxy and the health checker.

**Logs.** Application logs contain request IDs, user IDs and route names, never
narrative content or tokens. Ship them to a central store with restricted
access and a defined retention period; the hash-chained audit log is in the
database, not in log files.

## 4. Release procedure

1. CI green on the commit (lint, typecheck, unit, `pnpm audit:prod`, gitleaks,
   CodeQL, image build + Trivy, full stack suites).
2. Build and push images tagged with the commit SHA.
3. Take a database backup (or confirm PITR is healthy).
4. Run migrations: `tsx scripts/migrate.ts` (forward-only; migrations are
   written to be compatible with the previous release still running).
5. Roll out `worker`, then `web`. Health: `GET /api/health` → `200 {"status":"ok"}`
   (503 when the database is unreachable).
6. Smoke test on the live origin: sign-in page loads with CSP nonce on scripts
   (`view-source`), invitation e-mail arrives, `/.well-known/security.txt`
   resolves, `pnpm verify:audit-chain` passes against production
   (read-only).
7. Framework import for a new tenant: `tsx scripts/framework-import.ts
   spec/frameworks/fcai/v3.2/framework.json --publish`; create the tenant and
   the first programme-admin invitation with `tsx scripts/invite.ts`
   (never `pnpm seed` — it is refused in production).

Rollback: redeploy the previous image tags. Migrations are additive, so the
previous release runs against the newer schema.

## 5. Operations

- **Backups.** Nightly logical backup + PITR, encrypted, stored in a separate
  account/region with immutability; restore tested quarterly. Backup retention
  is part of the records schedule (spec/12 §retention) — deleted diaries must
  not outlive it in backups.
- **Retention automation.** The worker purges finished diaries after the 90-day
  access window (unless a retention hold exists), scrubs expired export
  objects, and prunes spent auth tokens and rate-limit rows. Monitor the
  `outbox` table for `failed` rows — a stalled worker is a compliance failure,
  not just a bug.
- **Monitoring.** Alert on: health check failing, outbox failures, clamd
  unhealthy > 15 min, SMTP delivery failures, 5xx rate, `pnpm
  verify:audit-chain` failure (run daily).
- **Incident response.** Runbooks per spec/12 §incident: account compromise,
  cross-tenant disclosure, accidental patient data, malicious upload, audit
  chain break, provider outage, backup restore. Suspending a user
  (`app_user.status = 'suspended'`) blocks access immediately; bumping
  `permissions_version` forces session rotation.
- **Self-service sign-up.** Any address can request a link, so the SMTP
  relay must tolerate the per-address (5/h) and per-IP (20/h) limits and
  `TRUSTED_PROXY_HOPS` must be correct or the IP limit is inert. Self-created
  workspaces have no `controller_name`/`privacy_notice_url`; the operator is
  the controller and must publish a privacy notice and record notice
  acknowledgement (privacy, acceptable use, no patient data) at first sign-in —
  the invitation flow does this, the self-service flow currently does not.
- **Data subject requests.** Fellows self-serve export and deletion
  (finish → 90 days). For DSARs from others, the DPO route in the privacy
  notice applies; staff cannot read diary content in-product by design.

## 6. Go-live gates (spec/12) — status for this codebase

| Gate | Owner | Code status | Notes |
|---|---|---|---|
| Named controller / DPO / records / security / service owners | Org | n/a | Record in DPIA |
| Lawful basis, privacy notice, controller–processor contracts | Org | supported | `tenant.privacy_notice_url` is shown at onboarding; notices acknowledged and audited |
| DPIA screened / completed, residual risk accepted | Org | **drafted** | [`docs/dpia.md`](dpia.md): complete the hosting/sub-processor entries and sign off before live use |
| Retention & deletion schedule implemented and tested | Org + code | implemented | Finish/reopen/purge in worker; integration tests in `tests/integration/diaryLifecycle.test.ts`; verify backups honour it |
| Access/role model and exceptional-access policy approved | Org | implemented | Owner-only; generated authz matrix; no staff read path |
| Threat model, **penetration test**, high/critical remediation | Org + code | **open** | Independent pen test not yet performed |
| Backup/restore and incident exercise | Org | **open** | |
| **Accessibility audit** and statement | Org + code | statement **published**, audit **open** | Statement at `/accessibility` (voluntary PSBAR format; review by 29 Aug 2027). Assistive-technology audit of the editor and objective picker still outstanding |
| Faculty approves canonical curriculum | Org | supported | FCAI v3.2 package imported, published releases immutable |
| Support, complaints, DSAR, offboarding routes staffed | Org | n/a | |
| DSPT / CAF / clinical-safety decisions recorded | Org | n/a | Do not claim "NHS approved" (spec/12 §prohibited claims) |
| OSI licence and third-party licence documentation | Repo | done | MIT (`LICENSE`); fonts OFL (`src/fonts/OFL.txt`); see README §Licence |

Until every row is closed, deploy only with synthetic data.

## 7. Prohibited claims

From spec/12: do not describe the service as "GDPR compliant", "NHS approved",
"ARCP approved", "completely confidential", "anonymous" or "unhackable". State
the actual controls (this document and SECURITY.md), the controller, and the
limitations.
