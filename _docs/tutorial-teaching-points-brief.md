# Brief: Design tutorial teaching points for Color Lab

**Status:** content-design brief (not implementation, not UI/UX).  
**Audience:** Claude (or another author) tasked with writing the *substance* of a step-by-step tutorial with popups.  
**Defer:** popup placement, spotlighting, progress UI, mobile layout, animation, persistence, analytics — a separate pass will adapt content to the product.

**Handoff:** Claude should read this file in full, then produce the deliverable in §9. The **global prelude (§2)** is fixed — do not reorder or skip it.

---

## 1. Your assignment

Produce **teaching-point outlines** for Color Lab: short, ordered lessons that explain *what the user should understand and try*, not how the interface should look.

Deliver **one global prelude** (§2) plus **four tutorial tracks** (see §4). For the prelude and each track, output:

1. **Learning goal** — one sentence: what “minimally productive” or “pipeline-complete literacy” means for that track.
2. **Prerequisites** — color-science assumptions (e.g. “knows RGB is not perceptually uniform”) and what can be taught inside the app.
3. **Steps** — numbered list. Each step must include:
   - **Title** (≤8 words)
   - **Concept** — the idea being taught (1–3 sentences)
   - **Try it** — a concrete action in the app (describe the *task*, not button labels; e.g. “orbit until you see the slice cross-section clearly” rather than “click the View tab”)
   - **Success check** — how the user knows they got it (observable outcome)
   - **Common mistake** — one misconception to pre-empt (optional but preferred)
   - **Pipeline anchor** (for pipeline-order tracks only) — which Explorer or Ramp stage this maps to (`pipelineGamut`, `pipelineSources`, etc.; see §5)
4. **Capstone** — a single exercise combining earlier steps.
5. **Glossary additions** — terms introduced in this track that later tracks may reuse.

Keep copy **popup-sized**: aim for ~40–120 words of teachable content per step (concept + try it + success check). Longer theory belongs in a separate “deep dive” appendix, not in the main step list.

**Do not** specify: modal chrome, arrows, dimmed overlays, stepper dots, or which panel must be open. **Do** specify: which *lane* (Explorer vs Ramp), which *stage*, and what should be visible in the viewport or export when the step succeeds.

---

## 2. Global prelude (fixed — steps 1 and 2 of every tutorial)

New sessions open on a **minimal showcase view**: sRGB solid in **Oklab** world space, **floor grid on**, **overlay aids hidden**, **auto-rotate on**. The first two tutorial popups exist to move the user from that demo mode into an interactive learning posture. **Every track** (A-quick, A-pipeline, B-quick, B-pipeline) must begin with these two steps before any track-specific content.

Author the prelude copy below; you may tighten wording but **not** change the order or intent.

### Prelude step 1 — Turn off auto-rotation

| Field | Content to author |
|-------|-------------------|
| **Title** | Turn off auto-rotation (or similar, ≤8 words) |
| **Concept** | The default view slowly orbits so the solid reads as a showcase; tutorials need a stable scene while you read and click. Auto-rotate is a sidebar-footer preference, not a pipeline stage. |
| **Try it** | Disable auto-rotation in the left sidebar footer. |
| **Success check** | The solid stops moving on its own; you can orbit with drag without fighting continuous motion. |
| **Common mistake** | Confusing auto-rotate with camera reset or world-space rotation of the model. |
| **Anchor** | Sidebar footer · `autoRotate` (runtime-only) |

### Prelude step 2 — Turn on visual aids

| Field | Content to author |
|-------|-------------------|
| **Title** | Show overlay aids (or similar, ≤8 words) |
| **Concept** | “Hide aids” suppresses surface grid lines, slice/cylinder outlines, reference shell, and ramp markers — not the floor grid. Turning aids back on reveals the scaffolding you will use in later steps. |
| **Try it** | Turn off “Hide aids” (i.e. show overlay aids) in the sidebar footer. |
| **Success check** | Surface grid and other overlays can appear when relevant pipeline stages are enabled; floor grid may already be visible and is controlled separately. |
| **Common mistake** | Expecting the floor grid to toggle with Hide aids — floor is an independent footer control. |
| **Anchor** | Sidebar footer · `hideAids` |

**After the prelude**, track-specific steps begin at **step 3**. Number track steps accordingly (or use “Prelude 1–2” then “A-quick 1…” — be consistent in the deliverable).

---

## 3. The two uses of the app

Color Lab is one application with **two largely independent mental models**, sharing a viewport and document model but serving different jobs.

### Use A — Color space explorer & comparer

**Purpose:** Treat color spaces as **3D solids** (an RGB cube transformed into CIELAB, Oklab, etc.). Compare **gamuts**, inspect **cross-sections**, and read the **stimulus → display** chain for any hovered color.

**Typical user questions this answers:**

- What does “inside sRGB” look like in Oklab vs CIELAB?
- How big is Display P3 relative to sRGB?
- What colors exist at a fixed lightness (L-slice)?
- What are the encoded, linear, XYZ, LMS, Lab, Oklab numbers for a stimulus?
- How might a protan/deutan/tritan eye perceive a display color (preview only)?

**Primary surfaces (for your anchoring, not UI design):**

- 3D viewport (solid, slice, cylindrical cut, shell overlay, orbit/pan)
- Right inspector: Transfer, LMS/cones, xy chromaticity, Values (hover chain)
- Explorer pipeline (Gamut → World → Tessellation → Clip → View → Vision)

**Explicitly out of scope for Use A tutorials:** generating export tokens, expand grids, heatmap palettes — mention only as “exists elsewhere in the app.”

### Use B — Multi-ramp generator (schemes, themes, heatmaps)

**Purpose:** Build **one or more ordered source color lists**, run them through a **Ramp pipeline**, and export **CSS / DTCG** tokens. Supports **1-D ramps** (gradients, sequential schemes) and **2-D palettes** (tints/shades, harmonies, heatmap-style grids via Expand).

**Typical user questions this answers:**

- How do I get from two brand colors to an 11-step ramp?
- Linear vs spline path — what changes perceptually?
- Where should stops land on the curve (even, uniform ΔE, lightness tones, contrast ladder)?
- How do I make a heatmap / multi-row palette from one ramp?
- What happens when interpolation goes out of gamut, and when does gamut mapping apply?

**Primary surfaces:**

- Ramp pipeline (Sources → Interpolate → Place → Expand → Gamut map → Export)
- Viewport overlays: source points, curve, stops, optional pinned palette
- Right inspector Palette tab (final exported colors)

**Relationship to Use A:** Ramp **source colors** are picked on the solid; **interpolation space** and **world** are related but distinct (world is viewport geometry; interpolate space is where the ramp path is computed). Teach that distinction early in ramp tracks.

---

## 4. Four tutorial tracks to author

| ID | Use | Approach | Target learner |
|----|-----|----------|----------------|
| **A-quick** | Explorer & comparer | Fastest path to minimal productivity | Someone who wants to compare gamuts and read hover values in &lt;10 minutes |
| **A-pipeline** | Explorer & comparer | Explorer pipeline step order | Someone who will use slice, shell, world space, and vision systematically |
| **B-quick** | Ramp generator | Fastest path to minimal productivity | Someone who needs a usable exported ramp from 2–3 colors quickly |
| **B-pipeline** | Ramp generator | Ramp pipeline step order | Someone building themes, multi-list ramps, or 2-D expand palettes |

### A-quick — suggested scope (you may refine)

After the **global prelude**, cover the minimum to **orient, compare, inspect**:

1. What the solid represents (encoded RGB cube → space → world)
2. Orbit / inspect hover (Values chain exists)
3. Change gamut and notice solid shape change
4. Optional shell overlay for A-vs-B gamut comparison
5. One slice demo (fixed L or similar) — cross-section as “all colors at this lightness”
6. When to open Transfer / xy / LMS panels (what each adds)

**End state:** User can compare two gamuts, slice the solid, and read numeric chains for hovered colors. No requirement to touch Ramp lane.

### A-pipeline — follow Explorer stage order

Stages (in UI order):

1. **Gamut** — primaries + transfer; reference shell overlay; solid opacity
2. **World space** — RGB, XYZ, CIELAB, Oklab layouts (geometry only; does not change stored colors)
3. **Tessellation** — N resolution, surface grid; link to slice sharpness
4. **Clip / cut** — plane slice, cylindrical cut, outlines; Alt-drag / touch tools (task-level only)
5. **View** — camera; floor grid; reset
6. **Vision** — CVD preview is display-only, not export

Teach **input → change → output → does not affect** per stage (mirror `fe/src/lib/inspector/help-copy.ts` pipeline entries). Footer policies other than the prelude (floor grid, auto-reduce tessellation, min FPS) are **preferences**, not stages — mention briefly when relevant, not as dedicated steps.

### B-quick — suggested scope

Minimum path **source colors → visible ramp → export**:

1. Pick / define 2+ source colors (on solid or list)
2. Interpolate on — linear vs spline at a high level; pick a sensible space (Oklab/Oklch called out)
3. Place on — even steps; what “stops” are
4. Read palette / viewport stops
5. Export copy (CSS or DTCG) — destination gamut awareness
6. Save document / example switcher (concept: parameters persist)

**End state:** User exports a 1-D ramp. Expand and gamut map can be “defaults OK” unless OOG appears.

### B-pipeline — follow Ramp stage order

Stages:

1. **Sources** — lists, active list, pick vs picker, multi-list = parallel ramps
2. **Interpolate** — on/off; linear/spline; interpolation space vs world; spline surface constraint; arc long; curve visibility
3. **Place** — on/off; policies: even, uniform, tones, contrast; step count; relationship to interpolate
4. **Expand** — off vs on; rows/cols; hue/chroma/light spread axes (ramp/sym/edges); 1-D → 2-D grid; heatmap / theme grid mental model
5. **Gamut map** — ramp-only OOG policy; distinct from Explorer gamut and from spline “surface” constraint
6. **Export** — token format; what is final (post-map stops)

Include at least one step on **multi-list** (parallel ramps) and one on **2-D expand** (even if brief). Reference built-in examples conceptually (`Large Color Ramp`, `Spline Color Ramp`, `Oklab L-slice`, `Display P3 + shell`) as suggested sandbox states — do not write example-specific prose unless it teaches a general lesson.

---

## 5. Canonical names (use consistently)

### Sidebar footer (prelude anchors)

| UI label | State field | Default (new session) |
|----------|-------------|------------------------|
| Floor grid | `floor` | on |
| Hide aids | `hideAids` | on (aids hidden) |
| Auto-rotate | `autoRotate` | on (runtime-only, not saved) |
| Auto-reduce | `autoPerformance` | on (runtime-only) |
| Min FPS | `minAverageFps` | 30 (runtime-only) |

### Explorer pipeline node IDs

`gamut` · `world` · `tessellation` · `clip` · `view` · `cvd` (Vision)

### Ramp pipeline node IDs

`sources` · `interpolate` · `adjust` (UI label: **Place**) · `expand` · `gamut-map` · `export`

### Inspector panels (Use A)

`transfer` · `cones` · `xy` · `values` · `palette` (palette is mainly Use B)

### Lanes

- **Explorer** — “what the 3D solid shows”
- **Ramp** — “how export tokens are generated”

---

## 6. Concepts to distribute across tracks

Use the table to avoid duplication: teach each concept in **one primary track**, cross-reference elsewhere in one sentence.

| Concept | Primary track | Notes |
|---------|---------------|-------|
| Encoded vs linear RGB | A-quick or A-pipeline Gamut | Transfer panel reinforces |
| Gamut = primaries + white point + TRC | A-pipeline Gamut | |
| Shell overlay = compare reference gamut | A-quick / A-pipeline Gamut | Example: P3 + shell |
| World space = display geometry only | A-pipeline World | **Not** source RGB or export |
| Slice = plane cut through solid | A-quick / A-pipeline Clip | Example: Oklab L-slice |
| Cylindrical cut = chroma/radius reveal | A-pipeline Clip | |
| Analytic pick / hover chain | A-quick | Values panel |
| CVD = preview only | A-pipeline Vision | |
| Source list(s) = ramp anchors | B-quick / B-pipeline Sources | |
| Interpolate off = anchors pass through | B-pipeline Interpolate | |
| Place off = exact picked colors as stops | B-pipeline Place | |
| Interpolation space vs world | B-pipeline Interpolate | Common confusion |
| Spline + surface constraint | B-pipeline Interpolate | vs gamut map |
| Expand = 2-D generator | B-pipeline Expand | Heatmaps, tints, harmonies |
| Gamut map = ramp terminal policy | B-pipeline Gamut map | Separate from Explorer gamut |
| Export tokens ≠ display preview | B-quick Export | |
| Two pipelines, one document | All capstones | |
| Default showcase vs tutorial mode | Global prelude | auto-rotate off, overlay aids on |
| Floor grid vs overlay aids | Prelude step 2 | Separate footer toggles |

---

## 7. Pedagogical constraints

1. **Perceptual honesty:** Oklab/Oklch spacing is practical, not a full non-Riemannian metric (see Transfer help deep dive). Do not oversell “perceptually uniform” without caveats.
2. **Separation of concerns:** Explorer gamut ≠ ramp gamut map ≠ CVD preview ≠ spline surface snap. Tutorial steps should never blur these.
3. **Order independence awareness:** Users may open any pipeline step; pipeline-order tracks still teach **logical** data flow (sources before export), not required UI order.
4. **Minimal productivity ≠ minimal features:** Quick tracks may skip Expand, gamut map tuning, tessellation, and custom slice — but must say what was skipped and where to learn it (pointer to pipeline track).
5. **Examples as sandboxes:** Prefer “start from example X” over blank Untitled when it reduces setup friction; map examples to teaching goals in an appendix table you produce.

---

## 8. Source material in this repo (read, don’t invent)

| Resource | Use for |
|----------|---------|
| `_docs/design.md` | Architecture, slice math, single source of truth, picking |
| `fe/src/lib/components/pipeline-nodes.ts` | Stage labels, descriptions, `affects` vocabulary |
| `fe/src/lib/inspector/help-copy.ts` | Input/change/output/exclude per stage |
| `fe/src/lib/components/LeftControls.svelte` | Control inventory per stage |
| `fe/src/lib/engine/state.svelte.ts` → `EXAMPLE_STATES` | Built-in demo documents |
| `_docs/pipeline-popup-content-plan.md` | Stage teaching template (content shape) |
| `_docs/ramp-pipeline-v2-plan.md` | Ramp data flow (if needed) |

If repo copy and this brief conflict, **trust the code and help-copy** for factual claims.

---

## 9. Required output format (your deliverable)

Submit a single markdown document with this structure:

```markdown
# Color Lab tutorial teaching points

## Summary table
| Track | Steps (incl. prelude) | Minutes (estimate) | End capability |

## Global prelude
### Step 1: Turn off auto-rotation
- Concept:
- Try it:
- Success check:
- Common mistake:

### Step 2: Turn on visual aids
- Concept:
- Try it:
- Success check:
- Common mistake:

## A-quick
### Learning goal
### Prerequisites
### Steps
#### Step 1: ...
- Concept:
- Try it:
- Success check:
- Common mistake:

... (repeat)

### Capstone
### Glossary

## A-pipeline
(same sections; each step includes Pipeline anchor: `gamut` | ...)

## B-quick
...

## B-pipeline
...

## Appendix A: Example document map
| Example id | Best for tracks | Key teaching moment |

## Appendix B: Skipped-in-quick index
| Topic | Taught in track | One-line pointer |

## Appendix C: Cross-track concept index
| Term | First introduced | Step ref |
```

**Estimates:** Rough minutes per track are fine; flag steps that need a worked example state.

**Voice:** Direct, second person (“you”), neutral technical tone. No marketing language. Prefer “stimulus,” “solid,” “stop,” “source,” “list” as the app uses them.

---

## 10. Explicit non-goals for this task

- Do not design popup components, coach marks, or tutorial state machine.
- Do not write final UI strings tied to specific button positions.
- Do not specify mobile vs desktop presentation (mobile hides inline guide UI; tutorial access via document **More → Guide note** is an implementation detail for later).
- Do not implement `guideNote` JSON or example snapshots — only recommend which example fits which step.

---

## 11. Quality checklist (self-review before handing off)

- [ ] Global prelude present with auto-rotate off then overlay aids on
- [ ] All four tracks present with capstones and prelude prepended
- [ ] Every pipeline-order step maps to exactly one canonical node ID
- [ ] World space never described as changing export tokens
- [ ] CVD never described as changing export tokens
- [ ] Gamut map taught as ramp-only
- [ ] Quick tracks state what they omit and where to learn it
- [ ] At least one comparer exercise (gamut or shell) and one ramp exercise (export) in quick tracks
- [ ] Multi-list and Expand appear in B-pipeline
- [ ] No UI/UX mockups or wireframes

---

*When this brief is satisfied, a follow-up task will map teaching points to popup/tutorial UI and persistence.*
