# Color Context + Display gamut — implementation plan

**Status:** plan (2026-06-16) · **Branch:** `next` (post-1.0 feature work) · **Owner:** Claude (colorimetry).
**Roadmap:** #1 (Color-space role cleanup + global Color Context) and #6 (Display gamut preferences + Color Context UI).
**Canonical model:** [color-space-role-architecture.md](color-space-role-architecture.md) — this plan implements it; it does not redefine it.

## Goal

Give Color Lab an explicit **Display gamut** (what the user's monitor can show) distinct
from the **Active gamut** (working/output intent), and surface both in a small **global
Color Context** area — fulfilling the role model now that its prerequisite (A1 Bradford
CAT, shipped in beta.1) is in place.

## Non-goals (stay deferred)

- Custom display calibration / manual primaries wizard (Roadmap #18).
- Generic non-sRGB active-gamut **ramp** mapping solver (#17 / surface-constraint Phase 5).
- Projected Explorer "show as my display would" preview (#6+, after classification).
- Any document **schema** change. Display gamut is device preference → `localStorage` only.

## Role recap (binding constraints)

- **Active gamut** = working/output intent. Today: `explorer.gamut` (`GamutKey`), selected in
  the Explorer `Gamut` step (`LeftControls.svelte:135`). Drives the solid, in-gamut checks,
  ramp output target. Stays document/app state.
- **Display gamut** = device capability. New. `localStorage` preference, default `srgb`.
- **World space** stays an Explorer pipeline step (do not move).
- Ramp terminal Gamut Map **must never** target the Display gamut (it targets Active).
- Don't relocate the Active-gamut selector until the Color Context surface can stand on its
  own — otherwise the UI loses its only gamut control.

## Data model

`displayGamut` joins the existing app-preference bundle (`preferences/app.svelte.ts`,
`colorlab:preferences`) alongside `theme`, `observerModel`, etc. — same sanitize + persist
+ snapshot-validation path.

```ts
// Phase 1: reference a built-in gamut (the display profiles are a curated subset of GAMUTS).
export type DisplayGamutId = 'srgb' | 'p3' | 'rec2020';
// DEFAULT_APP_PREFERENCES.displayGamut = 'srgb'
```

Forward-compat note: when custom profiles arrive (Phase 4) this widens to a tagged union
(`{ kind: 'builtin'; id } | { kind: 'custom'; primaries; white }`). That is an **additive,
non-breaking** change because it lives in `localStorage` prefs with a sanitizer, not the
document schema. Build the sanitizer now so unknown values fall back to `srgb`.

Display profiles reuse the `GAMUTS` registry primaries/white (`color/pipeline.ts`): sRGB,
P3, Rec.2020 are all D65; that keeps Phase 1's adaptation a no-op (good — ship the data and
UI before the shader math).

## Progress

- ✅ **Phase 1 data** (`c6347a9`) — `displayGamut` preference + sanitizer + setter + tests.
- ✅ **Phase 2** — `ColorContext.svelte` pinned at the top of the left sidebar (per the chosen
  placement): Active gamut selector (**mirrors** `explorer.gamut`; the Explorer Gamut step's
  selector is intentionally kept for now per the doc's "mirror, then move"), Display gamut
  selector (delivers Phase 1's deferred control), and a chromaticity-containment over-gamut
  warning. Verified in WebKit (warning toggles correctly, display pref persists, 0 errors).
- ⬜ **Phase 2b follow-up** — once validated, remove the duplicate gamut select from the
  Explorer Gamut step and retarget the A-pipeline "Gamut — primaries and transfer" tutorial
  to `[data-tutorial="color-context"]`; rescope the Explorer Gamut step to shell/overlays/opacity.
- ⬜ **Phase 3** — active↔display Bradford CAT in `DerivedMatrices` + shader classification.
  Note: the Phase 2 warning is **chromaticity-only** (primary containment in xy); Phase 3 adds
  the luminance/white-aware shader classification.

## Phases (each independently shippable)

### Phase 1 — Display-gamut preference: data + minimal control
- Add `displayGamut` to `AppPreferences`, `DEFAULT_APP_PREFERENCES`, the sanitizer, and the
  read/persist helpers; add a `setDisplayGamut(id)` like `setUiTheme`.
- Round-trip + sanitize tests in `preferences/app.test.ts` (unknown → `srgb`).
- Minimal UI: a Display-gamut `<select>` (sRGB / P3 / Rec.2020) in an existing prefs area
  (Viewport preferences footer is the low-risk home) with copy: "what your screen can show;
  used for on-screen accuracy, not export." **No rendering change yet.**
- Ships value immediately (persisted device setting) with near-zero risk.

### Phase 2 — Global Color Context surface
- Add a compact Color Context strip/panel above the Explorer + Ramp lanes containing:
  Active gamut selector (relocated from the Explorer Gamut step), Display gamut summary,
  and a warning chip when Active gamut ⊄ Display gamut (e.g. Active P3 on an sRGB display).
- Progressive copy first: relabel the existing selector "Active gamut"; only physically move
  it once the strip is real (mirror, then move — never leave zero selectors).
- Re-scope the Explorer `Gamut` step to its Explorer-only controls (reference shell,
  chromaticity/spectral overlays, solid opacity, future display-mapping toggle).
- **Layout decision needed** (see below) — touches `AppShell.svelte` grid.

### Phase 3 — Active↔Display chromatic adaptation + classification
- Extend `DerivedMatrices` (`renderer/uniforms.ts`) with display-gamut matrices and an
  active→display Bradford CAT via the existing `color/adapt.ts` (identity when whites match;
  all D65 today so it's a no-op until a non-D65 display profile exists). Keep CPU/GPU/picker
  parity (single shared bundle — the A1 pattern).
- Explorer **display-gamut classification** (shader first, #8): flag Active-gamut colors that
  fall outside the Display gamut. Visualization (intersection/outliers) follows.
- Adaptation-matrix unit tests extend `color/adapt.test.ts`.

### Phase 4 — later (out of initial scope)
Custom display profiles + calibration (#18); projected display preview (#6+).

## Decisions to confirm before Phase 2

1. **Color Context placement.** Options: (a) a slim full-width strip as a new top row in the
   `AppShell` grid above both lanes; (b) a header-anchored popover (like Readability/About);
   (c) a section pinned at the top of the left sidebar above the Pipeline rail. (a) matches
   the architecture doc's "strip/panel above the lanes" best but costs vertical space and a
   grid-row change. **Recommendation: (a)**, slim and collapsible.
2. **Active-gamut storage.** Confirm `explorer.gamut` stays the source of truth and the
   Context surface just hosts its control (no migration). I believe yes — only the control
   moves, not the state.

## Testing & parity

- `preferences/app.test.ts`: displayGamut persistence + sanitize fallback.
- `color/adapt.test.ts`: active↔display CAT identity (D65) and a synthetic non-D65 case.
- Manual: switch Active = P3 with Display = sRGB → over-gamut warning; D65 profiles keep the
  solid unchanged (adaptation no-op).

## Suggested commit sequence (on `next`)

1. Phase 1 data (`preferences/app.svelte.ts` + tests) — no UI.
2. Phase 1 UI (Display gamut select in Viewport prefs).
3. Phase 2 Color Context surface (after layout decision).
4. Phase 3 matrices + classification (largest; colorimetry core).
