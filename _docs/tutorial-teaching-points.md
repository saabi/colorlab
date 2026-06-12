# Color Lab tutorial teaching points

## What sets Color Lab apart

Most color tools — gradient editors, palette pickers, theme generators — operate in display-space sRGB or HSL. Color Lab does two things they do not:

1. **Explore color spaces as 3D geometry.** Every gamut becomes a navigable solid in Oklab, CIELAB, or other perceptual spaces. You can see — not just calculate — why sRGB is smaller than Display P3, what colors exist at a fixed lightness level, and how a CVD viewer perceives the same display output. This spatial intuition is the Explorer lane (tracks A-quick, A-pipeline).

2. **Generate smooth, harmonic palettes in perceptual space.** Ramps are interpolated and stop-placed in Oklab, Oklch, or CIELAB, so adjacent stops are separated by how far apart they actually *feel* — not by raw RGB or HSL distance. The result: gradients that stay chromatic through the middle, rainbows that don't wash out, and multi-stop themes where each step feels equally far from the last. This is the Ramp lane (tracks B-quick, B-pipeline), and it is what distinguishes Color Lab from every standard palette or theme designer.

Both uses share the same 3D viewport: ramp source colors are picked directly on the solid, and the interpolated curve is visible inside it. Exploring and designing are the same gesture.

---

## Summary table

| Track | Steps (incl. prelude) | Minutes (estimate) | End capability |
|-------|----------------------|--------------------|----------------|
| A-quick | 8 | ~15 | Compare two gamuts, slice the solid, read the full hover chain |
| A-pipeline | 8 | ~25 | Full Explorer pipeline literacy from Gamut through Vision |
| B-quick | 8 | ~15 | Export a 1-D ramp from 2–3 source colors |
| B-pipeline | 9 | ~30 | Multi-list ramps, 2-D Expand grids, all ramp pipeline stages |

---

## Global prelude

Steps 1–2 open every track before any track-specific content. New sessions open on a slow-orbit showcase: sRGB solid in Oklab world space, floor on, overlay aids hidden, auto-rotate on. These two steps move the user into an interactive learning posture.

### Step 1: Turn off auto-rotation

- **Concept:** Color Lab opens in a slow-orbit showcase mode so the solid reads clearly on first load. Tutorials need a stable scene while you read and click. Auto-rotate is a sidebar footer preference — it is runtime-only and never saved to documents.
- **Try it:** Find "Auto-rotate" in the left sidebar footer and turn it off.
- **Success check:** The solid stops orbiting. Dragging the viewport now orbits only when you push; it does not fight back.
- **Common mistake:** Confusing auto-rotate with camera reset or world-space rotation of the solid. Camera Reset (View step) returns the viewpoint to a default angle; world-space layout is set by World space — neither is auto-rotate.

### Step 2: Show overlay aids

- **Concept:** "Hide aids" suppresses the surface grid, slice/cylinder outlines, reference shell, and ramp markers — all at once, without losing the individual settings. Turning aids back on reveals the scaffolding you will need in later steps. The floor grid is a separate toggle and does not respond to Hide aids.
- **Try it:** Disable "Hide aids" in the left sidebar footer (the solid's surface grid and other overlays will become active when their pipeline stages are on).
- **Success check:** When relevant stages are active, overlays such as the surface grid and outlines are now visible. The floor grid is already under its own footer toggle.
- **Common mistake:** Expecting the floor grid to respond to Hide aids — it does not. Toggle it independently if you need to change it.

---

## A-quick

### Learning goal
Understand what the 3D solid represents, navigate and inspect it, compare two gamuts, slice at a fixed lightness, and read the numeric chain for any hovered color — in under 15 minutes. This is the spatial gamut intuition that no 2D chromaticity diagram or color picker can give you.

### Prerequisites
- Knows that RGB colors are coordinates in a cube; no prior Color Lab experience required.
- No ramp or export knowledge required.

### Steps

#### Step 3: The solid is a gamut

- **Concept:** The 3D solid is the full set of colors the active gamut can encode — every legal RGB triple, placed in the chosen world space. Most color tools show a gamut as a 2D triangle on the CIE chromaticity diagram, which collapses lightness entirely. Color Lab renders the full 3D volume so you can see how the space distributes across chroma *and* lightness simultaneously. In Oklab layout, lighter colors appear higher and more chromatic colors sit farther from the center — the shape reflects perceptual geometry, not an arbitrary artistic choice.
- **Try it:** Orbit the solid by clicking and dragging. Locate the white corner (top) and the black corner (bottom). Identify a region that looks maximally saturated.
- **Success check:** You can orient yourself in the solid — brighter up, more chromatic outward — and understand that the shape communicates something real about the color space.
- **Common mistake:** Thinking the solid's shape is decorative. In Oklab layout the vertical axis is perceptual lightness (L), so "higher" really does approximate "looks brighter."

#### Step 4: Orbit and inspect a hover

- **Concept:** Moving the mouse over the solid runs an analytic ray test — not a GPU pixel sample — and feeds the exact result to the right inspector. The Values panel shows the full transform chain: encoded RGB → linear RGB → XYZ → LMS → CIELAB → Oklab → Oklch. Every number is computed from the same math the renderer uses, so panels cannot disagree with each other.
- **Try it:** Hover slowly across the solid surface and watch the right panel update. Find a color near the pure-red corner and read its Oklab L and C values.
- **Success check:** The inspector updates live as the cursor moves. You can read lightness and chroma for any point without clicking.
- **Common mistake:** Expecting to have to click to "select" a color for reading. The chain updates on hover; click is only needed to pick a source anchor into the ramp workflow.

#### Step 5: Change gamut, compare shape

- **Concept:** Switching the gamut (Gamut step) swaps which RGB primary set the solid represents. Display P3 has wider primaries than sRGB — especially in green and red-orange — so its solid extends farther. The same stored code value encodes a different stimulus in each gamut.
- **Try it:** Switch gamut from sRGB to Display P3. Notice the solid grow, especially in the green corner. Switch back to sRGB to confirm the difference. Hover the same point in both and compare XYZ values in the inspector.
- **Success check:** You can see P3's solid extends beyond where sRGB ended. The XYZ values at the "same" encoded position differ between the two gamuts.
- **Common mistake:** Thinking changing the gamut alters source anchor colors or export output. The Gamut stage defines what the 3D solid represents in the viewport; it does not touch ramp anchors or exported tokens.

#### Step 6: Shell overlay — two gamuts at once

- **Concept:** The shell overlay draws the wire boundary of a reference gamut on top of the active solid. With the solid set to Display P3 and the shell set to sRGB, you see exactly which P3 colors fall outside sRGB — those points poke beyond the wire cage. This is the standard gamut-comparison view.
- **Try it:** Set the active gamut to Display P3 and enable the shell overlay for sRGB in the Gamut step. Orbit until you can see the wire cage sitting inside the solid. The region between the cage and the solid surface is "P3 only."
- **Success check:** A wire outline smaller than the solid is visible. You can identify P3 colors that sRGB cannot reproduce (outside the cage) versus those that both can (inside).
- **Common mistake:** Confusing the shell with slice outlines. The shell is a fixed reference boundary for the comparison gamut; slice outlines move with the clip plane.
- **Suggested example:** Load "Display P3 + shell" (`example:p3-shell`) to start in this configuration.

#### Step 7: Slice at fixed lightness

- **Concept:** Enabling the slice plane cuts the solid with a flat cross-section. With plane mode set to L (lightness), you see all colors at one Oklab lightness level — a 2D chromaticity diagram filtered to one brightness. Moving the offset slides the plane through the solid.
- **Try it:** Enable slice in the Clip / cut step, set plane mode to L, and drag the offset to about 0.55. Orbit to see the cross-section face-on. The perimeter is the gamut boundary at that lightness; everything inside is achievable.
- **Success check:** A flat cross-section appears. Moving the offset makes it travel through the solid from dark (near 0) to light (near 1).
- **Common mistake:** Thinking the slice boundary shows sRGB vs wide-gamut limits. The perimeter is the gamut boundary at that L value — not a comparison to a different gamut. Use the shell for comparisons.
- **Suggested example:** Load "Oklab L-slice" (`example:oklab-l-slice`) for this pre-configured.

#### Step 8: Inspector panels — what each adds

- **Concept:** The right inspector has five tabs. **Values** (used above) is the full numeric chain. **Transfer** plots the selected gamut's encoding curve — why sRGB stored values differ from linear light. **Cones** shows LMS cone excitations for the hovered stimulus. **xy** plots the CIE 1931 chromaticity diagram with the gamut triangle. All update from the same hover hit.
- **Try it:** Hover a vivid green color and click through Transfer, Cones, and xy. Notice that all three panels show the same stimulus from different angles; none of them require a separate click.
- **Success check:** All inspector panels update when the cursor moves over the solid. You can correlate the L/M/S bar heights with the xy position of the same color.
- **Common mistake:** Treating the Transfer panel as the export encoding curve. Transfer shows the gamut's decoding assumption (encoded → linear); it has no direct relation to what ramp tokens are exported.

### Capstone
Load "Display P3 + shell" and enable the L slice at offset 0.55. Orbit until you can see the 2D cross-section with the sRGB wire cage visible. Find one color inside the sRGB shell and one outside it at this lightness level. Read the Values panel for both: note how the outside-sRGB color has a higher Oklch C than anything within the shell at the same L. Switch to the Cones panel and compare the LMS ratios — the high-chroma color will have a more extreme L-to-M ratio.

### Glossary
- **Solid** — the 3D cloud of all colors a gamut can encode, mapped to a world-space coordinate system.
- **Gamut** — a defined set of RGB primaries + white point + transfer curve.
- **Shell** — a wire overlay of a reference gamut boundary drawn over the active solid.
- **Slice** — a plane cut through the solid exposing a 2D cross-section at fixed L, H, or C.
- **Stimulus** — a specific encoded RGB value being inspected via hover or pick.
- **Chain** — the full sequence of color-space conversions: encoded RGB → linear RGB → XYZ → LMS → Lab → Oklab → Oklch.
- **World space** — the coordinate system mapping colorimetric values to 3D positions in the viewport.

---

## A-pipeline

### Learning goal
Understand the full Explorer pipeline in stage order — Gamut through Vision — so every control's scope is clear and settings can be changed deliberately rather than by trial-and-error.

### Prerequisites
- Comfortable orbiting the solid and reading the Values chain (A-quick step 4).
- No ramp workflow experience required.

### Steps

#### Step 3: Gamut — primaries and transfer

- **Concept:** The Gamut stage decides which physical device the RGB cube represents: its primary chromaticities (which reds, greens, and blues are "R=1, G=1, B=1") and its transfer curve (the encoding relationship between stored code values and linear light). Changing the gamut changes the cube's colorimetric identity — the same (R, G, B) triple encodes a different stimulus depending on which gamut is active.
- **Try it:** Switch gamuts while hovering the same screen position. Watch the XYZ values in the inspector change even though you did not move the cursor. Also enable the shell overlay for a different gamut to visualize the primary-set difference geometrically.
- **Success check:** You can explain why a point at (R=1, G=0, B=0) encodes a different spectral stimulus in sRGB versus Rec. 2020 — and see that difference as a geometric shift in the solid.
- **Common mistake:** Assuming the Gamut setting filters the ramp export to that gamut. The Gamut stage defines what the solid represents in the viewport; the ramp's Gamut map stage is a separate terminal policy for export stops.
- **Pipeline anchor:** `gamut`

#### Step 4: World space — geometry only

- **Concept:** World space chooses the 3D coordinate system that organizes colors in the viewport: RGB (the raw cube), XYZ (CIE), CIELAB (with L* axis), Oklab (perceptual with Oklab L), or Luma (luminance-sorted). World space is a display decision only — it does not change stored colors, source anchor values, or exported ramp tokens.
- **Try it:** Switch from Oklab to RGB world space — the solid snaps back to a regular cube. Switch to CIELAB — the shape deforms differently from Oklab. Return to Oklab. Verify that the hover chain values in the inspector are identical regardless of world space (only the geometric position changes).
- **Success check:** Changing world space visibly reshapes the solid but the Values panel rows (XYZ, Oklab, etc.) remain the same for the same hovered stimulus. World space is a camera-lens analogy: same colors, different arrangement.
- **Common mistake:** Assuming world space changes what ramp interpolation computes. The Interpolate step's "splineSpace" setting is separate and unrelated to the viewport world space. You can interpolate in Oklch while displaying in Oklab layout.
- **Pipeline anchor:** `world`

#### Step 5: Tessellation — mesh resolution

- **Concept:** Tessellation sets the subdivision count (N) per cube face. More subdivisions produce smoother slice edges and surface grid cells but cost more GPU time. The Auto-reduce policy in the sidebar footer can lower N automatically when frame timing exceeds the minimum FPS target — it is a performance preference, not a pipeline stage.
- **Try it:** Set N to 64 and enable the slice at L≈0.55. Notice the faceted, stepped slice outline. Raise N to 256 and observe the edge smooth out. The surface grid (when aids are on) directly shows the subdivision cells.
- **Success check:** At N=64 the slice outline has visible steps; at N=256 it appears smooth. You can choose a value that balances visual quality with your device's performance.
- **Common mistake:** Thinking higher tessellation improves the accuracy of color math. The transform runs per-vertex; the colorimetric precision of the hover chain is identical at N=64 and N=256 — only the geometric precision of edges changes.
- **Pipeline anchor:** `tessellation`

#### Step 6: Clip / cut — slice and cylinder

- **Concept:** The Clip stage exposes the inside of the solid by cutting it with a plane and/or a cylinder. A slice plane at fixed L, H, or C creates a 2D cross-section (see A-quick step 7); a cylindrical cut reveals a chroma column by removing everything outside a radius. Both affect what is visible and hoverable in the viewport — they do not alter stored colors or ramp stops.
- **Try it:** Enable the slice at planeMode L, offset 0.5. Then also enable the cylinder cut and shrink the radius to reveal only the high-chroma perimeter. Combine both: the cross-section now shows only the high-chroma ring at one lightness.
- **Success check:** You can navigate to a specific lightness and chroma range simultaneously. The viewport shows the intersection of both cuts.
- **Common mistake:** Expecting the cylinder cut to clip export stops. It is a viewport-only cut. Ramp stops outside the cylinder remain in the export unless the Gamut map stage removes them.
- **Pipeline anchor:** `clip`

#### Step 7: View — camera and floor

- **Concept:** The View stage controls navigation and orientation aids: camera distance, field of view, floor grid, and camera reset. Camera reset returns to a sensible default angle without touching any color or pipeline setting. The floor grid is an orientation reference and is independent of the overlay aids toggle from the prelude.
- **Try it:** Orbit, zoom, and pan. Use camera reset in the View step to return to the default angle. Toggle the floor grid on and off to confirm it is independent.
- **Success check:** You can return to a known viewpoint at any time without affecting gamut, world space, slice, or any other pipeline setting.
- **Common mistake:** Using camera reset to undo pipeline changes. Reset moves the camera only — gamut, world space, and slice settings remain exactly as you left them.
- **Pipeline anchor:** `view`

#### Step 8: Vision — CVD is display only

- **Concept:** The Vision stage applies a color-vision-deficiency simulation to everything rendered on screen: protanopia (L-cone), deuteranopia (M-cone), or tritanopia (S-cone) at adjustable severity. It runs at the LMS stage, after linear conversion. CVD is a display preview only — it does not alter source anchor colors, ramp stop values, or exported tokens.
- **Try it:** Enable protan CVD at full severity. The viewport shifts dramatically toward yellows and blues. Open the Export step (or check the Palette tab) and confirm the token values are unchanged. Turn CVD off — the viewport returns to the non-simulated view.
- **Success check:** CVD visibly shifts the viewport appearance; the Values panel shows the "cvdLin" row with simulated values. Export text is identical with and without CVD active.
- **Common mistake:** Assuming CVD-previewed stop colors are what gets exported. Only the ramp's Gamut map stage affects export; CVD is strictly visual simulation targeted at the display signal.
- **Pipeline anchor:** `cvd`

### Capstone
Start from a blank document. Set gamut to Rec. 2020, world space to CIELAB. Enable the sRGB shell overlay. Add an L slice at offset 0.6, tessellation N=192. Enable protan CVD at severity 0.8. Orbit to a clean view of the cross-section with the shell visible. Identify one color the Rec. 2020 cross-section contains that the sRGB shell does not. Read the full chain (Values tab). Turn CVD off and back on — compare "srgbLin" vs "cvdLin" for that point to confirm CVD modifies the display value but not the colorimetric value.

### Glossary
- **Primary** — one of the three corner colors (red, green, blue) defining a gamut's colorimetric extent.
- **Transfer curve / TRC** — the nonlinear function mapping stored code values to linear light (e.g. sRGB piecewise gamma).
- **Linear RGB** — RGB values after removing the transfer curve; proportional to physical light energy.
- **N (tessellation)** — subdivision count per cube face; controls mesh density and slice-edge smoothness.
- **CVD** — color vision deficiency; the Vision stage simulates how such a viewer perceives the on-screen image.
- **Clip** — the Clip / cut stage: restricts which part of the solid is rendered using a plane and/or cylinder.

---

## B-quick

### Learning goal
Go from zero source colors to a copied ramp export (CSS or DTCG) in under 15 minutes. Unlike standard palette generators that space stops by raw HSL or sRGB distance, Color Lab places stops by perceived distance in a perceptual color space — so the output is smooth and harmonic by construction. Expand, per-list parallel ramps, gamut-map tuning, and contrast-ladder placement are out of scope here — Appendix B points to where each is taught.

### Prerequisites
- Knows what a color palette is (a set of related colors with a lightness or chroma progression).
- No prior Color Lab experience required; A-quick recommended but not required.

### Steps

#### Step 3: Add two or three source colors

- **Concept:** Every ramp starts with ordered source colors — "anchors" — stored in the active source list. You can pick them on the 3D solid (arm the "+ Pick on solid" button, then click the surface) or enter a color via the inline color picker. The list order matters: interpolation runs from the first anchor to the last.
- **Try it:** In the Sources step, arm "+ Pick on solid," then click once on a dark region of the solid and once on a bright region. Two rows appear in the list. Their dots appear in the 3D viewport.
- **Success check:** Two anchor rows are visible in the Sources list and two markers are visible in the viewport. The markers sit where you clicked.
- **Common mistake:** Picking both anchors without noticing the order. The ramp interpolates row 1 → row 2. Use the Up/Down buttons to reorder if needed (dark first usually means lighter stops higher up the palette).
- **Suggested example:** Load "Large Color Ramp" (`example:large-color-ramp`) to start with a working 2-anchor ramp you can explore without setup.

#### Step 4: Interpolate on — linear vs spline

- **Concept:** With Interpolate on, Color Lab draws a continuous path between your anchors. Linear mode connects them with straight chords; Spline mode fits a smooth arc through all points. The interpolation space (Oklab, Oklch, sRGB, etc.) controls where that path bends through the solid — Oklch tends to keep chroma high along the arc rather than cutting through the gray interior. By default the solid is opaque, which can hide the curve running through its interior — lower the solid opacity first.
- **Try it:** In the Gamut step, lower "Solid opacity" to around 50–75% so the curve is visible through the solid. Then ensure Interpolate is on. Switch between "linear" and "spline" mode and watch the curve in the viewport change shape. Switch the interpolation space from Oklab to Oklch and back to see how the arc bends differently.
- **Success check:** The curve is clearly visible inside the semi-transparent solid. With more than two anchors, spline produces a smooth arc; linear produces connected straight segments between each anchor pair.
- **Common mistake:** Confusing interpolation space with world space. Interpolation space is where the ramp path is computed; world space is the viewport's coordinate layout. These are independent — you can interpolate in Oklch while displaying in Oklab layout. That distinction matters practically: Oklch interpolation preserves chroma along the arc (useful for rainbow or hue-sweep ramps), while Oklab interpolation takes a more direct Cartesian path that may pass through a desaturated middle (useful for clean two-tone gradients that should not "rainbow" between endpoints).

#### Step 5: Place on — where the stops land

- **Concept:** Interpolation produces a continuous path; Place decides where the N discrete stops fall on it. "Even" policy distributes stops by arc-length in the chosen interpolation space — approximately even perceptual steps when interpolating in a perceptual space like Oklab or CIELAB, and approximately even geometric steps otherwise. This is the core capability that sets Color Lab apart from HSL-based palette tools: stops are spread by how far apart they feel, not by raw parameter position, producing ramps that are smooth and harmonic whether they are a clean two-tone gradient or a multi-stop rainbow. Other policies exist (uniform parameter, lightness tones, contrast ladder) but "even" is the safe default for a first ramp.
- **Try it:** Enable Place. Set steps to 9. Nine colored dots appear along the curve in the viewport. Slide the step count between 5 and 21 to see the count change. The right-side Palette tab shows the final swatches.
- **Success check:** Exactly N stops appear in the viewport and in the Palette tab. Changing the step count immediately updates the count.
- **Common mistake:** Leaving Place off. When Place is disabled, stops are the exact source anchor positions only — not a sampled ramp. You need Place on to distribute colors evenly along the interpolated path.

#### Step 6: Read the palette

- **Concept:** The right inspector's Palette tab shows the final generated colors exactly as they will be exported — post gamut-map, with WCAG contrast ratios vs. the chosen background. This is the authoritative ramp preview; the 3D viewport markers are orientation aids, not pixel-accurate swatches.
- **Try it:** Open the Palette tab. Hover each swatch to read its hex and Oklch values. Look for any OOG (out-of-gamut) indicators — orange chips on stops that exceed sRGB before gamut mapping.
- **Success check:** You can read the hex value of each stop in the Palette tab and confirm the lightness progression matches your intent. Any OOG stops are flagged.
- **Common mistake:** Treating the 3D viewport stop markers as final colors. They are accurate colorimetrically but rendered through your monitor profile; the Palette tab reads the computed values directly.

#### Step 7: Export the ramp

- **Concept:** Export serializes the final stops to CSS oklch() custom properties or DTCG JSON. The token values are the post-gamut-map stops. By default the gamut map clips to sRGB — to export wide-gamut values, change the gamut map policy to "none" or "oklch-c." CSS is for web stylesheets; DTCG is for design-tool token pipelines.
- **Try it:** Open the Export step and copy the CSS output. Paste it into a text editor. Count the variables — there should be one per stop. Check that the oklch() L values increase or decrease monotonically as expected.
- **Success check:** You have CSS (or DTCG JSON) text on your clipboard that you could paste into a real stylesheet. The lightness values reflect the dark-to-light order of your anchors.
- **Common mistake:** Expecting wide-gamut values in the export without changing the gamut map policy. The default clips to sRGB. Stops that were OOG will appear clipped unless policy is changed.

#### Step 8: Save the document

- **Concept:** Color Lab stores ramp parameters as named documents. Saving writes all pipeline settings (source anchors, interpolate mode, step count, etc.) and camera position to local storage. The session state (last-open parameters) is written automatically on change; named documents require an explicit Save action.
- **Try it:** Click Save or Save as in the document bar. Give the document a name. Reload the browser tab — the same ramp should restore automatically.
- **Success check:** After reloading, source anchors, interpolation settings, and step count are all present without re-entering anything. The named document appears in the document list.
- **Common mistake:** Confusing the session (auto-restored last-open state) with a named document. The session always restores the last state, but to create a named checkpoint you must Save explicitly.

### Capstone
Starting from a blank document: pick three source colors from the sRGB solid — one dark, one mid-chroma, one bright. Enable Interpolate in Oklch, spline mode. Enable Place with even policy, 11 steps. Verify the ramp in the Palette tab — check for OOG stops. Export to CSS and paste it into a text editor to count the variables. Save the document. Then load "Large Color Ramp" and compare — note whether it uses linear or spline, and whether its stop count matches yours.

### Glossary
- **Anchor** — a source color stored in the active list; the raw input to interpolation.
- **Source list** — the ordered collection of anchors for one ramp.
- **Ramp** — the output of Sources → Interpolate → Place → Gamut map: an ordered set of N stops.
- **Stop** — one sampled color in the final ramp.
- **Place** — the pipeline stage that distributes N stops along the interpolated curve.
- **Export** — the final step that serializes stops as CSS or DTCG tokens.
- **OOG** — out-of-gamut: a stop whose linear RGB channels exceed [0, 1] before or after gamut mapping.

---

## B-pipeline

### Learning goal
Understand every Ramp pipeline stage in order — Sources through Export — including multi-list parallel ramps and the 2-D Expand generator, so that any ramp artifact can be diagnosed and adjusted deliberately. This is the full depth behind the "perceptually harmonic palettes" promise: each stage is a precise, composable control over how source colors become smooth, equidistant export tokens.

### Prerequisites
- Completed B-quick (comfortable with anchors, interpolate, place, and a first export).
- Knows Oklab is a perceptual space with L (lightness) and chroma axes; no deeper color science required.

### Steps

#### Step 3: Sources — lists, anchors, picking

- **Concept:** Sources is the top of the ramp pipeline. One **source list** is one ordered set of anchor colors that feeds one independent ramp path through all downstream stages. You can have multiple lists — each produces its own parallel ramp. Only the **active list** (highlighted chip) is editable; switch by clicking a chip. Anchors can be picked from the solid ("+ Pick on solid," or press A and click in the viewport), dragged to new positions, or entered via the color picker.
- **Try it:** Add a second list using the + chip in the Sources step. Add two anchors with colors clearly different from list 1. Switch back to list 1 — the 3D viewport now shows two distinct curves, one per list.
- **Success check:** The Sources status chip reads "2 lists · N pts." Two separate curves appear in the viewport; each belongs to one list.
- **Common mistake:** Expecting the two lists to blend into one ramp. Lists are parallel, not merged. Each list produces its own independent set of stops; they appear side by side in the palette, not averaged together.
- **Pipeline anchor:** `sources`

#### Step 4: Interpolate — path and space

- **Concept:** Interpolate builds the continuous curve between anchors. **Off** means anchors pass through unchanged — useful for exact palettes where you want no curve fitting. **Linear** connects anchors with straight chords in the interpolation space. **Spline** fits a smooth parametric curve (Catmull-Rom style). The **interpolation space** (Oklab, Oklch, sRGB, CIELAB, "world") is where that path bends — different spaces produce dramatically different arcs through the same anchor set. "World" uses the viewport's geometric coordinate system directly.
- **Try it:** Load "Spline Color Ramp" (`example:spline-color-ramp`). Switch between linear and spline while watching the curve in the viewport. Then change the space from Oklch to sRGB — observe how the arc through the solid changes shape, especially in the hue direction.
- **Success check:** You can describe why the same anchor set produces different ramp paths in Oklch vs sRGB interpolation — the arc shape reflects the coordinate geometry of each space.
- **Common mistake:** Assuming "world" interpolation space always produces a straight line. In "world" mode the path is straight in the current viewport coordinate system, which may not be straight in Oklch or other perceptual spaces.
- **Pipeline anchor:** `interpolate`

#### Step 5: Place — sampling the curve

- **Concept:** Place is the declarative sampling stage: given the continuous curve, where do the N stop points land? **Even** distributes by arc length in the interpolation space (approximately perceptually even steps when interpolating in a perceptual space like Oklab or CIELAB; approximately geometric steps otherwise). **Uniform** uses the curve's own parametric t value (biased toward dense source-point regions). **Tones** targets fixed Oklab L values. **Contrast** produces stops whose WCAG contrast ratios against white or black fall between `contrastMin` and `contrastMax`. When Place is **off**, stops are the exact anchor positions.
- **Try it:** Set 9 stops and even policy. Switch to contrast policy (contrastMin=2.5, contrastMax=12). Watch the stops relocate along the curve to hit the contrast targets. Check the Palette tab — each stop should show a WCAG ratio in the target range.
- **Success check:** With contrast policy, every stop in the Palette tab has a contrast ratio within the configured range against the chosen background. Stops may cluster in dark or light regions of the ramp where most contrast targets exist.
- **Common mistake:** Disabling Place when OOG warnings appear and expecting that to fix them. OOG stops come from the interpolated path passing outside the gamut — disabling Place doesn't remove the path, it just uses anchor positions instead. Fix OOG in the Gamut map stage.
- **Pipeline anchor:** `adjust`

#### Step 6: Expand — 1-D ramp to 2-D grid

- **Concept:** Expand is a per-stop generator: it takes each stop on the 1-D ramp and creates a column of related colors by adding Oklch offsets (hue, chroma, lightness). **Direction modes per axis:** ramp (0 → delta across the column), sym (−delta → +delta, centered on the base stop), edges (delta at both ends, 0 at center). Row count is configured separately from Place step count — with R rows and C columns you get R×C stops. When multiple source lists are active, each list's ramp becomes a base for Expand rows.
- **Try it:** Enable Expand. Set row count to 3, lightness axis direction to "sym," delta 0.15. The Palette tab shows a 3-row grid (tints, base, shades) for each stop. Try "ramp" direction instead to produce one-directional tints or shades.
- **Success check:** The Palette tab displays a 2-D grid. The Expand status chip reads "R×C" (e.g. "3×9"). The 3D viewport shows the ramp plus the offset copies.
- **Common mistake:** Confusing Expand "rows" with source lists. Expand rows are generated Oklch-offset copies of the base ramp; source lists are independent ramps with different anchors. Both can be active simultaneously — their interaction is multiplicative: L lists × E Expand rows = total rows in the grid.
- **Pipeline anchor:** `expand`

#### Step 7: Gamut map — ramp-only OOG policy

- **Concept:** Gamut map is the terminal ramp stage: it brings any out-of-gamut stops into sRGB before export. **Clip** hard-clips each RGB channel at 0 and 1 (fast, may shift hue). **oklch-c** reduces chroma in Oklch until the stop is in-gamut (preserves hue and lightness). **None** passes OOG stops through unchanged — use deliberately for wide-gamut export. This stage is completely separate from the Explorer Gamut setting (which defines the 3D solid), from the spline surface constraint (which geometrically snaps the curve to the solid's surface), and from CVD (which is display only).
- **Try it:** Build a ramp that crosses outside sRGB (e.g. highly chromatic Oklch arc). Note the OOG badge on the Gamut map node. Switch between clip and oklch-c and watch the affected stops change in the Palette tab. Switch to none and confirm the OOG badge on Export.
- **Success check:** With oklch-c, previously OOG stops shift inward in chroma while keeping hue angle. With clip, they may shift hue because channels clamp independently. With none, OOG values appear in the export.
- **Common mistake:** Thinking the Explorer Gamut setting controls ramp export clipping. The Explorer Gamut defines what the solid represents in the viewport; the Ramp Gamut map stage is a separate, independent terminal policy for export stops.
- **Pipeline anchor:** `gamut-map`

#### Step 8: Export — tokens and format

- **Concept:** Export serializes the final (post gamut-map) stops. **CSS** produces oklch() custom properties. **DTCG** produces W3C design-token JSON. When there is one source list and Expand is off, the output is N variables in a 1-D sequence. With multiple lists and Expand off, the grid is all lists' ramps shown together (what you see is what exports). With Expand on, the grid is the Expand result. Token names include the list index when multiple lists are present.
- **Try it:** With two source lists and Expand off, copy the CSS output. Count the variables — it should be list-count × step-count. Then enable Expand with 3 rows and re-copy: now count rows × columns.
- **Success check:** Exported token count matches the formula: 1 list, Expand off → N; 2 lists, Expand off → 2N; Expand on (R rows × C stops) → R×C. You can predict the count from the pipeline settings.
- **Common mistake:** Not checking the OOG badge on Gamut map before exporting. When policy is "none," OOG values pass through to CSS unchanged and may break renderers that clip to [0,1].
- **Pipeline anchor:** `export`

#### Step 9: Multi-list ramps — parallel pipelines

- **Concept:** With more than one source list, each list runs independently through Interpolate → Place → Gamut map and produces its own output. The lists share interpolation settings (mode, space, step count) but have separate anchors — useful for distinct color families (warm ramp vs cool ramp, signal colors for different categories) that should have the same structural parameters but different color directions. When Expand is off, the palette grid shows all lists' ramps as parallel rows; when Expand is on, the Expand row generator applies to the combined set.
- **Try it:** Create two lists with clearly different anchors (e.g. warm reds in list 1, cool blues in list 2). Enable Interpolate in Oklch, 9 stops, even Place. Without Expand, the Palette tab shows two 9-stop rows. Now enable Expand with 2 rows — observe the grid becomes 4 rows (2 lists × 2 Expand rows).
- **Success check:** Two distinct parallel ramps appear in the Palette tab when Expand is off. Enabling Expand multiplies rows correctly.
- **Common mistake:** Trying to blend anchors from two lists into one combined ramp. Lists never merge automatically — cross-list blending requires putting all anchors into one list. Multi-list is for *parallel* output, not for blending.

### Capstone
Start from "Spline Color Ramp" (`example:spline-color-ramp`). Switch interpolation space from Oklch to CIELAB and note how the arc changes. Add a second source list with 2 anchors at opposite corners of the Oklab space from list 1. Enable Expand with 3 rows, sym lightness delta 0.1. Export to DTCG — count the token groups produced (should be 2 lists × 3 rows × N stops). Then set gamut map to "oklch-c" and re-export; inspect how many stops changed by checking which values shifted.

### Glossary
- **Source list** — an ordered set of anchor colors; each list produces one independent ramp through the pipeline.
- **Active list** — the list currently targeted by picks, edits, and keyboard selection.
- **Interpolation space** — the coordinate system in which the ramp path is computed; distinct from and independent of world space.
- **Surface constraint** — a spline option that snaps each curve sample radially to the active solid's surface (geometric, not a gamut boundary check).
- **Place** — the stage that samples N discrete stops from the continuous interpolated curve using a chosen distribution policy.
- **Expand** — the 2-D grid generator: applies per-axis Oklch offsets to each stop, producing a configurable number of rows.
- **Gamut map** — the ramp's terminal OOG policy (clip, oklch-c, or none); applies only to ramp stops, not to the 3D solid or hover readouts.
- **DTCG** — W3C Design Token Community Group JSON format; an alternative export format to CSS custom properties.
- **OOG** — out-of-gamut: a stop with one or more linear RGB channels outside [0, 1].

---

## Appendix A: Example document map

| Example id | Best for tracks | Key teaching moment |
|------------|-----------------|---------------------|
| `example:large-color-ramp` | B-quick step 3, B-pipeline Interpolate | Two-anchor linear Oklch ramp; minimal anchor set producing a full ramp with surface-constrained curve |
| `example:spline-color-ramp` | B-quick step 4, B-pipeline Sources + Interpolate | Seven surface-snapped anchors; shows spline vs linear arc shape clearly with enough points |
| `example:oklab-l-slice` | A-quick step 7, A-pipeline Clip | L-slice at offset 0.55; teaches fixed-lightness cross-section as a 2D chromaticity view |
| `example:p3-shell` | A-quick step 6, A-pipeline Gamut | P3 solid + sRGB shell + cylinder cut; teaches gamut comparison via shell overlay |

---

## Appendix B: Skipped-in-quick index

| Topic | Taught in track | One-line pointer |
|-------|-----------------|-----------------|
| Cylindrical cut (chroma reveal) | A-pipeline step 6 (Clip) | Enable cylSlice in Clip / cut and reduce the radius to reveal a chroma column |
| Tessellation and auto-reduce | A-pipeline step 5 (Tessellation) | Lower N in the Tessellation step; Auto-reduce is a sidebar-footer performance policy |
| CVD simulation | A-pipeline step 8 (Vision) | Enable in the Vision step; display preview only — does not affect export |
| Interpolation space vs world space | B-pipeline step 4 (Interpolate) | splineSpace (where the ramp path bends) ≠ spaceMode (viewport geometry) |
| Spline surface constraint | B-pipeline step 4 (Interpolate) | Snaps each curve sample radially to the solid surface; distinct from gamut mapping |
| Arc-long hue direction | B-pipeline step 4 (Interpolate) | arcLong routes the Oklch hue arc the long way around; useful for rainbow-like paths |
| Place policies: tones, contrast | B-pipeline step 5 (Place) | Tones targets fixed Oklab L values; contrast targets WCAG ratios against white or black |
| Gamut map policies (clip vs oklch-c) | B-pipeline step 7 (Gamut map) | Default clips channels; oklch-c reduces chroma in Oklch preserving hue |
| Multi-list parallel ramps | B-pipeline step 3 + step 9 | Add a second list with the + chip in Sources |
| Expand generator (2-D palette) | B-pipeline step 6 (Expand) | Enable in the Expand step; row/col generators add Oklch-axis offsets per stop |
| DTCG export format | B-pipeline step 8 (Export) | W3C design-token JSON; an alternative to CSS custom properties |

---

## Appendix C: Cross-track concept index

| Term | First introduced | Step ref |
|------|-----------------|---------|
| Solid | A-quick | A-quick step 3 |
| Gamut | A-quick | A-quick step 5 |
| Shell overlay | A-quick | A-quick step 6 |
| Slice | A-quick | A-quick step 7 |
| Stimulus / chain | A-quick | A-quick step 4 |
| World space (display only) | A-pipeline | A-pipeline step 4 |
| Transfer curve (encoding) | A-pipeline | A-pipeline step 3 |
| CVD (display only, not export) | A-pipeline | A-pipeline step 8 |
| Tessellation / N | A-pipeline | A-pipeline step 5 |
| Anchor / source list | B-quick | B-quick step 3 |
| Ramp / stop | B-quick | B-quick step 5 |
| Interpolation space (≠ world space) | B-quick | B-quick step 4 |
| Place stage | B-quick | B-quick step 5 |
| Export tokens | B-quick | B-quick step 7 |
| OOG (out-of-gamut) | B-quick | B-quick step 6 |
| Multi-list / parallel ramps | B-pipeline | B-pipeline step 3 + step 9 |
| Surface constraint | B-pipeline | B-pipeline step 4 |
| Expand (2-D grid generator) | B-pipeline | B-pipeline step 6 |
| Gamut map (ramp-only terminal policy) | B-pipeline | B-pipeline step 7 |
| DTCG | B-pipeline | B-pipeline step 8 |
