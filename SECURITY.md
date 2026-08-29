# Security policy

oPortfolio holds private reflective writing by NHS fellows. Treat any weakness
that could expose diary content, attachments, exports or account access as
high severity.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

- Deployed instances publish a contact at `/.well-known/security.txt`
  (RFC 9116) — use that address for anything affecting a live service.
- For the open-source code itself, use GitHub's private vulnerability
  reporting on this repository ("Security" → "Report a vulnerability"), or
  email the maintainer at 0xchromatin@proton.me.

Include the affected route or component, reproduction steps, and the impact
you believe is possible. Do not include real personal data, diary content or
credentials in a report; synthetic data from `pnpm seed` is sufficient.

We aim to acknowledge reports within 3 working days and to agree a fix and
disclosure timeline within 14 days. Please give us a reasonable opportunity to
remediate before publishing details.

## Scope

In scope: this repository, the container images built from it, the API
contract in `docs/openapi.json`, and the deployment guidance in
`docs/deployment.md`. Out of scope: third-party services a deploying
organisation chooses (managed database, object storage, SMTP relay), unless
the issue stems from how this code uses them.

Testing against a **live** deployment requires the explicit written
authorisation of the organisation operating it — it contains real people's
private reflections.

## Supported versions

The `main` branch and the most recent tagged release receive security fixes.

## Security posture (summary)

The full threat model and go-live governance gates are in
[`spec/12-security-privacy-governance.md`](spec/12-security-privacy-governance.md);
operational controls are in [`docs/deployment.md`](docs/deployment.md).
Key implementation properties:

- Email-verified accounts only (single-use, 15-minute magic links; no
  passwords, no sign-in bypass in production). A first verified link creates a
  private single-member workspace; invitations remain for programme-run
  tenants. Requests are rate-limited per address and per client IP.
- Opaque session tokens (32 random bytes), only SHA-256 hashes stored;
  `__Host-` cookie, `HttpOnly`, `Secure`, `SameSite=Lax`; 60-minute idle and
  12-hour absolute timeouts; rotation on any permission change.
- End-to-end encryption of diary content (ADR-007): titles, narratives,
  links and files are AES-256-GCM encrypted in the browser under a per-user
  key that only the user's passphrase or recovery key can unwrap; the server,
  database and backups hold ciphertext; DB constraints refuse plaintext on
  sealed rows; exports are built client-side.
- Owner-only, default-deny authorization on every route with a generated
  matrix test; denials are byte-identical to not-found.
- Origin/`Sec-Fetch-Site` CSRF checks on every state-changing request;
  strict nonce-based Content Security Policy; HSTS; no third-party scripts.
- Uploads are encrypted in the browser, go straight to a quarantine bucket via
  presigned POST, are integrity-checked and stored as `sealed`, and can only
  be opened by their author (legacy plaintext files are ClamAV-scanned and
  type-inspected before release).
- Hash-chained, append-only audit log written in the same transaction as
  each mutation.
- Production startup refuses development credentials, non-HTTPS origins and
  synthetic seeding.
