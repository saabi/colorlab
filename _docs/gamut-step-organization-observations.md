# Gamut Step — Organization Observations & Recommendations

Status: **observations only** — do not restructure yet. The Gamut step is actively
changing (the LMS/chromaticity track is adding observer/diagram controls here), and
its reorganization is the heart of Pipeline-node-UI Phase 2's Explorer split. This
note records the current state and a recommended target so the reorg can happen
deliberately once the colorimetry work lands.

Cross-refs: [`color-space-role-architecture.md`](color-space-role-architecture.md),
[`pipeline-node-ui-proposal.md`](pipeline-node-ui-proposal.md)
(§"Color Context", §"Explorer Reference / Display Mapping"),
[`lms-fundamentals-chromaticity-plan.md`](lms-fundamentals-chromaticity-plan.md) (WIP, other agent).

## Current contents of the Gamut step

As of now, the `gamut` ControlGroup in `LeftControls.svelte` holds **six**
heterogeneous controls:

| # | Control | What it actually drives |
|---|---------|-------------------------|
| 1 | **Gamut (cube primaries)** | The Active/working gamut — the solid's RGB primaries and ramp output intent. |
| 2 | **Observer model** (NEW) | The colorimetric foundation (CMFs): affects *all* color math and CVD, not just the gamut. |
| 3 | **Reference gamut shell** | An Explorer visual aid — a ghost gamut overlaid for comparison. |
| 4 | **Chromaticity overlay** | An Explorer visual aid — spectral locus rim/surface drawn in the 3D solid. |
| 5 | **Chromaticity diagram** (NEW) | The projection space of the **xy instrument panel** (RightInspector) — an instrument setting, not the 3D solid. |
| 6 | **Solid opacity** | Explorer display presentation of the active solid. |

## The problem

The step now mixes **four different roles** under one "Gamut" heading:

- **Global colorimetric intent** — Active gamut (1), Observer model (2). These are
  document/session-wide and affect everything downstream (solid, ramps, CVD,
  instruments). They are not "an Explorer setting."
- **Explorer visual aids** — Reference shell (3), Chromaticity overlay (4), Solid
  opacity (6). These change how the 3D solid is *presented*, not any color value.
- **Instrument setting** — Chromaticity diagram (5). It only re-projects the xy
  panel; it has nothing to do with the gamut or the 3D solid.
- (Future) **Display gamut** — not present yet; will be another global role.

This is the exact "everything in the sidebar looks like it affects the 3D solid"
trap the pipeline proposal calls out. Observer model especially is mis-placed: a
user changing "Gamut → Observer model" is actually changing the CMF basis for the
whole app.

## Recommended target organization

Aligns with the role model and the pipeline proposal's already-written guidance:

1. **Global Color Context surface** (not an Explorer pipeline node) — owns:
   - **Active gamut** (working/output intent; drives solid *and* ramp output).
   - **Observer model** (colorimetric foundation; affects all math + CVD + instruments).
   - **Display gamut** (future; device capability).
   - This is the natural home once chromatic adaptation / display-gamut work exists
     (proposal §"Color Context"). Observer model belongs here *now* in concept even
     if the surface ships later.

2. **Explorer "Reference / Display mapping" step** — keep the *visual aids*:
   - Reference gamut shell, Chromaticity overlay, Solid opacity.
   - These are genuinely Explorer-scoped (`affects: Viewport`), so they can stay in
     an Explorer pipeline step. Consider renaming the step from "Gamut" to something
     like **"Reference & display"** once the Active gamut moves to Color Context, so
     the heading matches its remaining contents.

3. **Instrument / diagnostics context** — move the **Chromaticity diagram** selector
   to live with the xy chromaticity instrument (RightInspector panel) or a future
   "Instruments/Diagrams" surface. It is an instrument projection choice; pairing it
   with the panel it controls is clearer than burying it in the Gamut step.
   (The observer model also feeds the instruments, but its scope is global, so it
   stays in Color Context — the instrument context can show it read-only.)

### Resulting split (concept)

```
Color Context (global):   Active gamut · Observer model · [Display gamut]
Explorer · Reference:     Reference shell · Chromaticity overlay · Solid opacity
Instruments (xy panel):   Chromaticity diagram (+ read-only observer summary)
```

## Sequencing / coordination

- **Do not move controls yet.** The LMS/chromaticity agent is mid-flight in this
  area (`observerModel`, `chromaticityDiagram`, `observerLoadedTrigger` were just
  added to `ExplorerState` and wired into `LeftControls`/`RightInspector`/`Viewport`).
  Reorganizing now risks colliding with that work.
- **Gate the reorg** on: (a) the colorimetry work stabilizing, and (b) the
  Color-Context surface being built (proposal Phase 2/3, and roadmap #2 white-point /
  #5 display-gamut). The Color Context move "has little explanatory payoff" until
  chromatic adaptation / display-gamut exist (proposal §"Color Context" timing).
- **Near-term, low-risk** interim improvement (optional, when touching the step):
  group the six controls under visible sub-labels within the existing step —
  *Working* (Active gamut, Observer), *Reference aids* (shell, overlay, opacity),
  *Instruments* (diagram) — to make the role boundaries legible before the controls
  physically move. This is purely additive and reversible.

## Note for the Pipeline-node-UI Phase 2

Phase 2's "split Explorer controls into `GamutEncodingPanel` / `WorldSpacePanel` /
Color Context" should adopt the split above rather than lifting the current Gamut
step wholesale. Specifically, the Phase-2 panel extraction for the Gamut/Color
area is **blocked** on this colorimetry work; extract World/Clip/Vision/Display
panels first (they're unaffected), and leave the Gamut/Color Context split for last.
