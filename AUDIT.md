# Sanctuary Voice — Security & Infrastructure Audit

Date: 2026-05-17
Repo HEAD: f4f039b (V14.7)
Auditor: Claude Code (V15 audit pass)

## Executive summary

The codebase is in good security shape for its size: no hardcoded secrets, all
credentials read from `process.env`, `.env` is gitignored and was never committed
to history, all `render.yaml` secrets are `sync: false`, auth codes never travel
in query strings, session cookies are HMAC-signed + HttpOnly, and `npm audit`
reports **0 vulnerabilities**. No critical (P0) findings.

The weak spots are operational/infrastructure rather than code exploits: the
single-file JSON datastore is written **non-atomically** (crash mid-write can
truncate all app state), the startup secret-enforcement guard only fires under
`COMMERCIAL_MODE` while the production blueprint runs `COMMERCIAL_MODE=0`, the
`.gitignore` is too narrow to catch future `.env.*` variants, and there is **no
CI/CD** at all. These are all low-effort P1 fixes.

## P0 — Critical (must fix immediately)

**None found.** No hardcoded secrets, no auth bypass, no secret leakage in logs
or query strings, no committed `.env`. This is a genuinely clean result for a
~20k-line codebase.

## P1 — Important (now-ish)

### P1.1 — Non-atomic writes to the JSON datastore
**File(s):** `lib/db.js:76` (`save`), `lib/db.js:60` (initial write); also
`server.js:2639` (lang-mismatch log), `server.js:2686` (translation cache),
`server.js:4755` (audit backup).
**Issue:** Every persist is a direct `fs.writeFileSync(dbFile, JSON.stringify(...))`.
There is no write-to-temp + atomic `rename` anywhere in the repo (`renameSync`
appears zero times). `saveDb()` runs eagerly after nearly every mutation
(per CLAUDE.md), so the write window is hit constantly.
**Risk:** A crash, OOM-kill, or power loss between truncate and full write leaves
`sessions.json` truncated/half-written — i.e. total loss of all organizations,
events, transcripts, and libraries. The once-per-day backup caps loss at ≤24h,
but the live file is the single source of truth and is the most-written file.
**Proposed fix:** In `save()`, write to `${dbFile}.tmp` then `fs.renameSync(tmp, dbFile)`
(atomic on the same filesystem). Apply the same pattern to the other three
`writeFileSync` sites in `server.js`.
**Effort:** ~5 lines in `lib/db.js`, ~3 lines each at the 3 `server.js` sites. ~20 min.

### P1.2 — Production secret enforcement gated on the wrong flag
**File(s):** `server.js:81-92`, `render.yaml:77-78`.
**Issue:** The "FATAL — refusing to start" guard for a missing
`ADMIN_SESSION_SECRET` (`server.js:82-86`) only triggers when `COMMERCIAL_MODE`
is true. The production blueprint sets `COMMERCIAL_MODE=0`. With the flag off and
the secret unset, the server silently boots with an **ephemeral random secret**
(`server.js:88`) — all admin sessions die on every redeploy. Separately,
`server.js:2287` can grant admin access on a fresh instance when no PIN/code/events
exist and `COMMERCIAL_MODE` is off.
**Risk:** The live deployment relies entirely on an operator remembering to
populate every `sync: false` secret in the Render dashboard; there is no
fail-closed check. A forgotten `ADMIN_SESSION_SECRET` or `MASTER_ADMIN_PIN`
degrades silently instead of failing loudly.
**Proposed fix:** Add a startup guard keyed on `NODE_ENV === 'production'`
(not `COMMERCIAL_MODE`) that requires `ADMIN_SESSION_SECRET` (and ideally
`MASTER_ADMIN_PIN`) — or set `COMMERCIAL_MODE=1` for the public deployment.
**Effort:** ~6-10 lines in `server.js` startup block, or a 1-line `render.yaml`
change. ~15 min.

### P1.3 — `.gitignore` too narrow
**File(s):** `.gitignore` (6 lines total).
**Issue:** Ignores `.env` exactly, but not `.env.local`, `.env.production`,
`.env.backup`, etc. No OS-junk entries (`.DS_Store`, `Thumbs.db`), no `*.log`.
**Risk:** A future `.env.production` (a natural filename) would not be ignored
and could be committed with live secrets.
**Proposed fix:** Replace `.env` with `.env*` plus `!.env.example`; add
`.DS_Store`, `Thumbs.db`, `*.log`, `npm-debug.log*`.
**Effort:** ~5 line edit to `.gitignore`. ~5 min.

### P1.4 — No CI/CD
**File(s):** none — `.github/` and `.gitlab/` do not exist.
**Issue:** No automated checks. Syntax errors, dependency vulnerabilities, and
broken JSON only surface manually or in production.
**Risk:** Regressions ship undetected; `node --check` and `npm audit` are
currently run by hand (and easy to skip).
**Proposed fix:** Add a minimal GitHub Actions workflow: `npm ci`,
`npm audit --audit-level=moderate`, and `node --check` over every `*.js`
(`server.js`, `routes/`, `socket/`, `lib/`, `scripts/`).
**Effort:** ~1 new file, ~30 lines. ~20 min.

## P2 — Refactor / improvements (later)

- **No safe export/packaging script.** `scripts/` contains only
  `generate-changelog.js`. If the app is distributed to other churches, a
  packaging script is needed that excludes `.env`, `data/`, `logs/`, `.git/`,
  `node_modules/`, `.claude/`. Currently a manual zip would leak all of those.
- **`render.yaml` uses `plan: free`.** Free tier spins down after inactivity
  (cold-start delay for a live service) and historically does not support the
  `disk:` persistent-volume block — worth confirming the disk actually mounts
  in production.
- **Large single files** (informational, no refactor proposed now):
  `server.js` 5249 lines, `public/styles.css` 5863, `public/app.js` 5079,
  `public/participant.js` 1711, `public/remote.js` 1104, `public/translate.js` 702.
- **Backup timing.** `backupOncePerDay` snapshots the *pre-save* file once per
  calendar day; there is no pre-migration / on-demand backup hook. Minor.

## What's already good

- No hardcoded secrets anywhere — every credential via `process.env`.
- `.env` is gitignored and was never added in git history.
- All sensitive `render.yaml` env vars use `sync: false`.
- Secret logging is safe — `server.js:93` logs only `OK`/`LIPSA`, never values.
- Query strings are clean: no `adminCode`/`operatorCode` in URLs; the only
  query params are `next` (sanitized via `sanitizeLocalNextPath` against open
  redirect) and `event` (non-sensitive id).
- Session cookies are HMAC-SHA256 signed (`ADMIN_SESSION_SECRET`), HttpOnly;
  short secrets trigger a warning.
- A real fail-closed `process.exit(1)` guard exists for `COMMERCIAL_MODE` +
  missing `ADMIN_SESSION_SECRET` (just gated on the wrong flag — see P1.2).
- Daily rotating backups with 7-day retention; rotating app log (5MB × 3).
- `npm audit`: **0 vulnerabilities**.
- `package-lock.json` is committed (reproducible installs).

## npm audit summary

`npm audit --audit-level=moderate` → **found 0 vulnerabilities.** No advisories
at any severity. Dependency tree is clean as of this audit.

## Recommended implementation order

1. **P1.1** — Atomic writes (highest blast radius: protects all app data).
2. **P1.2** — Production secret enforcement guard (fail-closed on misconfig).
3. **P1.3** — Widen `.gitignore` (prevents future secret leak; trivial).
4. **P1.4** — Minimal CI workflow (catches regressions going forward).
5. **P2** — Export/packaging script, `render.yaml` plan review, as needed.

## Files NOT audited deep

For transparency — this pass focused on security/storage/config surfaces. The
following were not reviewed line-by-line:

- `server.js` (5249 lines) — only the secret/startup/storage sections inspected;
  the bulk of REST handlers, socket wiring, and translation orchestration not
  reviewed for authz edge cases.
- `routes/events.js` — large REST surface; not audited per-endpoint for
  authorization correctness.
- `socket/handlers.js` — socket-level authz (`socketCanControlEvent`) not
  deeply verified.
- Frontend JS (`public/app.js`, `translate.js`, `participant.js`, `remote.js`)
  — not audited for DOM-based XSS / unsafe `innerHTML` sinks.
- `package-lock.json` dependency tree — only `npm audit` was run; no manual
  review of transitive dependencies.
- Runtime behavior under load, CORS/CSP allow-list correctness, and Web Push
  VAPID handling were not exercised.
