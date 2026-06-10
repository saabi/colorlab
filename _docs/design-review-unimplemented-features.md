# Design Review: Unimplemented Feature Candidates

This review consolidates feature ideas from `_docs/Roadmap.md` and
`_docs/design.md`, then compares them against the current Svelte implementation
in `fe/`. It focuses on features that are listed but not yet implemented, plus
items that are only partially implemented and need a design decision before
coding.

## Current Baseline

The Svelte app has reached parity with the original Gamut Explorer prototype for
the core workflow:

- WebGL2 instanced color solid rendering.
- Color-space and gamut switching.
- arbitrary slicing and cross-section outline.
- analytic hover picking.
- transform-chain readout.
- transfer, LMS cone, xy chromaticity, and spectrum panels.
- CVD simulation across the 3D solid, swatches, inspector panel previews, and
  generated ramp previews.
- theme ramp anchors, segment/arc/spread modes, exports, and auto-adjust tools.

The remaining candidates below are new product surface, not migration parity
work.

## Feature Inventory

| Source | Feature | Current status | Review |
| --- | --- | --- | --- |
| Roadmap TODO | Widgets a la DAT.GUI | Partially implemented as bespoke Svelte controls | Worth refining into reusable inspector/control primitives, not importing DAT.GUI directly. |
| Roadmap TODO | TypeScript library for color processing and preparing uniforms | Mostly implemented under `fe/src/lib/color` and `fe/src/lib/renderer/uniforms.ts` | Worth hardening with tests and public module boundaries. |
| Roadmap Graphs | Spectral: space selection | Not implemented as independent graph mode | Low priority unless the app grows a multi-view workspace. |
| Roadmap Graphs | Spectral: color fitting tools | Not implemented | Worth considering after custom display calibration; otherwise underspecified. |
| Roadmap Graphs | Chromaticities: color picking | Partially implemented as xy panel marker from 3D hover | Worth implementing as direct xy panel picking/editing. |
| Roadmap Graphs | Chromaticities: color fitting | Not implemented | Worth pairing with xy picking and gamut fitting. |
| Roadmap Graphs | Color Space: multiple spaces | Implemented in 3D view | No new work except UI polish/presets. |
| Roadmap Graphs | Color Space: color fitting | Partially implemented through theme auto-adjust | Worth formalizing as reusable gamut projection/snap tools. |
| Roadmap Graphs | Color Space: grid only | Partially implemented through surface/floor toggles | Could become a view preset; low effort, low impact. |
| Roadmap Graphs | Color Space: color picking | Implemented through hover and anchor click | No major gap. |
| Roadmap | Color Acumulator | Not implemented | Needs definition. Possible useful form: sampled color history/palette tray. |
| Roadmap | Scheme Designer | Partially covered by theme ramp | Worth expanding into a first-class palette/scheme workflow. |
| Roadmap | Gradient Designer | Partially covered by theme ramp | High-value next feature; can build on existing ramp model. |
| Roadmap | Gamma Correction | Partially visible in transfer panel | Worth as an interactive transfer/gamma comparison tool. |
| Roadmap | Process Control | Not implemented | Needs definition; likely low priority until workflows are clearer. |
| Design §2/§9 | WebGPU backend | Not implemented | Good architectural project, but not the highest product value yet. |
| Design §2 | Text rendering in-scene | Not implemented | Low priority; 2D labels/tooltips are cheaper and sufficient for now. |
| Design §2 | HDR output | Not implemented | Needs browser/display capability strategy; defer. |
| Design §2 | Theme-token export | Implemented for CSS OKLCh and DTCG JSON | Already shipped; can improve UI/metadata. |
| Design §2/§10 | Authorable boundary / snap-to-gamut path | Not implemented; rendered outline exists | Worth implementing as “snap ramp stop to active gamut boundary.” |
| Design §10/§11 | Okhsl/Okhsv picker coordinates | Not implemented | High-value for theme editing; should be sliders/coordinate readouts, not geometry modes. |
| Design §10 | Custom display gamut/calibration | Not implemented | High-value and well-scoped; adds manual primary/white entry. |
| Design §10 | Optional EDID-derived defaults | Not implemented | Requires external data/service; defer behind manual custom display. |
| New review | Propagate CVD simulation through inspectors and ramps | Implemented across visual previews | Keep source values canonical; consider optional simulated-preview export metadata later. |
| New review | Merge spectrum strip into cone fundamentals panel | Implemented | Spectral colors now render as the LMS panel background with the wavelength marker in the merged panel. |
| New review | Hide spectrum wavelength marker for non-spectral colors | Partially implemented; dominant/complementary estimate currently displays broadly | Worth fixing before relying on wavelength readouts. Non-spectral/purple/mixed stimuli should not imply a pure wavelength. |
| New review | Chromaticity curve/intensity volume in 3D | Not implemented | Interesting advanced visualization: show spectral locus across intensities as a wide-gamut volume. Needs careful design to avoid clutter. |

## Recommended Next Features

### 1. Custom Display Gamut

Add a user-defined gamut entry with manual chromaticity input:

- red primary `x,y`
- green primary `x,y`
- blue primary `x,y`
- white point `x,y`
- transfer curve choice: sRGB, gamma 2.2, linear, or custom gamma

Why it is worth doing:

- It is explicitly listed in `design.md`.
- It fits the existing single-source matrix pipeline.
- It makes the explorer useful for real display comparison without browser EDID
  access.

Design notes:

- Add `custom` as a selectable gamut key.
- Store custom values in app state, not in the static `GAMUTS` constant.
- Validate chromaticity triangle sanity before applying.
- Label custom values as user-entered, not measured.
- Defer EDID import until manual entry works.
- Do not present manual chromaticities as complete display calibration. Users
  must first set monitor mode intentionally:
  - if the monitor is in an sRGB emulation/clamp mode, either leave the app on
    the built-in sRGB gamut with no additional display calibration, or instruct
    users to disable that mode before entering native-panel chromaticities.
  - if the monitor is in a wide/native gamut mode, custom chromaticities can
    describe the primaries, but brightness, contrast, white point, and channel
    transfer still need a separate calibration workflow.
- Design the calibration workflow before implementing the custom display UI. A
  robust workflow should guide users through:
  1. monitor preset selection: sRGB emulation vs native/wide gamut.
  2. ambient-light and warm-up instructions.
  3. brightness adjustment using black/near-black and white/near-white patches.
  4. contrast adjustment to avoid channel clipping.
  5. white-point adjustment, ideally D65 or user-selected target.
  6. independent red/green/blue gamma estimation with stepped patch ramps.
  7. validation screens for neutral gray tracking and clipped channels.
  8. explicit warning that software-only visual calibration is approximate and
     colorimeter values should take precedence.
- The onboarding for this is probably too complex for a compact side-panel
  form. Prefer an in-app calibration wizard with clear text and visual patches;
  a short video tutorial could help most users understand monitor OSD steps,
  but the app still needs an interactive text-based fallback.

Suggested calibration wizard shape:

- Start with a monitor-mode decision screen. Users either choose "monitor sRGB
  emulation" and keep the app on built-in sRGB, or choose "native/wide gamut"
  and continue to custom primaries.
- Show full-screen patch pages for monitor OSD adjustment, with one task per
  page: black level, white clipping, per-channel clipping, white point, then
  gamma.
- Estimate gamma independently for red, green, and blue using alternating
  stepped patches rather than a single combined gray ramp.
- End with validation patches that show neutral gray tracking, saturated
  primaries, near-black detail, near-white detail, and a reminder that measured
  colorimeter data should override visual estimates.

### 2. CVD-Aware Inspectors And Ramps

Extend color vision deficiency simulation beyond the 3D solid:

- transfer panel channel markers.
- LMS cone excitation bars.
- xy chromaticity marker and gamut overlays where appropriate.
- spectrum/pure-wavelength indicator behavior.
- ramp chips and 3D ramp markers.
- export metadata indicating whether values are source colors or simulated
  display colors.

Why it is worth doing:

- The current 3D solid and swatch can show a simulated deficient-viewer color,
  while panels and ramp chips still mostly describe the source stimulus.
- This can mislead users comparing surface color, ramp output, and inspector
  readouts.

Design notes:

- Keep source color data canonical. CVD should be a view/simulation layer, not a
  mutation of picked or exported source color values.
- Use paired display where ambiguity matters: source value plus simulated
  appearance.
- Exports should default to source tokens; optional simulated preview export can
  be a separate command if needed.
- Implementation note: current visual propagation covers transfer markers, LMS
  bars, xy marker, spectrum strip, ramp chips, and 3D ramp markers. Exported
  token values remain source colors.

### 3. Conservative Spectrum Wavelength Indicator

Only display a wavelength marker when the current stimulus is actually close to
the spectral locus.

Why it is worth doing:

- A general RGB/Lab/Oklab color is usually a mixed stimulus, not a pure spectral
  wavelength.
- Showing a dominant/complementary wavelength for broad non-spectral colors can
  overstate the physical interpretation.

Design notes:

- Define a numeric threshold in xy space for “close enough to spectral locus.”
- Suppress the label and marker outside that threshold.
- Purple-line/complementary reporting should be opt-in or clearly labelled, not
  the default for every off-locus color.

### 4. Spectrum As Cone-Panel Background

Merge the spectrum strip with the cone fundamentals panel:

- render the spectral color strip as the cone panel background.
- draw L/M/S curves over it with enough contrast.
- keep excitation bars on the right.
- remove or reduce the separate spectrum panel if the combined panel stays
  readable.

Why it is worth doing:

- It directly links wavelengths to cone response curves.
- It frees inspector space for future picker coordinates or gradient controls.

Implementation status:

- Implemented in the Svelte inspector. The standalone spectrum panel was
  removed; the LMS panel now renders the CVD-aware spectral background, cone
  fundamentals, excitation bars, and wavelength marker together.

Design notes:

- The background should remain subtle enough not to obscure curves.
- Keep the dominant/pure wavelength marker behavior conservative; do not show a
  marker for colors that are not spectral stimuli.

### 5. Gradient Designer

Promote the current ramp into a richer gradient tool:

- editable stop list.
- stop selection and deletion.
- per-stop OKLCh/Okhsl controls.
- preview as continuous CSS gradient.
- export CSS gradient plus token stops.
- choose interpolation mode: Oklab segment, OKLCh hue arc, current spread.

Why it is worth doing:

- It is listed in `_docs/Roadmap.md`.
- It builds directly on implemented ramp state.
- It is user-facing and immediately useful.

Design notes:

- Keep anchors as sRGB-linear truth.
- Store derived stop metadata separately from user-authored stop controls.
- Avoid turning the left panel into a full editor; consider tabs in the left
  panel or a bottom gradient band.

### 6. Okhsl/Okhsv Picker Coordinates

Add Okhsl/Okhsv as picker/editing coordinates in the theme layer:

- show hovered/selected color in Okhsl and Okhsv.
- provide H/S/L or H/S/V sliders for selected ramp stop.
- convert slider edits back to Oklab/sRGB-linear.

Why it is worth doing:

- `design.md` explicitly says these belong as picker coordinates.
- It gives users familiar HSL-like controls while retaining perceptual behavior.

Design notes:

- Do not add Okhsl/Okhsv as 3D geometry modes.
- Use a tested implementation; the cusp math is easy to get subtly wrong.
- Scope v1 to sRGB-relative coordinates, matching the model’s definition.

### 7. Direct Chromaticity Panel Picking

Make the xy panel interactive:

- click/drag inside xy triangle to choose chromaticity.
- combine xy with current luminance/lightness from the hovered or selected stop.
- optionally snap to active gamut triangle.

Why it is worth doing:

- Roadmap lists chromaticity picking and fitting.
- It extends an existing panel instead of adding a new surface.

Design notes:

- Picking xy alone is underdetermined; the UI must define which Y/L value is
  held constant.
- Use current selected ramp stop as the target when present.
- Show out-of-gamut feedback before fitting.

### 8. Gamut Boundary Snap / Fitting Tools

Turn the rendered cross-section outline into an editing affordance:

- snap selected ramp stop to the active slice boundary.
- expose “project to boundary” and “reduce chroma to boundary.”
- optionally draw nearest-boundary guide line from a selected stop.

Why it is worth doing:

- `design.md` calls the outline the future snap-to-gamut path.
- It complements existing fit-inside-sRGB behavior.

Design notes:

- Start with Oklab chroma reduction because it is already implemented.
- Direct nearest-boundary projection in arbitrary world spaces should be a later
  iteration.

### 9. Spectral/Chromaticity Intensity Volume

Add a 3D visualization of the spectral locus across intensity:

- use the chromaticity curve/spectral locus as a base path.
- sweep it through luminance/intensity to form a volume or translucent surface.
- render it as a wide-gamut reference object alongside the RGB solid.

Why it is worth doing:

- It would make the relationship between spectral colors, display gamuts, and
  color-space solids more concrete.
- It could serve as a didactic reference layer, similar to the current wide-gamut
  shell.

Design notes:

- Treat this as an optional reference layer, not a default overlay.
- It may be visually dense; start with a thin translucent wire/surface mode.
- It should reuse the same cone-fit spectral locus already used by the xy and
  spectrum panels.

## Lower-Priority Or Underspecified Items

### WebGPU Backend

Architecturally clean, but not urgent. Current WebGL2 code is working and the
pipeline/picking/panels are already API-free. Revisit when performance,
browser support, or shader maintainability demands it.

### HDR Output

Needs a browser/display policy, color-management assumptions, and test hardware.
Defer until the app has a stronger display-calibration story.

### Text Rendering In Scene

Could help labels, but 2D UI overlays are cheaper and less brittle. Defer unless
3D axes or slice annotations become confusing.

### EDID Defaults

Browsers do not expose EDID or active ICC profiles. This requires either manual
file/data import or a service-backed lookup. Manual custom display entry should
ship first.

### Color Accumulator

This is promising but undefined. Possible interpretation: a history tray of
hovered/picked colors that can be promoted into ramp stops or scheme roles.
Needs a short product design before implementation.

### Process Control

Too vague to implement safely. Needs concrete workflows, inputs, and outputs.

## Suggested Implementation Order

1. Custom display gamut.
2. CVD-aware inspectors and ramps.
3. Conservative spectrum wavelength indicator.
4. Spectrum as cone-panel background.
5. Gradient designer improvements.
6. Okhsl/Okhsv picker coordinates.
7. Direct xy chromaticity picking.
8. Gamut boundary snap tools.
9. Spectral/chromaticity intensity volume.

This order maximizes reuse of the current architecture while adding features
that are visible and useful to users.

## Technical Prerequisites

- Add focused tests for color math, custom gamut matrix generation, and ramp
  fitting before expanding editing workflows.
- Keep custom/user-entered gamut data separate from the static built-in gamut
  registry.
- Consider a small derived-state layer for selected ramp stop and active editing
  target before building a gradient designer.
- Leave GLSL modularization as a separate maintainability task; it is not a
  blocker for the listed product features.
