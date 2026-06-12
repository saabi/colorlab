# Tutorial handoff: linear vs spline with too few anchors

**Status:** open — content + implementation mismatch  
**Audience:** Claude (author of `tutorial-teaching-points.md`, `tutorial-ui-spec.md`, and `fe/src/lib/inspector/tutorial-steps.ts`)  
**Reporter:** code review (user + assistant), June 2026

---

## Summary

B-quick step 4 (track step 4/8) instructs users to switch between **linear** and **spline** interpolation and observe the curve change. B-quick step 3 only asks for **two** source anchors. With exactly two anchors, **spline and linear produce identical paths** in Color Lab. Users following the tutorial in order will see no difference and may think the control is broken.

The same pitfall exists in B-pipeline step 4 if the user arrives with only two anchors per list (step 3 adds two anchors per list). The markdown teaching doc partially fixes this for B-pipeline by loading `example:spline-color-ramp`; the **implemented** `tutorial-steps.ts` does not.

**You should reason freely** about the best fix. Suggestions below are starting points, not requirements.

---

## Ground truth (engine)

In `fe/src/lib/engine/theme.ts`, `interpolateList()` documents:

```278:280:fe/src/lib/engine/theme.ts
	// 2. Hi-res curve in coord space. Linear = piecewise straight through the points;
	//    spline = centripetal Catmull-Rom with reflected virtual endpoints (a straight
	//    line at n = 2, so segment/arc are exactly the linear case).
```

With **n = 1**: degenerate single-sample curve.  
With **n = 2**: spline path equals linear chord in interpolation space (before/after surface snap, the coord-space path is the same).  
With **n ≥ 3**: spline can diverge from linear (especially visible with more control points and in cyclic spaces like Oklch).

Do not teach spline-vs-linear on a two-anchor ramp unless the lesson is explicitly “they are the same here.”

---

## What still works with two anchors

These are valid step-4 teaching goals with only two points:

- **Interpolation space** (Oklab ↔ Oklch ↔ sRGB, etc.) — path shape changes.
- **Solid opacity** — making the curve visible through the solid.
- **Interpolate on** — continuous path vs anchors-only (with Place off).
- **Surface constraint** — affects both modes along the same chord; not a linear-vs-spline differentiator.

---

## Current content map

| Artifact | B-quick step 3 | B-quick step 4 | B-pipeline step 4 |
|----------|----------------|----------------|-------------------|
| `tutorial-teaching-points.md` | Try: 2 picks | Try: linear↔spline + space; success check mentions “>2 anchors” | Try: **load Spline Color Ramp**, then linear↔spline |
| `tutorial-steps.ts` (shipped UI) | Try: 2 picks; `suggestedExample: large-color-ramp` | Try: linear↔spline + space; success check mentions “>2 anchors” | Try: linear↔spline + space only; **no** example load |
| `tutorial-ui-spec.md` | Step titles only | Step titles only | Step titles only |
| Appendix A (`teaching-points.md`) | `large-color-ramp` → B-quick step 3 | `spline-color-ramp` → B-quick step 4 | `spline-color-ramp` → B-pipeline Interpolate |

**Drift:** markdown B-pipeline step 4 ≠ `tutorial-steps.ts`. Appendix A assigns `spline-color-ramp` to B-quick step 4 but neither step 3 nor step 4 tells the user to load it in the shipped script.

### Shipped copy (authoritative for popover UI)

B-quick step 3 — `fe/src/lib/inspector/tutorial-steps.ts`:

- Title: “Add two or three source colors”
- Try it: pick **two** anchors on the solid
- `suggestedExample: 'example:large-color-ramp'` (2-anchor example)

B-quick step 4:

- Try it: “…switch between linear and spline… Try switching from Oklab to Oklch…”
- Success check: “With **more than two anchors**, spline produces a smooth arc…”

B-pipeline step 4:

- Try it: “Switch between linear and spline…” — no example load, no `suggestedExample`

### Markdown copy (partially ahead of implementation)

B-pipeline step 4 in `tutorial-teaching-points.md` correctly says:

> Load "Spline Color Ramp" (`example:spline-color-ramp`). Switch between linear and spline…

B-quick step 4 in the same file has the same linear↔spline try-it as the shipped script (no example load).

### Capstone (markdown only)

`tutorial-teaching-points.md` B-quick capstone correctly uses **three** anchors + spline. There is no capstone step in `tutorial-steps.ts` — only the eight track steps plus prelude.

### Examples

| Example id | Anchors | Notes |
|------------|---------|-------|
| `example:large-color-ramp` | 2 | Linear Oklch ramp; wired as B-quick step 3 `suggestedExample` |
| `example:spline-color-ramp` | 7 | Surface-snapped; Appendix A maps to B-quick step 4 and B-pipeline Interpolate |

---

## B-quick (fast ramp lane) — detailed issue

### Step 3 — “Add two or three source colors”

- Title allows three; **Try it** only adds two.
- Capstone (markdown) correctly uses **three** anchors + spline.
- `suggestedExample` points at a **2-anchor** ramp, which reinforces the two-point setup.

### Step 4 — “Interpolate on — linear vs spline”

- **Try it** leads with linear ↔ spline — **no visible change** after step 3 as written.
- **Success check** already says spline needs “more than two anchors” — correct, but buried; Try it does not set up ≥3 anchors.
- **Common mistake** covers world vs interpolation space only (useful, orthogonal).
- **Interpolation space** (Oklab ↔ Oklch) *does* change the path with 2 anchors — still a valid exercise.

### Suggested directions (pick one or combine — use your judgment)

1. **Add a third anchor in step 3**  
   Align title, try it, and success check. Step 4 linear↔spline becomes observable. Slightly longer step 3; still fits “quick” lane.

2. **Reframe step 4 for two-anchor ramps**  
   Primary exercise: **interpolation space** (Oklab ↔ Oklch). Mention linear vs spline briefly: “with only two points they coincide; add a third or load Spline Color Ramp to see spline bend.” Defer spline demo to capstone or B-pipeline.

3. **Use `suggestedExample` on step 4**  
   Offer or instruct loading `example:spline-color-ramp` before linear↔spline. Tradeoff: step 4 no longer continues the user’s own ramp from step 3 unless step 3 also pointed at an example.

4. **Split step 4**  
   4a: interpolation space + opacity (works with 2 anchors).  
   4b: path mode (requires ≥3 anchors or example).  
   Only if track length / UI budget allows.

**Lean suggestion:** (1) or (2)+(3) for B-quick — quick lane should feel continuous from step 3; three picks is low cost and matches the capstone.

---

## B-pipeline (deep dive lane) — detailed issue

### Step 3 — Sources

- Adds second list with **two** anchors each → two-point lists if user started from scratch.

### Step 4 — Interpolate (`tutorial-teaching-points.md`)

- Correctly: load **`example:spline-color-ramp`**, then linear↔spline and space changes.

### Step 4 — `tutorial-steps.ts`

- Missing example load; try it assumes an interesting anchor set already exists.
- No `suggestedExample` on this step.
- Success check only tests **Oklch vs sRGB** understanding, not spline vs linear.

### Suggested directions

1. **Sync `tutorial-steps.ts` with markdown** — load `example:spline-color-ramp` (or `suggestedExample`) at start of step 4; add to try it and/or lane picker example button.

2. **Step 3 alternative** — add **≥3 anchors** to list 1 (or use spline example at end of Sources) so pipeline track is self-consistent without a mid-track example swap.

3. **Concept copy** — one sentence in step 4 concept: “With two anchors, spline and linear are identical; this step uses a multi-point example.”

4. **Success check** — optionally require user to describe **both** space change and spline-vs-linear on the loaded example.

**Lean suggestion:** sync implementation to markdown + explicit `suggestedExample` on B-pipeline step 4; optional one-line degeneracy note in concept.

---

## Tutorial system notes

- `suggestedExample` on a step offers a **“Load example” affordance** — it is **not** auto-loaded (`tutorial-steps.ts` interface comment).
- Prelude steps can `skip` when `autoRotate` is off or `hideAids` is off; unrelated to this bug but relevant if you change step prerequisites.
- After fixing copy, decide which file is **source of truth** (`tutorial-steps.ts` vs `tutorial-teaching-points.md`) and keep them aligned.

---

## Files to update (checklist)

When you fix this, touch every layer so docs, UI copy, and examples stay aligned:

- [ ] `fe/src/lib/inspector/tutorial-steps.ts` — prelude + B-quick + B-pipeline steps (authoritative for popover text)
- [ ] `_docs/tutorial-teaching-points.md` — keep in sync with `tutorial-steps.ts` (or mark which is source of truth)
- [ ] `_docs/tutorial-ui-spec.md` — step titles / example hooks if `suggestedExample` changes
- [ ] `_docs/tutorial-teaching-points-brief.md` — only if scope of B-quick/B-pipeline steps changes
- [ ] Appendix A example map — ensure example ↔ step ↔ try-it instructions agree
- [ ] Optional: capstone text in markdown if step 3/4 responsibilities shift

---

## Acceptance criteria

1. Following **B-quick steps 3→4 in order** on a **blank document**, the user can complete step 4’s **Try it** and see a **meaningful** visual change attributed to the taught control (or copy clearly states why not and what to do next).
2. **B-pipeline step 4** try-it does not depend on invisible spline-vs-linear toggling on two-anchor lists.
3. `tutorial-steps.ts` and `tutorial-teaching-points.md` do not contradict each other on step 4.
4. Appendix A example assignments match what steps tell users to load or build.
5. No false claim that spline “bends” with only two anchors unless the lesson is “no difference yet.”

---

## Reasoning license

You coded the tutorial system. You have full discretion to:

- Reorder or merge steps within the 8/9-step budgets
- Change step 3 vs step 4 responsibilities
- Prefer user-built ramps vs example documents
- Adjust success checks and common mistakes
- Update adaptive prelude skipping if step prerequisites change
- Add a capstone step to `tutorial-steps.ts` if that helps pedagogy

Optimize for **honest pedagogy** and **observable outcomes**, not for preserving the current step titles.

---

## References

| File | Relevant sections |
|------|-------------------|
| `fe/src/lib/engine/theme.ts` | `interpolateList()`, n=2 comment (~lines 278–280) |
| `fe/src/lib/engine/theme-spline.test.ts` | linear mode two-endpoint tests |
| `fe/src/lib/inspector/tutorial-steps.ts` | `B_QUICK_STEPS[0–1]`, `B_PIPELINE_STEPS[0–1]` |
| `_docs/tutorial-teaching-points.md` | B-quick steps 3–4, B-pipeline step 4, Appendix A |
| `_docs/tutorial-ui-spec.md` | Step table, example wiring |
| `fe/src/lib/engine/state.svelte.ts` | `EXAMPLE_STATES` — `large-color-ramp`, `spline-color-ramp` |
