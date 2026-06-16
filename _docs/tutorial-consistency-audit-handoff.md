# Tutorial consistency audit — handoff to Claude

**Status:** largely resolved (2026-06-16). Remaining gaps tracked below; tutorial system is shipped.  
**Audience:** Claude (author of `tutorial-teaching-points.md`, `tutorial-ui-spec.md`, `tutorial-teaching-points-brief.md`, and `fe/src/lib/inspector/tutorial-steps.ts`)  
**Reporter:** full-lane audit (user + assistant), June 2026  
**Related:** `_docs/tutorial-spline-linear-fix-handoff.md` (spline/linear issue — **fixed locally, not yet committed**)

---

## Summary

A pass over all four tutorial tracks (prelude + A-quick, A-pipeline, B-quick, B-pipeline) found several classes of inconsistency beyond the spline-vs-linear anchor-count bug. Issues fall into:

1. **Try-it instructions that the UI cannot satisfy** (e.g. “sRGB shell”)
2. **Copy that claims features are wired but are not implemented** (`suggestedExample`)
3. **Tutorial copy vs product defaults / UI labels** (gamut map, policy names)
4. **Steps whose success criteria are not guaranteed** (OOG badges, contrast policy)
5. **Document / spec drift** (stale titles, “not yet implemented” header)

The spline/linear fix (three anchors in B-quick step 3, degeneracy notes, `suggestedExample` on Interpolate steps) is in the working tree but **depends on `suggestedExample` UI that does not exist yet** — see issue #2 below.

**You should reason freely** about the best fix for each item. Optimize for honest pedagogy and observable outcomes. Product changes (new shell option, default gamut map, tutorial popover UI) are in scope if copy-only fixes would mislead users.

---

## Already addressed (local, uncommitted)

See `_docs/tutorial-spline-linear-fix-handoff.md` for full context.

| Track | Step | Fix (in working tree) |
|-------|------|------------------------|
| B-quick | 3 | Require **three** anchors; remove `large-color-ramp` from step 3 |
| B-quick | 4 | Document n=2 spline ≡ linear; add `suggestedExample: spline-color-ramp` |
| B-pipeline | 4 | Same degeneracy note; try-it references Spline Color Ramp; add `suggestedExample` |
| Docs | Appendix A | Remap examples; `large-color-ramp` no longer tied to a step |

**Remaining gap:** B-pipeline step 4 try-it says “Load via the suggested example button” — that button is **not implemented** (issue #2).

---

## Critical — try-it cannot work as written

### 1. “sRGB shell” does not exist in the UI

**Affected:** A-quick step 6, A-pipeline step 3, A-quick capstone, A-pipeline capstone, Appendix A (`example:p3-shell` description).

**Try-it says:** Set active gamut to Display P3, enable shell overlay **for sRGB**.

**Ground truth:**

- Active gamut options include sRGB (`LeftControls.svelte` gamut select).
- Reference shell options are: None, DCI-P3, Rec.2020, NTSC, CIE (`ShellKey` in `fe/src/lib/engine/types.ts` — **no `srgb`**).

Users cannot follow the copy literally. The lesson intent (wide gamut solid vs smaller reference cage) may still be teachable by **inverting** the setup: e.g. **sRGB solid + P3 shell** (smaller volume inside a larger wire cage), or by adding `srgb` to `ShellKey` and the shell select.

**Suggested directions:**

- **Product:** Add `srgb` to shell options if P3-solid / sRGB-cage is the canonical comparison view.
- **Copy-only:** Rewrite try-it to use available shells and describe what the user should see.
- **Example:** Fix `example:p3-shell` snapshot (currently `gamut: 'p3'`, `shell: 'p3'` — see #2).

---

### 2. `example:p3-shell` does not match the taught lesson

**Affected:** A-quick step 6 `suggestedExample`, Appendix A, example guide note.

**Snapshot** (`fe/src/lib/engine/state.svelte.ts`):

- `gamut: 'p3'`
- `shell: 'p3'`

The example’s own guide note says the wire shell outlines the **same** boundary as the solid. Appendix A and step copy claim “P3 solid + sRGB shell” / gamut comparison via shell.

Loading this example does **not** demonstrate P3 vs sRGB. It does not match step 6 try-it even if the user could select an sRGB shell.

**Suggested directions:** Set `shell` to a gamut that is visually smaller than P3 (if sRGB shell is added), or change example name/copy to match what it actually shows (P3 + cylindrical clip, etc.).

---

### 3. `suggestedExample` is defined but not surfaced in the UI

**Affected:** All steps with `suggestedExample` in `tutorial-steps.ts`:

| Step | Example id |
|------|------------|
| A-quick 6 | `example:p3-shell` |
| A-quick 7 | `example:oklab-l-slice` |
| B-quick 4 | `example:spline-color-ramp` |
| B-pipeline 4 | `example:spline-color-ramp` |

**Ground truth:**

- Field exists on `TutorialStep` with comment: *“not auto-loaded.”*
- `_docs/tutorial-ui-spec.md` §10 type definition documents the field.
- **`TutorialPopover.svelte` and `LanePicker.svelte` do not read `suggestedExample`.** No “Load example” affordance exists in the tutorial popover.
- `tutorial-teaching-points.md` now states steps are “wired as `suggestedExample`” — **misleading until UI exists.**

**Impact:** B-pipeline step 4 try-it explicitly instructs loading via a button that is not there. Optional examples for slice/shell/spline are invisible unless the user discovers examples in the document bar.

**Suggested directions:**

- **Implement** in `TutorialPopover.svelte` per ui-spec intent (button → `session.loadDocument(exampleId)` or equivalent, with dirty-doc confirm).
- **Or** remove `suggestedExample` claims from markdown and rewrite try-it to use Document bar / examples menu until UI ships.
- Update `tutorial-ui-spec.md` §4 popup anatomy with the Load example row if implementing.

---

## High — copy vs defaults / UI labels / targets

### 4. Gamut map default is `none`, not clip

**Affected:** B-quick steps 6–7, B-pipeline step 7, glossary/export copy across ramp tracks.

**Tutorial says:** Default gamut map **clips to sRGB**; change to `"none"` or `"oklch-c"` for wide-gamut export.

**Ground truth** (`createExplorerDefaults()` in `fe/src/lib/engine/state.svelte.ts`):

```ts
gamutMap: 'none',
```

New documents start at **None (show OOG)**. Export may already pass OOG values through unchanged. Common-mistake text that says “default clips” is wrong for new users on a blank document.

**Suggested directions:** Align all tutorial copy with actual defaults, **or** change product default to `clip` if that matches the pedagogical story (breaking change — coordinate with product owner).

---

### 5. Tutorial says `oklch-c`; UI says “Preserve chroma”

**Affected:** B-pipeline step 7 (Gamut map), B-quick step 7 (Export common mistake).

**Tutorial copy:** `oklch-c`, `oklch-c reduces chroma…`

**UI** (`ThemeRamp.svelte` `GAMUT_MAP_OPTIONS`):

- `preserve-chroma` → label **“Preserve chroma”**
- (Also: clip, none, project-*, adaptive-* — not all mentioned in tutorials)

Users following tutorial text may not find the control named in the lesson.

**Suggested directions:** Use UI labels in try-it (“Preserve chroma”) with optional internal id in parentheses, or rename UI to match docs.

---

### 6. B-quick step 4 — solid opacity vs highlight target

**Try-it:** “In the **Gamut** step, lower Solid opacity…”

**Popover target:** `[data-tutorial="node-interpolate"]` (Interpolate group).

Solid opacity slider lives under **Gamut** (`node-gamut`). Default `openSteps` includes `gamut`, so users can find it, but the highlight arrow points at the wrong pipeline step.

**Suggested directions:** Dual-target note in copy, split into two micro-actions, or retarget / add secondary highlight for opacity step.

---

## Medium — success criteria not guaranteed

### 7. B-quick step 6 — OOG indicators may never appear

**Try-it / success check:** Look for OOG indicators; “OOG stops are flagged.”

With three in-gamut sRGB picks, Oklab/Oklch interpolation, and `gamutMap: 'none'`, stops may all be in-gamut. Success check can be vacuously satisfied without teaching OOG.

**Suggested directions:** Optional high-chroma Oklch setup, load an example with known OOG stops, or soften success check (“if any OOG stops exist, they are flagged”).

---

### 8. B-pipeline step 7 — OOG-dependent gamut-map demo

**Try-it:** “Build a ramp that crosses outside sRGB… Note the OOG badge.”

No example load or preset. Depends on anchor choices and interpolation space. Easy to complete with **zero OOG stops** and no visible clip vs preserve-chroma difference.

**Suggested directions:** `suggestedExample` with a wide-gamut path, or explicit setup (Oklch, high chroma, arc-long) in try-it.

---

### 9. B-pipeline step 5 — contrast policy success check is strict

**Success check:** Every stop’s WCAG ratio is within `[contrastMin, contrastMax]`.

**Implementation** (`theme.ts` `placeList`, `place === 'contrast'`): targets are spaced across the range; each stop snaps to the **nearest** curve sample by contrast value. Arbitrary ramps may not achieve exact in-range ratios for every stop.

**Suggested directions:** Soften wording (“approximately in range” / “cluster toward targets”), or document that short ramps / narrow curves may approximate poorly.

---

### 10. Loading Spline Color Ramp on step 4 can undo step 3 (B-pipeline)

B-pipeline step 3 adds a **second list**. Step 4 try-it encourages loading `example:spline-color-ramp` (single list, 7 anchors). Steps 8–9 assume **two lists** for export counting and multi-list capstone.

Users who load the example lose the multi-list setup unless they rebuild it.

**Suggested directions:** Warn in step 4 copy; load example only on a spare document; use a multi-list example; or defer example load to a step that doesn’t conflict.

---

### 11. Tutorial does not reset document state on start

`tutorial.start()` (`tutorial.svelte.ts`) skips prelude steps based on current `ExplorerState` but does **not** apply a blank document or track-specific baseline.

Residual anchors, lists, examples, or settings from a prior session can make success checks pass/fail unpredictably.

**Suggested directions:** Optional “Start with blank document” on lane pick; per-track recommended baseline; or prelude step 0 “New document recommended.”

---

### 12. B-pipeline steps 3 and 9 overlap

Step 3 introduces two lists; step 9 (Multi-list ramps) repeats two-list + Expand exercise. Not wrong, but redundant if the user followed step 3 closely.

**Suggested directions:** Merge, shorten step 9, or make step 9 explicitly capstone-style (“verify you still have two lists from step 3…”).

---

## Low — documentation drift

### 13. Summary table stale (B-quick)

`tutorial-teaching-points.md` summary table still says B-quick end capability is from **“2–3 source colors”**; step 3 and `tutorial-steps.ts` now require **three**.

---

### 14. `tutorial-ui-spec.md` out of date

| Issue | Spec says | Reality |
|-------|-----------|---------|
| Header status | “design spec, **not yet implemented**” | Tutorial system shipped (`TutorialPopover`, `LanePicker`, `tutorial.svelte.ts`) |
| B-quick step 3 title | “Add two or three source colors” | “Add three source colors” |
| Step targets | `gamut-select`, `shell-select`, `slice-toggle` | Implementation uses `data-tutorial="node-gamut"`, `node-clip` on `ControlGroup` |
| `skipCount` / adaptive prelude | May be incomplete vs `tutorial.svelte.ts` | Prelude skip is implemented |

---

### 15. Appendix B topics not in step try-it

Appendix B maps **surface constraint** and **arcLong** to B-pipeline step 4. Step try-it does not mention toggling surface constraint or arc-long. `example:spline-color-ramp` uses surface-snapped anchors — a natural hook that is unused in step copy.

---

### 16. A-pipeline gamut step lacks `suggestedExample`

A-quick step 6 has `suggestedExample: example:p3-shell`. A-pipeline step 3 has similar shell try-it but **no** `suggestedExample`. Asymmetric once #3 is fixed.

---

## Lanes that audit clean (after spline fix)

| Area | Notes |
|------|--------|
| **Prelude** | Matches showcase defaults; `skip` when `!autoRotate` / `!hideAids` works. |
| **A-quick 3–5, 8** | Orbit, hover, gamut switch — work on default doc. |
| **A-quick 7** | Slice try-it self-contained; `oklab-l-slice` example matches content (if loadable). |
| **A-pipeline 4–8** | World, tessellation (+ slice in try-it), clip, view, CVD — generally self-contained. |
| **B-quick 3, 5, 7–8** | Coherent with three anchors and default `interpolateOn` / `placeOn`. |
| **B-pipeline 5–6, 8** | Place, Expand, export counting — OK if prior state is sane. |

---

## Files to update (checklist)

When fixing, keep layers aligned:

- [ ] `fe/src/lib/inspector/tutorial-steps.ts` — runtime popover copy (authoritative for UI text)
- [ ] `_docs/tutorial-teaching-points.md` — teaching content + appendices
- [ ] `_docs/tutorial-ui-spec.md` — step table, popover anatomy, implementation status
- [ ] `_docs/tutorial-teaching-points-brief.md` — only if step scope changes
- [ ] `fe/src/lib/components/TutorialPopover.svelte` — `suggestedExample` affordance (if implementing #3)
- [ ] `fe/src/lib/engine/state.svelte.ts` — `EXAMPLE_STATES` / `example:p3-shell` (if fixing #2)
- [ ] `fe/src/lib/engine/types.ts` + `LeftControls.svelte` — shell options (if adding sRGB shell #1)
- [ ] `fe/src/lib/components/ThemeRamp.svelte` — only if renaming gamut-map labels (#5)

---

## Acceptance criteria (audit complete)

1. No try-it references a control that does not exist (shell gamut, example button, policy name).
2. Every step’s try-it produces a **meaningful, attributable** visual or reading change on a blank document (or copy explains prerequisites / optional example).
3. `tutorial-steps.ts`, `tutorial-teaching-points.md`, and `tutorial-ui-spec.md` agree on step titles, example hooks, and implementation status.
4. Tutorial copy matches **current** defaults (`gamutMap`, `hideAids`, `solidAlpha`, etc.) or defaults are intentionally changed with eyes open.
5. `suggestedExample` either works in the popover or is not claimed in markdown.
6. Example snapshots match Appendix A and the steps that reference them.

---

## Reasoning license

You have full discretion to:

- Change product behavior (shell list, defaults, popover UI) when copy-only fixes would lie to users
- Reorder or merge steps within lane budgets
- Add warnings instead of new steps where overlap is pedagogical
- Deprecate or rename examples (`p3-shell`) to match reality
- Split this work across multiple PRs (shell + examples vs gamut-map copy vs popover UI)

Prioritize **critical** and **high** items before polish on **low** doc drift.

---

## Reference map

| Topic | Primary files |
|-------|----------------|
| Step copy | `fe/src/lib/inspector/tutorial-steps.ts` |
| Teaching docs | `_docs/tutorial-teaching-points.md` |
| UI spec | `_docs/tutorial-ui-spec.md` |
| Defaults | `fe/src/lib/engine/state.svelte.ts` → `createExplorerDefaults()` |
| Examples | `fe/src/lib/engine/state.svelte.ts` → `EXAMPLE_STATES` |
| Shell UI | `fe/src/lib/components/LeftControls.svelte`, `fe/src/lib/engine/types.ts` |
| Gamut map UI | `fe/src/lib/components/ThemeRamp.svelte` |
| Tutorial runtime | `fe/src/lib/engine/tutorial.svelte.ts`, `fe/src/lib/components/TutorialPopover.svelte` |
| Spline n=2 | `fe/src/lib/engine/theme.ts` (~278–280), `_docs/tutorial-spline-linear-fix-handoff.md` |
