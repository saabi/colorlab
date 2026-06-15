# Plan: Generalize & Simplify the Ramp Pipeline

Status: **implemented** — Stages 1 (1a/1b/1c), 2, and 3 are shipped; the legacy
`spread` mode has been folded into the Expand stage (mode is now just
linear|spline; spread is an Expand operator over a single-seed ramp); and both
follow-ups — explicit contrast-ladder targets (Place) and the hue-harmony
expander (Expand: complementary/triadic/analogous/tetradic) — are shipped. The
live pipeline is Sources → Interpolate → Place → Expand → Gamut-map → Export.
No ramp-pipeline follow-ups outstanding. (Minor tidy: `theme.aa` is now dead
state and could be dropped from the persisted theme.)

Subsequent display/interaction work is tracked separately in
[ramp-display-plan.md](./ramp-display-plan.md).

Storage note: this historical plan uses `ThemeAnchor = { srgbLin }` examples
because that was the implementation at the time. Roadmap direction now requires
source colors to be stored in gamut-independent `XYZ D65` (or equivalent), with
active-gamut RGB and world coordinates derived at runtime. See
[`color-space-role-architecture.md`](color-space-role-architecture.md).

## Summary

The ramp side carries avoidable redundancy and a few missed generalizations:

- **Two storages for one concept.** `theme.A` / `theme.B` (seg/arc/spread) and `theme.controlPoints` (spline) are the *same type* (`ThemeAnchor = { srgbLin }`) — duplicated storage, pick paths, and UI.
- **Three "algorithms" that are one.** Segment and Hue arc are degenerate cases of the spline interpolator (proof below), differing only by *path type* and *interpolation space*.
- **`Spread` is mis-placed.** It is not an interpolation between sources; it is a *per-stop generator*. Moved after interpolation and applied to each placed stop, it becomes a generic way to produce **sets of ramps (2-D palettes)**.
- **`Adjust` is imperative.** WCAG-fit / even-spacing are destructive one-shot buttons; they should be a declarative *placement* rule, which also subsumes contrast-ladder and fixed-tone sampling used by other tools.

Target architecture (each stage independently shippable):

```text
Sources → Interpolate → Place → Expand → Gamut-map → Export
```

- **Sources** — one ordered `points: ThemeAnchor[]` list (replaces A/B + controlPoints).
- **Interpolate** — one engine: `pathType (Linear | Catmull-Rom) × space (cartesian/cylindrical) × N points`, with cyclic-hue direction. Segment/Hue arc/Spline become *presets*.
- **Place** — declarative sampling of the path: uniform-t, even ΔE (Oklab), target-contrast ladder, fixed-lightness tones. (Generalizes today's Adjust.)
- **Expand** — per-stop (or per-source) generators that turn each color into a *set*, producing a 2-D palette. `Spread` is the first operator.
- **Gamut-map → Export** — unchanged in concept (Export gains a palette/grid shape in stage 3).

---

## 1. Why Segment and Arc are special cases of Spline

- **Segment = Spline at 2 points.** Centripetal Catmull-Rom through exactly two points, using the reflected virtual endpoints we already build (`P₋₁ = 2P₀ − P₁`, `P_n = 2P_{n-1} − P_{n-2}`), has equal end-tangents of `P₁ − P₀` — i.e. the segment is algebraically a **straight line**. No approximation.
- **Hue arc = Linear interpolation in a cylindrical space.** Arc interpolates `(r, θ, y)` linearly with hue as an angle. The interpolator already supports cylindrical spaces (OKLCH / CIELCh / CIELCh(uv) / OKHSV) with shortest-arc hue unwrapping; `arcLong` is just the hue **direction** choice the unwrap step already makes.

So the only real axes are:

1. **Path type** — *Linear* (piecewise-straight through N points) vs *Catmull-Rom* (smooth through N points). They **coincide at 2 points**; they only differ at N ≥ 3.
2. **Interpolation space** — cartesian (Oklab/CIELAB/sRGB) vs cylindrical (OKLCH/…); cylindrical is what makes a ramp an "arc."

Mapping the legacy modes:

| Legacy mode | Unified config |
|---|---|
| Segment | Linear + cartesian (or "World") space |
| Hue arc | Linear + cylindrical space (+ direction = `arcLong`) |
| Spline | Catmull-Rom + any space |
| Spread | **not an interpolator** — becomes an Expand operator (stage 3) |

**Decision: keep Segment / Hue arc / Spline as one-click presets backed by the single interpolator; drop them as separate algorithms.** Presets keep basic 2-color workflows trivial; the `space` picker (incl. cylindrical, for heatmaps/diverging) and `pathType` are always available for power use.

### The one real subtlety: "World" space

Today **Segment interpolates in the *world geometry as shown*** (a straight 3-D line in whatever `spaceMode` is active), while the interpolator's spaces are fixed *color* spaces. They coincide only when the chosen space matches the world (e.g. world=Oklab + space=oklab). To make Segment a faithful special case for *every* world space (XYZ, Luma, RGB cube):

- **Decision:** add a **"World (as shown)"** interpolation space — interpolate in the active world coordinates, then map back. It is genuinely useful (spline-in-the-geometry-you-see) and makes the subsumption exact. Note it is **stateful** (needs `spaceMode` + matrices), unlike the current stateless `interp.ts` registry, so it gets a small special path in `buildRamp` rather than a registry entry, or the registry gains an optional state argument.

---

## 2. Unify the sources (the A/B-vs-control-points redundancy)

Replace `theme.A`, `theme.B`, `theme.controlPoints` with a single ordered:

```ts
theme.points: ThemeAnchor[]      // persisted
theme.selectedPoint: number | null   // runtime UI selection (not persisted)
```

- Each mode/preset consumes a prefix: spread-seed → `points[0]`, 2-point presets → `points[0..1]`, spline/multi → all.
- The `arm` trichotomy (`'A' | 'B' | 'spline-add'`) collapses to **selection + pick**: a viewport pick replaces the selected point, or appends when none is selected / "add" is armed.
- **Merge the `Pick` and `Anchors/Points` steps** into one **Sources** step (the list + the pick affordance + touch tool). They are "acquire a source" vs "manage the sources" — one concern.
- Keep **A / B labels** in the UI for 2-point presets (badge `points[0]`="A", `points[1]`="B") so the "from A to B" mental model survives.

`ThemeAnchor` is already the shared type, so this is a storage + UI consolidation, not a type change.

### Persistence (breaking — Playbook C)

Bump schema; migrate `theme`:

```text
points = (mode === 'spline') ? controlPoints : [A, B].filter(Boolean)
```

Handle docs with both set (prefer by old mode). Drop `A` / `B` / `controlPoints`; `selectedCp → selectedPoint`. Add a `parse.test.ts` fixture for each legacy mode.

---

## 3. The staged architecture & a survey of what it must cover

Surveying typical theme/color tools and mapping each capability to a stage:

| Stage | Operation | Tools / features it covers |
|---|---|---|
| **Interpolate** | sources → continuous path (pathType × space × N) | chroma.js / culori scales, viridis & ColorBrewer **sequential**, **diverging = 3-point spline**, heatmaps (cylindrical spline), ColorBox (per-channel easing = a path option) |
| **Place / sample** | where the N stops sit on the path | even ΔE & WCAG-fit (today's Adjust), **Leonardo** (target-contrast ladder), **Material/HCT & Tailwind** (fixed-lightness tones), Accessible Palette |
| **Expand / generate** | each color → a *set* (→ 2-D palette) | **Spread** (Δh/Δc/Δl), tints & shades, **hue-harmony** (Material secondary/tertiary; complementary/triadic/analogous), state variants (hover/active) |

**Expanders attach at two points.** Per-stop expansion (Spread, tints/shades) runs *after* interpolation. Hue-**harmony** is a *source* expander — rotate one seed into N seeds → N ramps. Both yield a 2-D palette; the model is "an expander that runs on sources or on output stops." The approved per-stop generator is the output-side case.

### Not expressible generically (out of scope / separate operators)

- **Qualitative / categorical palettes** (max-distinct hues, glasbey-style) — a pairwise-ΔE *optimization*, not interpolate/place/expand. Would need a dedicated "distinct-set" operator if ever wanted.
- **Image-derived palettes** (k-means extraction) — different input entirely.
- **Hand-tuned named scales** (bespoke Tailwind values) — data, not procedure; import-only.

---

## 4. Implementation stages

Each stage is shippable and keeps the app working.

### Stage 1 — Unify sources + collapse interpolators (1-D ramp preserved)

- Introduce `theme.points` (migration, Playbook C); remove A/B/controlPoints.
- Replace seg/arc/spline with one interpolator (`pathType`, `space`, N points, hue direction) + **presets** (Segment / Hue arc / Spline) that set those params. Add the **"World (as shown)"** space.
- Merge `Pick` + `Anchors/Points` into one **Sources** step; selection+pick replaces `arm`.
- `Spread` stays as a temporary mode/preset until stage 3.
- Output remains a 1-D ramp. Lowest risk; biggest redundancy win.

### Stage 2 — Place stage (declarative sampling)

- Convert `Adjust` from imperative buttons into a declarative **Place** policy: `uniform-t | even-ΔE | contrast-ladder | fixed-tones`, consumed inside `buildRamp` before gamut-map (matching the `interpolate → place → gamut-map → encode` order). WCAG-fit and even-spacing become two `Place` policies; add contrast-ladder (Leonardo) and fixed-tones (Material/Tailwind).
- Still 1-D. Removes the imperative/declarative inconsistency and covers Leonardo/Material sampling.

### Stage 3 — Expand stage → 2-D palettes (approved)

- Add an **Expand** stage: per-stop generators that turn each placed stop into a set, producing a **2-D palette (set of ramps)**. Migrate `Spread` here as the first operator; add tints/shades and (source-side) hue-harmony.
- **Output shape becomes 2-D.** This ripples into:
  - **Gamut-map** — already per-color, applies to every cell; no conceptual change.
  - **Export** — gains a palette/matrix shape (CSS custom-property grid, DTCG nested groups).
  - **Preview UI** — a grid instead of a single ramp strip.
- This is the heaviest change and lands last, but the 2-D palette via a per-placed-stop generator is **approved** as the target.

---

## 5. Risks & notes

- **Migration correctness** for docs holding both A/B and control points — resolve by old `mode`; cover with fixtures.
- **A/B legibility** — preserved via UI labels on the first two points.
- **"World" space is stateful** — handle as a special path in `buildRamp` (or extend the registry signature), not a plain `interp.ts` entry.
- **Preset ⇄ advanced coherence** — a preset just sets `pathType`/`space`/direction; switching a preset then tweaking the space must not feel like two competing controls. Presets write the same fields the advanced controls expose.
- **Stage independence** — Stages 1–2 keep the 1-D ramp and are low-risk; the 2-D commitment is isolated to Stage 3.
- **`pipeline-nodes.ts` / sidebar** — the Ramp lane steps update across stages: Stage 1 merges Pick+Points → `Sources` and renames Interpolate's internals; Stage 2 relabels Adjust → `Place`; Stage 3 adds `Expand`. Lane stays `Ramp`; `pipeline-nodes.ts` remains the source of truth for step metadata.
