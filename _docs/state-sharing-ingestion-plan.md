# State Sharing & Ingestion Plan

Status: design proposal. A partial baseline exists in the working tree (see
**Current implementation** below); the rest of this document is the agreed
direction for the full feature and supersedes the ad-hoc baseline where they
disagree.

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

## Current implementation (baseline, uncommitted)

A first pass exists and is intentionally minimal; it will be revised to match
this plan:

- `fe/src/lib/documents/share.ts` — `snapshotToJsonString`,
  `snapshotFromJsonString`, `encodeSnapshotParam` / `decodeSnapshotParam`
  (gzip + base64url), `buildShareUrl`, `readShareParam`.
- `fe/src/lib/documents/share.test.ts` — round-trip + rejection tests.
- `documents/session.svelte.ts` — `importSnapshot` (discard-if-dirty, installs as
  Untitled) and `currentSnapshot`.
- `routes/+page.svelte` — applies a `#s=…` link on load, then strips the hash.
- `components/ShareDialog.svelte` — copy link + download file, long-link warning.
- `components/DocumentBar.svelte` — "Share…" and "Import file…" menu items.

Covered so far: share URL (export + import), local file (export + import).
**To be revised for the decided UI:** the baseline `ShareDialog` bundles link +
download; split it so the dialog is Share-only (Copy link + Copy JSON) and move
download to a **Save to file** action under the Save group.
**Not yet built:** Copy JSON, paste JSON, remote JSON URL, the Import dialog, and
the More-menu regrouping.

## Decisions

- **Share and Import are separate surfaces** (separate dialogs).
- **Save vs Share classification:** Save-to-file (`.json` download) is a **Save**;
  Copy link and Copy JSON are **Share**. Open = this app's stored docs; Import =
  external file/URL/paste.
- **Copy JSON emits pretty JSON** (matches the downloaded file; inspectable).
- **No partial shipping:** the feature lands as one complete unit once all Save /
  Share / Import surfaces are done. The working-tree baseline stays uncommitted
  until then.

## Open questions

- Remote URL import: enforce a max response size? Distinct messages per fetch
  failure (network/CORS vs non-JSON vs `newer`/`invalid`), or one generic +
  details?
- Surface a transient "Loaded from shared link / file" note on ingest, or apply
  silently?
- Adopt the File System Access API progressive enhancement in v1, or keep to
  `<a download>` / `<input type=file>` only?
- Ship `?src=` deep-linking, or defer past v1? (leaning: defer.)
