# Operator vs Admin — Access Gap Recon

Date: 2026-05-17
Commit base: 84cba44 (V18.1)
Mode: read-only recon — no code changed. Only this file was added.

## Operator landing page

The operator never reaches `admin.html`. The flow is:

1. Operator logs in with the **operator PIN** via `POST /api/operator-login`
   (separate from the admin PIN; rate-limited per IP). On success the server
   sets an **operator session cookie** (distinct from the admin session cookie).
2. The browser lands on **`/operator-dashboard`** → `public/operator-dashboard.html`
   + `public/operator-dashboard.js` (63-line HTML, 199-line JS). This is just an
   **event picker**: it calls `GET /api/operator/events` and lists active/scheduled
   events.
3. Operator picks an event → `POST /api/operator/join` → server replies with
   `redirectUrl: /remote?event=<id>` and the browser navigates to **`/remote`**.
4. The operator's working console is **`public/remote.html`** + `public/remote.js`
   (169-line HTML, 1104-line JS).

By comparison the admin works in **`public/admin.html`** + `public/app.js`
(931-line HTML, 5257-line JS). These are two completely separate front-ends —
the gap is structural, not a flag on one page.

Routing (`server.js`):
- `/admin`, `/admin.html` → `requireAdminPage` middleware → `sendAdminPage`
- `/remote` → `res.sendFile('remote.html')` — **no middleware**
- `/operator-dashboard`(.html) → `res.sendFile('operator-dashboard.html')` — **no middleware**

(`/remote` and `/operator-dashboard` are unguarded as *pages*; access is enforced
when the operator joins the event / calls APIs.)

## What operator CAN do (current state)

In `remote.html`, panels are shown per permission (`main_screen`, `song`):

**Main Screen Control** (needs `main_screen`):
- Open main screen window
- Mode buttons: Live follow / Pinned text / Song / Black screen / Undo
- Quick language buttons + display language (primary), second language, dual-language toggle
- Text fitting: zoom A− / A+ / Reset + text-size presets (Compact / Large / XL / Huge)

**Live Monitor**: read-only previews of Main Screen and Participant.

**Song tools** (needs `song`):
- Song Navigation: "Back to live text", jump-to-section select
- Church Library (collapsible): search + sort, song list — each entry is a single
  **"open"** pill that loads the song into the editor
- Song Editor: title, song language, lyrics textarea, **Save to church library**,
  **Send first verse live**, Back to live text, Clear editor

Operator profiles (`REMOTE_OPERATOR_PROFILES` in `server.js`): `main_screen`
(`['main_screen']`), `song_only` (`['song']`), `main_and_song` and `full`
(both `['main_screen','song']`). No profile grants `glossary`.

## What operator CANNOT do (vs admin)

### Tab Song
Admin's `#tab-song` (admin.html ~L458–686) has these elements that **do not exist
anywhere in `remote.html`**:
- **Live Song Control**: dedicated Black screen + Clear buttons, "Edit current verse"
  button, song blocks list with per-block expand (`▾`)
- **Church Library cards with per-song buttons**: `Preview`, `Edit` (load), `Send first
  verse`, `Add to...` (with event select), `Delete`. The operator's library only has a
  bare "open" pill — **no Preview, no Edit, no Send, no Add, no Delete on cards**.
- **Import from URL / search resursecrestine.ro** (`importUrlInput` / `importUrlBtn`)
- **Recent Sends** history list
- A full **Main Screen Settings** card embedded in the Song tab (see below)

### Tab Main Screen
Admin has a dedicated `#tab-mainscreen` (admin.html ~L415–456) plus the Main Screen
Settings card inside the Song tab, exposing:
- Theme select (white-on-black / black-on-white)
- Background preset (Solid / Warm / Sanctuary / Soft light) + custom background image URL
- Text size select, text layout (Focus / Wide), projector resolution (auto / 16:9 / 16:10 / 4:3)
- Clock position, clock size, show-clock toggle
- Screen Status audit (scene / language / theme / readability / source / updated)
- Preview windows (main / participant / both)
- Usage & Reliability metrics

**`remote.html` has none of these.** The operator's "Main Screen Control" panel only
offers mode switching, language, and text zoom/presets. There is no theme, background,
clock, resolution, or layout control for the operator at all.

## How the gap is enforced

### Backend (server-side)
- **Page middleware**: `requireAdminPage` (`server.js` L599) protects `/admin*` and
  redirects to `/admin-login` without a valid admin session. `/remote` and
  `/operator-dashboard` have no page middleware.
- **Two session types**: admin session cookie (signed HMAC, `hasValidAdminSession`)
  vs operator session cookie (operator PIN, `getOperatorCodeFromCookie`).
- **API auth**: `requireEventRole(req,res,event,allowedRoles)` + `requireEventPermission
  (req,res,permission)`. `resolveEventAccessFromCode` (`server.js` L2203) maps an access
  code to `{ role: 'admin'|'screen', permissions: [...] }`. `requireEventAdmin` is just
  `requireEventRole(..., ['admin'])`.
- **Operator-allowed endpoints** — already accept role `screen`
  (`['admin','screen']` + `requireEventPermission`):
  - `song`: `/song/load`, `/song/show/:i`, `/song/labels`, `/song/next`, `/song/prev`,
    `/song/edit-active-block`, `/song/clear`, `POST /api/events/:id/global-song-library`
    (save), `display/mode` when `mode=song`
  - `main_screen`: `display/mode`, `display/theme`, `display/language`,
    `display/settings`, `display/text`, `display/blank`, `display/restore-last`,
    `display/shortcut`, `display-presets/:id/apply`, `submit_text` and most socket controls
- **Admin-only endpoints** (`requireEventAdmin`, ~17 call sites in `routes/events.js`):
  event settings, visibility, delete event, duplicate, target-langs, transcripts/clear,
  remote-operators CRUD, `bible-mode`, `display-presets` create + delete, per-event
  `song-library` delete, **`DELETE /api/events/:id/global-song-library/:songId`** and
  **`POST /api/events/:id/global-song-library/:songId/add-to-event`**.
- **Socket**: `socketCanControlEvent(socket,eventId,permission)` (`server.js` L2317)
  checks role + permissions on every control event in `socket/handlers.js`.

### Frontend (client-side)
- **Separate pages**: admin = `admin.html`/`app.js`; operator = `remote.html`/`remote.js`.
  There is no shared template — the admin's rich controls were simply never built into
  the operator page.
- **Tabs hidden**: not applicable — `remote.html` has no tab bar; it is a flat single
  page. The admin tab bar (`Events`, `Operator Roles`, `Live Control`, `Transcript`,
  `Main Screen`, `Song`, `Glossary`, `Quick Text`, `Statistics`) exists only in admin.html.
- **Conditional panels**: in `remote.js` (~L536–585) panels are toggled by permission —
  `mainScreenAllowed` / `songAllowed` / `glossaryAllowed` set `.hidden` on the
  Main Screen panel, song panels, church library, song editor, glossary panel and the
  mode buttons.

**Bottom line:** for Song + Main Screen the gap is ~90% **front-end**. The backend
already authorizes role `screen` for nearly all song/display actions. The operator
simply uses a smaller HTML page that does not render theme/background/clock/resolution
controls or the per-card library buttons. The only true backend blocks for Song are
`DELETE` and `add-to-event` on the global song library.

## Estimated effort to give operator same access as admin on Tab Song + Main Screen
(but NOT on Settings / Security / Audit log)

**Backend: small (~1–2h).**
- Only 2 endpoints need relaxing: `DELETE /api/events/:id/global-song-library/:songId`
  and `POST /api/events/:id/global-song-library/:songId/add-to-event` — change
  `requireEventAdmin` → `requireEventRole(['admin','screen'])` + `requireEventPermission
  ('song')`. Everything else already accepts `screen`.

**Frontend: this is the real work. Two approaches:**

- **Option A — extend `remote.html`/`remote.js`** (recommended for security isolation):
  port the missing markup + handlers (theme, background preset + custom URL, clock
  position/size/show, projector resolution, text layout, song blocks list with expand,
  edit-current-verse, per-card Preview/Edit/Send/Delete/Add-to, import-from-URL,
  recent sends). Roughly ~200 lines of HTML + several hundred lines of JS render/handlers
  ported from `app.js`. **Estimate: ~1–2 days.** Keeps Settings/Security/Audit naturally
  out of reach because that page never contains them.

- **Option B — let operators load `admin.html` with a trimmed UI**: change
  `requireAdminPage` to also accept operator sessions, then hide the `Events`,
  `Operator Roles`, `Glossary`, `Statistics`/audit tabs client-side. **Estimate: ~0.5–1
  day** of work, **but** higher risk: every admin-only endpoint must be confirmed
  server-enforced (client hiding is not security), and a security review is required.

Recommendation: **Option A** — lower blast radius, no risk of exposing Settings/Security.

## Open questions

- Which approach is wanted — extend `remote.html` (Option A) or reuse `admin.html`
  with hidden tabs (Option B)?
- Should operators get theme / background / clock / resolution controls at all? They are
  currently entirely absent from the operator UI — is that a deliberate scope limit or
  an oversight?
- The `glossary` permission is not granted by any operator profile (only admins get it
  via socket). Is Glossary intentionally admin-only? It is excluded from this estimate.
- "Settings / Security / Audit log" — confirm exact boundary: event settings, visibility,
  delete/duplicate event, target languages, remote-operator management, audit log, and
  push/access-request management are all assumed to stay admin-only.
- Per-event `song-library` (the event-scoped library, separate from the global church
  library) delete is also `requireEventAdmin` — should operators be able to delete from
  the event-scoped library too, or only the global one?
