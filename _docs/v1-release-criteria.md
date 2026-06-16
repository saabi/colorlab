# v1 release criteria (Beta → RC → 1.0.0)

**Status:** active plan  
**Canonical process:** [RELEASING.md](../RELEASING.md)  
**Backlog context:** [Roadmap.md](Roadmap.md)

This document is the **release track** for reaching **v1.0.0**. It merges two prior release reviews into one hybrid plan:

- **Correctness before beta** — chromatic adaptation (or explicit non-D65 guard) so colorimetrists are not shown silently wrong gamuts.
- **Narrow RC** — freeze, fix, and sign off; **not** a second feature milestone for Color Context, Display gamut, Pipeline Phase 2, or xy picking.

Feature backlog items deferred past **1.0.0** stay in [Roadmap.md](Roadmap.md); they are **not** repeated here unless they block a gate below.

---

## Version ladder

| Tag | Promise to users |
|-----|------------------|
| **`1.0.0-beta.N`** | Feature-complete enough for real use; saved documents may still change with migrations; known limitations documented. |
| **`1.0.0-rc.N`** | Scope frozen; only fixes; document migrations are release-blockers. |
| **`1.0.0`** | Stable contract: core workflows + document/share round-trip + semver for app releases. |

Pre-release tags use semver pre-release identifiers (`-beta.N`, `-rc.N`). See [RELEASING.md § Pre-releases](../RELEASING.md#pre-releases).

**Current app version:** `fe/package.json` → `"version"` = `1.0.0-beta.1` (bumped from `0.0.1`; beta cut staged 2026-06-16, awaiting tag/push/deploy).

---

## Gate workflow (notify + push)

Complete gates **in order**. After each gate:

1. Ensure `fe/`: `npm run check` and `npm test` pass.
2. Update task checkboxes in **this file** (same PR as the work, or immediately after).
3. Update [CHANGELOG.md](../CHANGELOG.md) and [Roadmap.md](Roadmap.md) when user-visible scope changes.
4. Commit release work (`chore: release vX.Y.Z` or feature commits that precede the tag).
5. **Tag** the release commit (must match `fe/package.json` `"version"`):

```sh
git tag v1.0.0-beta.1   # gate examples: v1.0.0-beta.N | v1.0.0-rc.N | v1.0.0
```

6. **Notify** (PR description, chat, or release notes) with: version tag, what shipped, known limitations, next gate.
7. **Push** branch and tags to remotes:

```sh
git push github main --tags
git push gitlab main --tags
```

8. Deploy production build when the gate is a public beta/RC/1.0 cut (`npm run build` in `fe/`, then PM2 per repo root).

Full semver and pre-release patterns: [RELEASING.md § Release checklist](../RELEASING.md#release-checklist).

---

## Already shipped (do not re-plan)

These were listed as pre-beta gaps in an earlier review; they are **done** on `main`:

- [x] Light UI theme (dark/light + light secondary-contrast overrides)
- [x] Neutral explorer backdrop (Oklab L = 0.5)
- [x] Sidebar Viewport preferences footer (2×2 View aids + stacked Performance)
- [x] MacLeod-Boynton / observer diagram labeling clarity (needs occasional real-user validation only)

---

## Phase A — Pre-beta hardening → `1.0.0-beta.1`

**Goal:** First public beta is scientifically defensible and honest about limits.

| ID | Task | Owner | Status | Notes |
|----|------|-------|--------|-------|
| **A1** | **Bradford chromatic adaptation** in shared `DerivedMatrices` (CPU, WebGL, picking parity) | Claude | ✅ | **Done.** `color/adapt.ts` Bradford CAT; `rebuildMatrices` adapts `rgb2xyz` (active white → D65), interchange `white` = D65. D65 gamuts identity. Parity automatic (all consume `DerivedMatrices`; no shader change). Tests in `color/adapt.test.ts`. |
| **A1-alt** | *If A1 slips:* UI guard on non-D65 active gamuts | — | n/a | Not needed — A1 shipped. |
| **A2** | **Gamut-map / Active-gamut copy cleanup** — UI and help match roadmap (terminal map targets active colorspace; sRGB is default, not eternal truth) | Lane 2 | ✅ | `help-copy.ts`, `pipeline-nodes.ts`, `PipelinePopover.svelte` (`693b1b1`). |
| **A3** | **OOG before/after swatch preview** on Gamut Map node | Lane 3 | ✅ | Per-stop before/after chips + active-colorspace copy in `ThemeRamp.svelte` (`6c7bce7`). |
| **A4** | **Schema confidence** — fixtures for v12→v13 and representative real saves in `parse.test.ts` | Claude | ✅ | **Done** (`c026b32`). v12→v13 fixture + lossless round-trips for every bundled example, the default (idempotent), and a divergent multi-list save. |
| **A5** | **Beta limitations** section — README and/or in-app Info panel | — | ✅ | README table + Info panel list (`6f4d5ec`, polished `A5`). WebGL2, gamut-map scope, non-D65 CAT, display assumption. |
| **A6** | **Manual smoke QA** — desktop + mobile critical paths | Claude | 🟡 | Automated Playwright/WebKit smoke pass done (2026-06-16): load, A1 non-D65 render, orbit, pick, slice, cylinder, gamut switch, light/dark + a11y controls, mobile layout — **0 console errors**. Remaining items need human/real-browser sign-off (see checklist + note). |
| **A7** | **Cut `1.0.0-beta.1`** — bump `fe/package.json`, move `[Unreleased]` → dated beta section in CHANGELOG, tag, push, deploy | Claude | 🟡 | **Prep staged (2026-06-16):** version → `1.0.0-beta.1`, CHANGELOG `[1.0.0-beta.1] - 2026-06-16`. **Awaiting user go for tag + push (github/gitlab) + PM2 deploy.** Optional subtle “Beta” near version link in header. |

### A6 — Smoke QA checklist

Legend: ✅ verified by automated pass · 🟡 partially verified · ⬜ needs human / real-browser sign-off.

- [x] 🟡 Orbit / pan / slice / cylinder / morph in Chrome, Firefox, Safari — **orbit, slice, cylinder verified (WebKit/Safari engine); pan + morph not driven.** Chromium renders WebGL via swiftshader but headless screenshots stall in this WSL env; the cached Firefox build couldn't launch (missing profile lock). **Chrome + Firefox engines need a human/real-GPU pass.**
- [x] Pick solid → inspector chain — click placed a marker and populated the sample inspector (WebKit). "Hover matches render" is a visual-parity check, not asserted programmatically.
- [ ] Ramp: add point, undo/redo labels, per-list pipeline, export CSS/DTCG — **not driven through the UI** (controls behind Ramp Builder / Palette tab). Undo/redo affordances present; serialization + per-list pipeline divergence covered by unit tests (`parse.test.ts` A4 round-trips, `theme-spline.test.ts`). Needs human UI pass.
- [ ] Share: copy link + JSON; import file / paste / `#s=…` hash — **not driven through the UI.** The serialize→parse round-trip is covered by `parse.test.ts` (A4). Needs human UI pass.
- [x] 🟡 Light + dark theme; a11y font scale + secondary contrast — light theme toggled live; Font scale (100–175%) and Secondary contrast (Normal/High/Maximum) controls present and functional; dark is the default baseline. Contrast levels not exhaustively screenshotted in both themes.
- [ ] Neutral backdrop on/off; floor grid underside tracks clear color — not driven.
- [x] Mobile layout (≤820px) — 390px viewport renders hamburger, compact toolbar, WebGL solid, and instrument tabs. Drawer open/close not exercised.
- [ ] Document save/reload in `localStorage`; named documents registry — not driven (Save affordance present; partial coverage via parse round-trip tests).

**Spot-check — A1 non-D65 fix (key correctness gate):** switched the active gamut to **NTSC 1953 (Illuminant C)** and **CIE 1931 RGB (Illuminant E)**; in both the solid's white vertex renders **neutral (no tint)** while the xy-chromaticity triangle changes per gamut — confirming the Bradford CAT adapts each white to the D65 interchange point. ✅

**Automated pass details:** Playwright 1.56.0 driving the cached WebKit engine against `vite dev`; 0 console/page errors across load, gamut switching, theme toggle, orbit/pick/slice/cylinder, and mobile resize. `npm run check` 0 errors, `npm test` 145 passed. Cross-browser (Chrome/Firefox) and the interaction-heavy paths above remain for a human smoke pass before the beta is published.

### Phase A gate

- [x] **A1 or A1-alt** complete *(A1 — Bradford CAT)*  
- [ ] **A2–A7** complete  
- [ ] Tag **`v1.0.0-beta.1`** → notify → push → deploy

---

## Phase B — Beta period → `1.0.0-beta.N`

**Goal:** Incorporate feedback; close stability and accessibility gaps before RC freeze.

| ID | Task | Owner | Status | Notes |
|----|------|-------|--------|-------|
| **B1** | Triage beta feedback; ship `1.0.0-beta.2+` as needed | — | ⬜ | Patch-level fixes only; avoid new persisted fields unless critical. |
| **B2** | **Manual accessibility audit** — 100%/150% scale, High/Maximum contrast, dark + light; keyboard through sidebar, dialogs, color picker | — | ⬜ | [accessibility-controls-handoff.md](accessibility-controls-handoff.md) |
| **B3** | **Shared toast / `aria-live`** for import/share errors (generalize `gestureStatus` pattern) | — | ⬜ | Roadmap § Accessibility follow-ups |
| **B4** | Renderer/picker parity regression fixes from beta reports | — | ⬜ | Any hover/pick vs draw disagreement |
| **B5** | Document round-trip hardening from beta reports | — | ⬜ | save → reload → share → import on clean profile |

### Phase B gate

- [ ] No open **severity-1** bugs (data loss, silent wrong color on default sRGB/D65 path)  
- [ ] **B2** signed off  
- [ ] Ready to **freeze scope** for RC  

---

## Phase C — Release candidate → `1.0.0-rc.1`

**Goal:** “We believe this is 1.0.0 unless you find bugs.”

### In scope for RC

| ID | Task | Owner | Status |
|----|------|-------|--------|
| **C1** | **Scope freeze** — no new persisted fields; no pipeline UX renames | — | ⬜ |
| **C2** | Bug bash: documents, share/import, undo, mobile | — | ⬜ |
| **C3** | Production path verified (`npm run build`, PM2, `PUBLIC_*` inlined) | — | ⬜ |
| **C4** | Docs/tutorials match shipped behavior | — | ⬜ |
| **C5** | Optional: `?src=` deep-link ingestion **only if** low risk | — | ⬜ | Deferred in [state-sharing-ingestion-plan.md](state-sharing-ingestion-plan.md); not required for RC |

### Explicitly out of RC (post-1.0)

Do **not** block RC on:

- Display gamut preferences + Color Context UI surface (Roadmap #6)
- Pipeline node UI Phase 2–4
- Direct xy chromaticity picking
- Generic active/display gamut solver (surface-constraint Phase 5)
- `?src=` if not trivial
- WebGPU, HDR, gradient designer, spectral volume overlay

### Phase C gate

- [ ] **C1–C4** complete  
- [ ] Tag **`v1.0.0-rc.1`** → notify → push → deploy  
- [ ] `1.0.0-rc.2+` only for RC fixes

---

## Phase D — Stable v1 → `1.0.0`

**Goal:** Honor semver for app releases; document format stable.

| ID | Task | Owner | Status |
|----|------|-------|--------|
| **D1** | RC feedback resolved; no known sev-1/sev-2 blockers | — | ⬜ |
| **D2** | **Document contract** — breaking save changes require **2.0.0**; additive fields need migration + tests | — | ⬜ |
| **D3** | Final CHANGELOG + Roadmap sync | — | ⬜ |
| **D4** | Tag **`v1.0.0`** → notify → push → deploy | — | ⬜ |

---

## Post-1.0 roadmap (not part of this track)

Sequence after **1.0.0** (see [Roadmap.md](Roadmap.md) Priority summary):

1. Display gamut preferences + Color Context UI (after CAT from A1)
2. Explorer display-gamut classification
3. Generic active-gamut solver / non-sRGB gamut map
4. Pipeline node UI Phase 2
5. Direct xy chromaticity picking
6. Gamut boundary snap tools, gradient designer, etc.

---

## Maintaining this document

- Check off tasks (**⬜ → ✅**) in the same PR that completes the work, or immediately after merge.
- When a gate tag ships, record the date next to the version in **Phase gate** sections.
- Do not duplicate implementation detail here — link to plan docs and keep task rows one line each.
