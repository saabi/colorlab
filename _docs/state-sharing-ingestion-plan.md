# State Sharing & Ingestion Plan

Status: **v1 shipped** (2026-06-15). Save to file, Share (copy link · copy JSON), and Import (file · URL · paste · `#s=…` hash) are live. Deferred past v1: `?src=` deep-link, shared toast system, File System Access API.

The sections below record the design direction and implementation notes. Where they disagree with the shipped code, the code wins.

## Goal

Let users move a Color Lab document — the current parameters: colors, pipeline,
and view — in and out of the app through several lightweight transports, without
any server-side storage.

A "document" here is exactly a `ParameterSnapshot` (`= PersistedAppState`), the
same serializable object the local document registry already saves. Sharing and
ingestion are **transports** over that object, not a new data model.

## Scope

Operations split by **intent** (not by mechanism), across three separate
surfaces — Save, Share, and Import. See **UI plan** for how each maps.

In scope — **Save (durable):**

- **Save / Save As** — to this app's localStorage document registry (exists).
- **Save to file** — write the snapshot to a `.json` file on disk.

In scope — **Share (transient outbound handoff):**

- **Copy share link** — a self-contained URL that encodes the whole snapshot.
- **Copy JSON** — the raw snapshot JSON, as-is, to the clipboard.

In scope — **Import (inbound, from outside the app):**

1. **From a share URL** — open a link whose hash carries an encoded snapshot.
2. **From a local file** — pick a `.json` file from the file system.
3. **From a remote JSON URL** — fetch a URL that points at a JSON document (a
   raw snapshot, or a Color Lab share link) and load it.
4. **From pasted JSON** — paste raw snapshot JSON into a field.

Out of scope:

- **Saving online / hosting** — no backend, no upload, no short-link service, no
  account-bound cloud documents. Every transport is client-side and
  self-contained. (A short-link/hosting service could be a separate future
  effort; it is explicitly excluded here.)

## Invariant: one canonical load path

Every ingestion method, regardless of transport, must funnel its decoded payload
through `parseSnapshot` (`detect → migrate → coerce`) before it touches live
state. No transport may `Object.assign` raw JSON into state or skip migration.
This is the same rule the local registry follows (see
[`fe/src/lib/documents/README.md`](../fe/src/lib/documents/README.md) and
`AGENTS.md` → Document persistence).

Consequences that come for free:

- Older snapshots migrate forward.
- Newer snapshots are rejected with a clear message (`rejectReason: 'newer'`).
- Unknown keys are dropped; missing fields get factory defaults.

A shared document therefore needs **no schema change** of its own; it rides the
existing `CURRENT_STATE_SCHEMA_VERSION` and migration chain.

## Transport details

### Encoding for links (`encodeSnapshotParam` / `decodeSnapshotParam`)

- `JSON.stringify(snapshot)` → gzip (`CompressionStream`, no dependency) →
  base64url (no padding).
- Carried in the URL **hash fragment** (`#s=…`), never the query string, so the
  payload is not sent to the server, not logged, and survives the static/node
  adapter without a server route.
- On load, the hash is decoded, applied through `parseSnapshot`, and then
  stripped from the URL so reloads and saves start clean.

### Remote JSON URL

- `fetch(url)` the user-supplied URL, read text, then run the same
  `snapshotFromJsonString` path.
- Accept two payload shapes:
  - a raw snapshot JSON document, or
  - a Color Lab **share link** string — if the fetched text (or the entered URL
    itself) is a `…#s=…` link, extract and decode the token instead.
- Failure handling: network/CORS error, non-JSON body, oversized response, and
  `newer`/`invalid` snapshots each get a distinct, plain-language message.
- Privacy note: the fetch happens from the user's browser; document this so it is
  clear no Color Lab server is involved.

### Pasted JSON

- A textarea; on confirm, run `snapshotFromJsonString` and surface the same
  reject reasons. Paste handles the raw-JSON case only — share links go through
  the URL field.

### Copy JSON as-is

- `snapshotToJsonString` (pretty) to the clipboard, so a user can paste it
  elsewhere or into another instance's "paste JSON" field. This is the symmetric
  partner of "paste JSON".

## Optional: deep-link to a remote file (`?src=`)

Consider a query parameter (e.g. `?src=<url>`) that, on load, fetches and
ingests a remote JSON URL automatically — a shareable deep link to a file hosted
anywhere. This overlaps with "remote JSON URL" but as an automatic on-load path.

Open question: is `?src=` worth the added surface (and the on-load fetch /
error-state complexity), or is manual "import from URL" enough for v1? Leaning:
defer `?src=` until the manual flow ships.

## UI plan (decided)

Three distinct intents, three distinct surfaces. **Share (outbound) and Import
(inbound) are separate**, per product decision.

### Verbs the user sees

| Verb | Meaning | Destinations / sources |
|------|---------|------------------------|
| **Save** | Keep the working document durably | this app (localStorage named doc) · a file on disk (`.json`) |
| **Open** | Load a document this app already holds | localStorage docs · bundled examples (the existing switcher) |
| **Import** | Bring in a document from *outside* the app | local file · remote JSON URL · pasted JSON |
| **Share** | Hand the current document off, transiently | copy share link (URL) · copy JSON |

- **Save to file is a Save**, not a Share — it is durable storage on the user's
  disk. **Copy link / Copy JSON are Share** — transient handoffs.
- **Open vs Import:** Open works on documents this app already holds; Import
  reaches outside (file/URL/paste). A file is external, so "From file" lives
  under Import (Open may still offer an "Open file…" convenience link into it).

### Surfaces

- **DocumentBar (unchanged primary loop):** the document switcher (Open) and the
  top-level **Save** button stay as they are.
- **More menu**, grouped:
  - *Save group:* Save As… · Save to file…
  - *Transfer:* **Share…** (opens Share dialog) · **Import…** (opens Import dialog)
  - *Manage:* Guide note… · Rename… · Delete…
- **Share dialog** (outbound only): read-only share-link field + **Copy link**; a
  **Copy JSON** button; a long-link warning that points to "Save to file."
- **Import dialog** (inbound only): a segmented control — **From file** /
  **From URL** / **Paste JSON** — each with its own input and a single confirm.
  Runs `parseSnapshot`, confirm-discards if dirty, installs as Untitled.

Mobile: dialogs must reflow under the drawer and "Copy" must work there.

### File System access

v1 uses universally-supported primitives: `<a download>` for Save-to-file and
`<input type="file">` for Import-from-file. Where available, progressively
enhance Save-to-file with the File System Access API (`showSaveFilePicker`) to
keep a live file handle so subsequent saves overwrite the same file; fall back
to download otherwise. Not required for v1.

## Edge cases

- **Dirty document on import** — confirm-discard before replacing, as document
  load already does. (URL-hash apply on first load skips the prompt because
  nothing is dirty yet.)
- **Imported docs are untitled and unsaved** — ingestion installs the snapshot as
  a new Untitled document; the user can Save / Save As to keep it. Nothing is
  written to the registry implicitly.
- **Large documents** — up to `MAX_RAMP_STOPS` (105) across multiple lists can
  make share links long; warn past a soft length limit and prefer the file.
- **Clipboard blocked** — fall back to selecting the field for manual copy.
- **Schema mismatch** — `newer` → reject with guidance to update; older →
  migrate silently (already handled).

## Phases

Build order only — **nothing ships until the whole feature is complete** (per
product decision); there is no partial release.

1. **Core transport baseline** — `share.ts` (JSON + gzip/base64url URL),
   `importSnapshot`, `#s=` hash apply on load. *(Implemented in the working tree;
   see below.)*
2. **Save to file** — `.json` download as a **Save** action (Save group), not in
   the Share dialog.
3. **Share dialog** — outbound only: Copy link + **Copy JSON** (pretty).
4. **Import dialog** — inbound: From file / From URL / Paste JSON as a segmented
   control. Remote URL handles raw snapshot *or* a share link, with per-error
   messages; paste handles raw JSON.
5. **Wire-up & polish** — More-menu grouping (Save / Transfer / Manage), mobile
   reflow, analytics, copy/clipboard fallbacks, tests for each path.
6. **(Optional, deferred) `?src=` deep link** — on-load remote ingestion, only if
   accepted later; not part of v1.

## Current implementation (v1 shipped)

All v1 surfaces are implemented in the working tree and pass `npm run check`,
`npm test`, and `npm run build`:

- `fe/src/lib/documents/share.ts` — `snapshotToJsonString`,
  `snapshotFromJsonString`, `encodeSnapshotParam` / `decodeSnapshotParam`
  (gzip + base64url), `buildShareUrl`, `readShareParam`, plus
  `shareParamFromUrl`, `looksLikeShareLink`, `resolveSnapshotFromUrl`
  (share-link-or-fetch, injectable `fetch`, `MAX_IMPORT_BYTES` cap).
- `fe/src/lib/documents/share.test.ts` — 17 tests: JSON/URL round-trips,
  rejection, URL-parsing helpers, and `resolveSnapshotFromUrl` branches.
- `documents/session.svelte.ts` — `importSnapshot` (discard-if-dirty, installs as
  Untitled) and `currentSnapshot`.
- `components/AppShell.svelte` — applies a `#s=…` link on load (with a notice),
  strips the hash; owns the minimal `notify` transient + `.app-notice` region.
- `components/ShareDialog.svelte` — Share-only: Copy link + **Copy JSON**.
- `components/ImportDialog.svelte` — segmented **From file / From URL / Paste
  JSON**, inline errors, closes before handing off so the discard-confirm never
  stacks.
- `components/DocumentBar.svelte` — **Save to file…** (Save group), **Share…** /
  **Import…** (Transfer group), regrouped menu with separators.

Covered: Save→file, Share→link, Share→JSON, Import←{share URL, file, remote JSON
URL, paste}. Validation reuses `coerceSnapshot`; no new dependency. Listed in
Roadmap **Recently shipped**.

## Decisions

- **Share and Import are separate surfaces** (separate dialogs).
- **Save vs Share classification:** Save-to-file (`.json` download) is a **Save**;
  Copy link and Copy JSON are **Share**. Open = this app's stored docs; Import =
  external file/URL/paste.
- **Copy JSON emits pretty JSON** (matches the downloaded file; inspectable).
- **No partial shipping:** the feature lands as one complete unit once all Save /
  Share / Import surfaces are done. The working-tree baseline stays uncommitted
  until then.
- **Validation reuses `coerceSnapshot`** — every ingestion path (file / URL /
  paste / hash) goes through the existing `parseSnapshot → coerceSnapshot`, the
  same total, lenient validator that localStorage loads use. **No new validation
  dependency** for this feature. `coerceSnapshot` is total (any input → a valid
  snapshot or `null`), salvages partial data, and defaults/drops bad fields — the
  right behavior for untrusted import. Adopting a runtime schema library
  (Valibot/Zod) is a **separate persistence-layer refactor**, not part of this
  feature (see Related separate tasks).
- **Ingest emits a transient note** ("Loaded from shared link / file") via the
  existing status affordance; generalizing that into a shared toast system is a
  separate task (see below).
- **No File System Access API in v1** — use `<a download>` + `<input type=file>`
  only (universal support; the API would be Chromium-only extra surface on top of
  the fallback we need anyway). Revisit if a "save back to the same file"
  workflow is requested.
- **`?src=` deep-link deferred** past v1; manual "Import from URL" is enough.

## Security note

`coerceSnapshot` builds a fresh object from a known key allow-list, so
`JSON.parse` of untrusted import text cannot inject unexpected keys or pollute
state. The invariant to preserve: **never `Object.assign` raw imported JSON into
live state** — it must pass through `coerceSnapshot` first.

## Related separate tasks (not part of this feature)

- **Shared toast / notification system** — generalize the component-local
  `gestureStatus` (Viewport) into a small app-level transient notice usable from
  the document/ingest paths, with `aria-live`. The accessibility follow-up
  (`aria-live` for `gestureStatus`) folds into this.
- **Runtime schema library evaluation** — assess replacing the hand-written
  `coerceSnapshot` with Valibot/Zod across the whole persistence layer (docs,
  examples, migration), weighing the declarative-schema + types win against the
  need to preserve lenient salvage/default behavior and keep the bundle small.

## Open questions

- Remote URL import: enforce a max response size? Distinct messages per fetch
  failure (network/CORS vs non-JSON vs `newer`/`invalid`), or one generic +
  details?
