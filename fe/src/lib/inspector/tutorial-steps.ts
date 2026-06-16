import type { ExplorerState } from '$lib/engine/types';

export type TutorialZone = 'sidebar-inline' | 'viewport-float' | 'inspector-adjacent' | 'docbar-adjacent';

export interface TutorialStep {
	title: string;
	concept: string;
	tryIt: string;
	successCheck: string;
	commonMistake: string;
	zone: TutorialZone;
	/** CSS selector targeting a `data-tutorial` attribute, or null for whole-area steps. */
	target: string | null;
	/** Example id to offer a "Load example" affordance — not auto-loaded. */
	suggestedExample?: string;
	/** If present and returns true at start time, this step is skipped. Only honoured for leading steps. */
	skip?: (explorer: ExplorerState) => boolean;
}

// ---------------------------------------------------------------------------
// Prelude — prepended to every track
// ---------------------------------------------------------------------------

export const PRELUDE_STEPS: TutorialStep[] = [
	{
		title: 'Turn off auto-rotation',
		concept:
			'Color Lab opens in a slow-orbit showcase mode. Tutorials need a stable scene while you read and click. Auto-rotate is a sidebar footer preference — it is saved as an app preference, not in documents.',
		tryIt: 'Find "Auto-rotate" in the left sidebar footer and turn it off.',
		successCheck:
			'The solid stops orbiting on its own. Dragging the viewport now orbits only when you push.',
		commonMistake:
			'Confusing auto-rotate with camera reset. Camera Reset (View step) returns the viewpoint to a default angle — it is not auto-rotate.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="auto-rotate"]',
		skip: (e) => !e.autoRotate
	},
	{
		title: 'Show overlay aids',
		concept:
			'"Hide aids" suppresses the surface grid, slice/cylinder outlines, reference shell, and ramp markers all at once — without losing the individual settings. Turning it off reveals the scaffolding you will use in later steps. The floor grid is a separate toggle. Two comfort options sit nearby: a neutral L = 0.5 backdrop (same sidebar footer) calms the surround for judging color, and the Text button in the header scales fonts, contrast, and line height if you need it.',
		tryIt: 'Disable "Hide aids" in the left sidebar footer.',
		successCheck:
			'When relevant pipeline stages are active, overlays such as the surface grid and outlines are now visible.',
		commonMistake:
			'Expecting the floor grid to respond to Hide aids — it does not. Toggle it independently.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="hide-aids"]',
		skip: (e) => !e.hideAids
	},
	{
		title: 'The pipeline rail',
		concept:
			'The rail at the top of the sidebar is a read-only map of every stage — Explorer (Gamut, World, Tessellation, Clip, View, Vision) and Ramp (Sources, Gamut map, Export). Each node shows its live status, and out-of-gamut stops surface as a warning chip. The rail owns no parameters; it is navigation plus a status dashboard.',
		tryIt: 'Click a node in the rail — the matching step below opens and scrolls into view. Arrow keys move focus along the rail (roving focus); press Enter to jump.',
		successCheck:
			'Clicking a rail node expands and scrolls to that step\'s controls. Arrow keys move focus along the rail without leaving the page.',
		commonMistake:
			'Trying to change a setting from the rail. It only navigates and reports status — edit values in the step controls it scrolls you to.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="pipeline-rail"]'
	}
];

// ---------------------------------------------------------------------------
// A-quick
// ---------------------------------------------------------------------------

export const A_QUICK_STEPS: TutorialStep[] = [
	{
		title: 'The solid is a gamut',
		concept:
			'The 3D solid is every legal RGB triple the active gamut can encode, placed in the chosen world space. Most tools show a gamut as a 2D triangle, which collapses lightness entirely. Here you navigate the full volume — shape, chroma, and lightness simultaneously.',
		tryIt: 'Orbit by clicking and dragging. Locate the white corner (top) and black corner (bottom). Find the most saturated-looking region.',
		successCheck:
			'You can orient yourself — brighter up, more chromatic outward — and understand that the solid\'s shape communicates real perceptual geometry.',
		commonMistake:
			'Thinking the shape is decorative. In Oklab layout the vertical axis is perceptual lightness (L), so "higher" really does approximate "looks brighter."',
		zone: 'viewport-float',
		target: null
	},
	{
		title: 'Orbit and inspect a hover',
		concept:
			'Moving the mouse over the solid runs an analytic ray test and feeds the result to the right inspector. The Values panel shows the full transform chain: encoded RGB → linear → XYZ → LMS → CIELAB → Oklab → Oklch. Every number uses the same math as the renderer — panels cannot disagree.',
		tryIt: 'Hover slowly across the solid surface and watch the right panel update. Find a color near the red corner and read its Oklab L and C values.',
		successCheck:
			'The inspector updates live as the cursor moves. You can read lightness and chroma for any point without clicking.',
		commonMistake:
			'Expecting to have to click to "select" a color for reading. The chain updates on hover. Clicking to pick source anchors is covered in the Ramp lanes — it only works when "+ Pick on solid" is armed, or the A key is held.',
		zone: 'viewport-float',
		target: null
	},
	{
		title: 'Change gamut, compare shape',
		concept:
			'Switching the gamut swaps which RGB primary set the solid represents. Display P3 has wider primaries than sRGB — its solid extends farther, especially in green and red-orange. The same stored code value encodes a different stimulus in each gamut.',
		tryIt: 'Switch gamut from sRGB to Display P3. Notice the solid grow. Switch back to confirm the difference. Hover the same position in both and compare XYZ values in the inspector.',
		successCheck:
			'P3\'s solid visibly extends beyond where sRGB ended. The XYZ values differ at the same encoded position.',
		commonMistake:
			'Thinking changing the gamut alters source anchor colors or export output. The Gamut stage defines what the 3D solid represents — it does not touch ramp anchors or exported tokens.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-gamut"]'
	},
	{
		title: 'Shell overlay — two gamuts at once',
		concept:
			'The shell overlay draws the wire boundary of a reference gamut on top of the active solid. With a P3 solid and sRGB shell, you see exactly which P3 colors fall outside sRGB — they poke beyond the wire cage. This is the standard gamut-comparison view. A companion overlay, "Chromaticity overlay," draws the spectral locus at X+Y+Z=1 — the outer boundary that no physically real stimulus can exceed. Try "Spectral locus rim" from the Chromaticity overlay select in the same Gamut step.',
		tryIt: 'Set the active gamut to Display P3. In the Gamut step, set the Reference gamut shell to "sRGB." Orbit until the wire cage is visible inside the solid. Then set Chromaticity overlay to "Spectral locus rim" to see the spectral boundary glowing around the outside.',
		successCheck:
			'A wire outline smaller than the solid is visible. Colors between the cage and the solid surface are P3-only. With the spectral locus rim enabled, a colored ring appears outside both — real-world stimuli cannot exceed it.',
		commonMistake:
			'Confusing the shell with slice outlines. The shell is a fixed reference boundary for a comparison gamut; slice outlines move with the clip plane.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-gamut"]',
		suggestedExample: 'example:p3-shell'
	},
	{
		title: 'Slice at fixed lightness',
		concept:
			'Enabling the slice plane cuts the solid with a flat cross-section. With plane mode L, you see all colors at one Oklab lightness level — an opponent-plane cross-section, not a chromaticity diagram. Moving the offset slides the plane through the solid.',
		tryIt: 'Open the Clip / cut step in the sidebar (click its header to expand). Enable slice, set plane mode to L, and drag the offset to about 0.55. Orbit to see the cross-section face-on.',
		successCheck:
			'A flat cross-section appears. Moving the offset travels from dark (near 0) to light (near 1) through the solid.',
		commonMistake:
			'Thinking the slice boundary shows sRGB vs wide-gamut limits. The perimeter is the gamut boundary at that L value — use the shell for gamut comparisons.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-clip"]',
		suggestedExample: 'example:oklab-l-slice'
	},
	{
		title: 'Inspector panels — what each adds',
		concept:
			'The right inspector has five tabs. Values is the full numeric chain (used above). Transfer plots the gamut\'s encoding curve. Cones shows LMS excitations. The chromaticity tab plots either a true observer-aware chromaticity diagram (CIE xy, u\'v\', or MacLeod–Boynton) or a fixed-lightness opponent-plane view (Oklab a/b, CIELAB a*/b*). All update from the same hover hit — they are views of the same calculation, not independent lookups. More tutorials are available — click the Tutorial button again to explore the Ramp lanes.',
		tryIt: 'Hover a vivid green and click through Transfer, Cones, and the chromaticity tab. Notice all three panels respond to the same cursor movement without any extra click.',
		successCheck:
			'All tabs update when the cursor moves over the solid. You can correlate LMS bar heights with the chromaticity or opponent-plane position of the same color.',
		commonMistake:
			'Treating Transfer as the export encoding curve. Transfer shows the gamut\'s decoding assumption (encoded → linear); it has no direct relation to ramp token output.',
		zone: 'inspector-adjacent',
		target: '[data-tutorial="inspector-tabs"]'
	}
];

// ---------------------------------------------------------------------------
// A-pipeline
// ---------------------------------------------------------------------------

export const A_PIPELINE_STEPS: TutorialStep[] = [
	{
		title: 'Gamut — primaries and transfer',
		concept:
			'The Gamut stage decides which physical device the RGB cube represents: its primary chromaticities and transfer curve. The same (R, G, B) triple encodes a different spectral stimulus in sRGB vs Rec. 2020 because the primaries sit at different colorimetric positions. Non-D65 gamuts (NTSC = Illuminant C, CIE 1931 RGB = Illuminant E) are Bradford-adapted to the D65 interchange white before the perceptual layout, so their neutral axis stays achromatic.',
		tryIt: 'Switch gamuts while hovering the same screen position. Watch the XYZ values in the inspector change even though the cursor did not move. Set active gamut to Display P3 and enable the sRGB shell overlay to see P3-exclusive colors. Try NTSC 1953 or CIE 1931 RGB — the white vertex stays neutral, not tinted.',
		successCheck:
			'You can explain why (R=1, G=0, B=0) encodes a different stimulus in sRGB vs Rec. 2020 — and see that difference as a geometric shift in the solid.',
		commonMistake:
			'Assuming the Gamut setting filters the ramp export to that gamut. The Gamut stage defines what the solid represents in the viewport; the ramp\'s Gamut map stage is a separate terminal policy.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-gamut"]',
		suggestedExample: 'example:p3-shell'
	},
	{
		title: 'Observer model — whose eyes',
		concept:
			'The Observer model (inside the Gamut step) selects the color-matching functions used everywhere downstream: the WebGL solid, CVD simulation, the Cones panel, and the CIE chromaticity diagrams. Stockman & Sharpe (2°/10°) are physiological cone fundamentals; CIE 1931 2° and CIE 1964 10° are the classic standard observers. Changing it re-derives the rgb↔lms matrices at runtime.',
		tryIt: 'In the Gamut step, switch Observer model between CIE 1931 2° and CIE 1964 10°. Watch the Cones panel header and the CIE diagram labels update. Note the MacLeod–Boynton diagram does not follow — it is pinned to a fixed 2° basis.',
		successCheck:
			'The Cones panel names the active observer dataset and the CIE chromaticity labels reflect it. MacLeod–Boynton stays on its fixed 2° basis regardless of the selector.',
		commonMistake:
			'Expecting the MacLeod–Boynton diagram to track the Observer model. It is intentionally fixed to a calibrated 2° table, independent of the selector.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="observer-model"]'
	},
	{
		title: 'Chromaticity & opponent-plane diagrams',
		concept:
			'The inspector\'s chromaticity tab plots one of two diagram families. True chromaticity diagrams (CIE 1931 xy, CIE 1976 u\'v\', CIE 1960 uv, MacLeod–Boynton) show hue and saturation independent of luminance and follow the Observer model — except MacLeod–Boynton, pinned to a fixed 2° basis. Opponent-plane views (Oklab a/b, CIELAB a*/b*) instead slice the perceptual space at a fixed lightness, with a sampled gamut-boundary outline.',
		tryIt: 'Open the chromaticity tab and set the diagram selector to Oklab a/b. Hover the solid — the marker tracks the a/b position at the hovered lightness. Switch to CIE 1931 xy and note the spectral-locus horseshoe instead.',
		successCheck:
			'You can tell a luminance-independent chromaticity diagram (horseshoe locus) from a fixed-lightness opponent plane (Oklab a/b square), and the hovered color\'s marker matches across tabs.',
		commonMistake:
			'Reading the Oklab a/b plane as a CIE chromaticity diagram. It is a perceptual opponent slice at one lightness, not a luminance-free chromaticity space.',
		zone: 'inspector-adjacent',
		target: '[data-tutorial="inspector-tabs"]'
	},
	{
		title: 'World space — geometry only',
		concept:
			'World space chooses the 3D coordinate system: RGB (raw cube), XYZ, CIELAB, Oklab, or Luma. It is a display decision only — it does not change stored colors, source anchors, or exported ramp tokens. Switching spaces triggers a short morph animation that shows the solid reshaping itself between the two coordinate systems.',
		tryIt: 'Switch from Oklab to RGB — watch the solid morph into a regular cube. Switch to CIELAB. Verify that the hover chain values in the inspector are identical regardless of world space.',
		successCheck:
			'Changing world space reshapes the solid but the Values rows remain the same for the same hovered stimulus. Same colors, different geometric arrangement.',
		commonMistake:
			'Assuming world space changes what ramp interpolation computes. The splineSpace setting is separate — you can interpolate in Oklch while displaying in Oklab layout.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-world"]'
	},
	{
		title: 'Tessellation — mesh resolution',
		concept:
			'Tessellation sets the subdivision count (N) per cube face. More subdivisions produce smoother slice edges but cost more GPU time. Auto-reduce in the sidebar footer lowers N automatically when frame timing exceeds the minimum FPS target — a performance preference, not a pipeline stage.',
		tryIt: 'Set N to 64 and enable the slice at L≈0.55. Notice the faceted, stepped outline. Raise N to 256 and observe the edge smooth out. The surface grid shows the subdivision directly.',
		successCheck:
			'At N=64 the slice outline has visible steps; at N=256 it appears smooth. You can choose a value that balances quality and performance.',
		commonMistake:
			'Thinking higher N improves color math accuracy. The transform runs per-vertex; colorimetric precision is identical at any N — only geometric precision of slice edges changes.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-tessellation"]'
	},
	{
		title: 'Clip / cut — slice and cylinder',
		concept:
			'The Clip stage exposes the inside of the solid by cutting it with a plane and/or a cylinder. A slice at fixed L, H, or C creates a 2D cross-section; a cylindrical cut reveals a chroma column. Both affect what is visible and hoverable — they do not alter stored colors or ramp stops.',
		tryIt: 'Enable the slice at planeMode L, offset 0.5. Then enable the cylinder cut and shrink the radius to reveal only the high-chroma perimeter. Combine both.',
		successCheck:
			'You can navigate to a specific lightness and chroma range simultaneously. The viewport shows the intersection of both cuts.',
		commonMistake:
			'Expecting the cylinder cut to clip export stops. It is viewport-only. Ramp stops outside the cylinder remain in the export unless the Gamut map stage removes them.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-clip"]'
	},
	{
		title: 'View — camera and floor',
		concept:
			'The View stage controls navigation and orientation aids: camera distance, field of view, floor grid, and camera reset. Camera reset returns to a sensible default angle without touching any color or pipeline setting. The floor grid is independent of the overlay aids toggle.',
		tryIt: 'Orbit, zoom, and pan. Use camera reset in the View step to return to the default angle. Toggle the floor grid on and off to confirm it is independent.',
		successCheck:
			'You can return to a known viewpoint at any time without affecting gamut, world space, slice, or any other pipeline setting.',
		commonMistake:
			'Using camera reset to undo pipeline changes. Reset moves the camera only — all color and pipeline settings remain exactly as you left them.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-view"]'
	},
	{
		title: 'Vision — CVD is display only',
		concept:
			'The Vision stage applies a color-vision-deficiency simulation to everything on screen: protanopia, deuteranopia, or tritanopia at adjustable severity. It runs at the LMS stage. CVD is a display preview only — it does not alter source anchors, ramp stop values, or exported tokens. More tutorials are available — click the Tutorial button again to explore the Ramp lanes.',
		tryIt: 'Enable protan CVD at full severity. The viewport shifts dramatically. Check the Export step and confirm the token values are unchanged. Turn CVD off — the viewport returns to normal.',
		successCheck:
			'CVD visibly shifts the viewport appearance; the Values panel shows the cvdLin row with simulated values. Export text is identical with and without CVD active.',
		commonMistake:
			'Assuming CVD-previewed stop colors are what gets exported. Only the ramp\'s Gamut map stage affects export; CVD is strictly visual simulation of the display signal.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-cvd"]'
	}
];

// ---------------------------------------------------------------------------
// B-quick
// ---------------------------------------------------------------------------

export const B_QUICK_STEPS: TutorialStep[] = [
	{
		title: 'Add three source colors',
		concept:
			'Every ramp starts with ordered source colors — anchors — in the active source list. You can pick them on the 3D solid (arm "+ Pick on solid," then click the surface) or enter a color via the inline color picker. The list order matters: interpolation runs from the first anchor to the last. Color Lab also supports multiple source lists that produce parallel ramps — covered in the Ramp Pipeline lane.',
		tryIt: 'In the Sources step, arm "+ Pick on solid," then click once on a dark region, once in a mid-chroma region, and once on a bright region. Three rows appear in the list.',
		successCheck:
			'Three anchor rows are visible in the Sources list and three markers appear in the 3D viewport.',
		commonMistake:
			'Picking anchors without noticing the order. The ramp interpolates row 1 → row 2 → row 3. Use Up/Down buttons to reorder if needed (dark first usually means lighter stops higher up the palette).',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-sources"]'
	},
	{
		title: 'Interpolate on — linear vs spline',
		concept:
			'With Interpolate on, Color Lab draws a continuous path between anchors. Linear connects them with straight chords; Spline fits a smooth arc through all points. With exactly two anchors the paths coincide — three or more anchors are needed to see the arc diverge. The interpolation space also shapes the path: Oklch keeps chroma high along the arc; Oklab takes a more direct route that may pass through a desaturated middle. Lower the solid opacity first so the curve is visible through the solid.',
		tryIt: 'First, in the Gamut step, lower Solid opacity to 50–75%. Then open Interpolate and switch between linear and spline — watch the curve change shape. Switch the interpolation space from Oklab to Oklch and back.',
		successCheck:
			'The curve is visible inside the semi-transparent solid. Spline mode produces a smooth arc through the mid-anchor; linear connects them with straight segments.',
		commonMistake:
			'Confusing interpolation space with world space. Interpolation space is where the ramp path is computed; world space is viewport geometry only. These are independent settings.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-gamut"]',
		suggestedExample: 'example:spline-color-ramp'
	},
	{
		title: 'Place on — where the stops land',
		concept:
			'Place decides where the N discrete stops fall on the continuous path. "Even" spaces stops by arc-length — approximately even perceptual steps when interpolating in Oklab or CIELAB. This is the core capability that sets Color Lab apart from HSL-based tools: stops spread by how far apart they feel, producing ramps that are smooth and harmonic whether a two-tone gradient or a rainbow.',
		tryIt: 'Enable Place. Set steps to 9. Nine colored dots appear along the curve. Slide the step count between 5 and 21.',
		successCheck:
			'Exactly N stops appear in the viewport and Palette tab. Changing the step count immediately updates the count.',
		commonMistake:
			'Leaving Place off. When disabled, stops are the exact source anchor positions only — not a sampled ramp. You need Place on to distribute colors evenly along the interpolated path.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-adjust"]'
	},
	{
		title: 'Read the palette',
		concept:
			'The right inspector\'s Palette tab shows the final generated colors exactly as they will be exported — post gamut-map, with WCAG contrast ratios. This is the authoritative ramp preview; the 3D viewport markers are orientation aids, not pixel-accurate swatches.',
		tryIt: 'Open the Palette tab on the right. Hover each swatch to read its hex and Oklch values. Check whether any OOG indicators appear on stops that exceed the active colorspace (the export target).',
		successCheck:
			'You can read the hex value of each stop and confirm the lightness progression matches your intent. If any stops venture outside the active colorspace, an OOG indicator appears.',
		commonMistake:
			'Treating 3D viewport stop markers as final colors. They are accurate colorimetrically but rendered through your monitor profile; the Palette tab reads the computed values directly.',
		zone: 'inspector-adjacent',
		target: '[data-tutorial="inspector-palette-tab"]'
	},
	{
		title: 'Export the ramp',
		concept:
			'Export serializes the final stops to CSS oklch() custom properties or DTCG JSON. Token values are post-gamut-map. By default the Gamut map policy is "None (show OOG)" — out-of-gamut stops export as-is. Switch to "Clip (clamp)" or "Preserve chroma" to bring stops into the active colorspace (sRGB by default) before export.',
		tryIt: 'Open the Export step and copy the CSS output. Paste it into a text editor. Check that the oklch() L values increase or decrease monotonically as expected.',
		successCheck:
			'You have CSS (or DTCG JSON) on your clipboard that you could paste into a real stylesheet. The lightness values reflect the dark-to-light order of your anchors.',
		commonMistake:
			'Expecting stops to be auto-clipped to the active colorspace on export. The default Gamut map policy is "None" — OOG stops export unchanged. Switch to "Clip (clamp)" or "Preserve chroma" to keep values in gamut.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-export"]'
	},
	{
		title: 'Save, share, and import',
		concept:
			'Color Lab stores ramp parameters as named documents in this browser. The session (last-open) state is written automatically; a named checkpoint requires an explicit Save. To take a document elsewhere: Save to file writes a JSON document; Share (in the document bar\'s More menu) copies a shareable link or the raw JSON; Import (also in More) restores from a file, a URL, pasted JSON, or a #s=… link hash. Everything stays in your browser — nothing is uploaded. More tutorials are available — click the Tutorial button again to explore the Explorer lanes or the Pipeline deep-dive.',
		tryIt: 'Click Save (or Save as) in the document bar and name the document; reload the tab to confirm it restores. Then open the More menu → Share → Copy link, and paste that link into a new tab to watch the document rebuild from the URL.',
		successCheck:
			'After reloading, source anchors, interpolation settings, and step count are all present. A copied share link opens the same document in a fresh tab, and Import accepts a file, pasted JSON, or a #s=… hash.',
		commonMistake:
			'Confusing the session (auto-restored last-open state) with a named document. The session always restores the last state, but a named checkpoint requires an explicit Save. Sharing exports the document data into the link/JSON — it is not a server upload.',
		zone: 'docbar-adjacent',
		target: '[data-tutorial="docbar-save"]'
	}
];

// ---------------------------------------------------------------------------
// B-pipeline
// ---------------------------------------------------------------------------

export const B_PIPELINE_STEPS: TutorialStep[] = [
	{
		title: 'Sources — lists, anchors, picking',
		concept:
			'Sources is the top of the ramp pipeline. One source list is one ordered set of anchors that feeds one independent ramp. Multiple lists produce parallel ramps — each list carries its own pipeline settings (interpolate, place, expand, constraints) and runs independently; the terminal Gamut map is shared. Adding a list clones the active list\'s pipeline. Only the active list (highlighted chip) is editable; switch by clicking a chip.',
		tryIt: 'Add a second list using the + chip. Add two anchors with colors clearly different from list 1. Switch back to list 1 — the viewport now shows two distinct curves.',
		successCheck:
			'The Sources status chip reads "2 lists · N pts." Two separate curves appear in the 3D viewport.',
		commonMistake:
			'Expecting the two lists to blend into one ramp. Lists are parallel, not merged — each produces its own independent set of stops.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-sources"]'
	},
	{
		title: 'Interpolate — path and space',
		concept:
			'Interpolate builds the continuous curve from anchors. Off passes anchors through unchanged. Linear connects with straight chords; Spline fits a smooth parametric arc. With exactly two anchors, spline and linear trace the same chord — the arc diverges only with three or more points. The interpolation space (Oklab, Oklch, sRGB, CIELAB, "world") is where that path bends — different spaces produce dramatically different arcs through the same anchor set.',
		tryIt: 'Load "Spline Color Ramp" via the button above (five surface-snapped anchors). Note: loading replaces your current source lists — rebuild your two-list setup afterwards for steps 5–9. Switch between linear and spline and watch the arc change. Change the interpolation space from Oklch to sRGB and observe how the arc bends.',
		successCheck:
			'You can describe why the same anchor set produces different ramp paths in Oklch vs sRGB — the arc shape reflects the coordinate geometry of each space. Spline produces a visibly smoother arc than linear through the middle anchors.',
		commonMistake:
			'"World" interpolation space does not always produce a straight line. The path is straight in the viewport\'s current coordinate system, which may not be straight in Oklch.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-interpolate"]',
		suggestedExample: 'example:spline-color-ramp'
	},
	{
		title: 'Place — sampling the curve',
		concept:
			'Place is the declarative sampling stage. Even distributes by arc length — approximately even perceptual steps in Oklab or CIELAB. Uniform uses the curve\'s own parametric t. Tones targets fixed Oklab L values. Contrast produces stops whose WCAG ratios fall within contrastMin/contrastMax. Off uses exact anchor positions.',
		tryIt: 'Set 9 stops, even policy. Switch to contrast policy (contrastMin=2.5, contrastMax=12). Watch the stops relocate. Check the Palette tab — each stop should show a WCAG ratio near the target range.',
		successCheck:
			'Stops redistribute along the curve toward positions that hit the contrast targets. Short ramps or narrow chroma ranges may approximate the targets rather than land exactly.',
		commonMistake:
			'Disabling Place when OOG warnings appear, expecting it to help. OOG stops come from the path going outside the gamut — disabling Place doesn\'t remove the path. Fix OOG in Gamut map.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-adjust"]'
	},
	{
		title: 'Expand — 1-D ramp to 2-D grid',
		concept:
			'Expand (Spread) turns the 1-D ramp into a 2-D palette along two axes: rows make related ramps, columns expand each stop into variants. Each axis offsets hue, chroma, and/or lightness by a delta. Direction modes: ramp (0 → delta), sym (−delta → +delta), edges (delta at both ends, 0 at center). Row and column counts are independent of Place step count.',
		tryIt: 'Load "Tonal grid (Expand)" via the button above for a pre-built 3-row blue grid. Or start fresh: enable Expand, set row count to 3, lightness axis to "sym," delta 0.15. The Palette tab shows a 3-row grid. Try "ramp" direction instead.',
		successCheck:
			'The Palette tab displays a 2-D grid. The Expand status chip reads "R×C" (e.g. "3×9").',
		commonMistake:
			'Confusing Expand rows with source lists. Expand rows are Oklch-offset copies of the base ramp; source lists are independent ramps with different anchors. Both can be active simultaneously.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-expand"]',
		suggestedExample: 'example:expand-grid'
	},
	{
		title: 'Gamut map — ramp-only OOG policy',
		concept:
			'Gamut map is the terminal ramp stage: it brings out-of-gamut stops into the active colorspace output target (sRGB by default) before export. "Clip (clamp)" hard-clips each RGB channel. "Preserve chroma" reduces chroma in Oklch (keeps hue and lightness). "None" passes OOG stops through unchanged. This target is separate from the Explorer Gamut setting, the spline surface constraint, and CVD.',
		tryIt: 'Load "P3 OOG stops" via the button above — a ramp with a P3-exclusive vivid green anchor that sits beyond the active colorspace target boundary. The OOG badge on the Gamut map node shows how many stops exceed the target (sRGB by default). Switch between "Clip (clamp)" and "Preserve chroma" and watch the affected stops shift in the Palette tab. The Gamut map panel also shows a Raw → Final before/after chip pair and an "N out of gamut → M after mapping" count when a policy is active.',
		successCheck:
			'With "Preserve chroma," OOG stops shift inward in chroma while keeping hue angle. With "Clip (clamp)," they may shift hue because channels clamp independently.',
		commonMistake:
			'Thinking the Explorer Gamut setting controls ramp export clipping. The Explorer Gamut defines what the solid represents; the Ramp Gamut map targets the active colorspace (sRGB by default; the analytic mapper is sRGB-only today).',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-gamut-map"]',
		suggestedExample: 'example:p3-oog-ramp'
	},
	{
		title: 'Export — tokens and format',
		concept:
			'Export serializes the final (post gamut-map) stops. CSS produces oklch() custom properties; DTCG produces W3C design-token JSON. With one list and Expand off, output is N variables. With multiple lists and Expand off, the grid shows all lists\' ramps together. With Expand on, output is the Expand result.',
		tryIt: 'With two source lists and Expand off, copy CSS. Count the variables — should be list-count × step-count. Enable Expand with 3 rows and re-copy: count rows × columns.',
		successCheck:
			'Token count matches: 1 list, Expand off → N; 2 lists, Expand off → 2N; Expand on → R×C.',
		commonMistake:
			'Not checking the OOG badge on Gamut map before exporting. When policy is "none," OOG values pass through to CSS unchanged.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-export"]'
	},
	{
		title: 'Multi-list ramps — parallel pipelines',
		concept:
			'With more than one source list, each list carries its own pipeline — interpolation, placement, expand, and constraint settings are per-list, not shared. Each list runs independently through its Interpolate → Place → Expand stages; the terminal Gamut map is a single shared step applied to every list. Adding a list clones the active list\'s pipeline; "Apply pipeline to all" copies the active list\'s settings onto the others, and a divergence cue marks lists whose settings differ. When Expand is off, the palette shows all lists\' ramps as parallel rows. More tutorials are available — click the Tutorial button again to explore the Explorer lanes or the Quick Ramp overview.',
		tryIt: 'Verify you still have two source lists from step 3 (or rebuild: + chip in Sources, two contrasting anchors in each list). On the active list, set Interpolate to Oklch, 9 stops, even Place — then switch lists and give the second a different setting to see the divergence cue. The Palette tab shows two parallel 9-stop rows. Enable Expand with 2 rows — observe 4 rows total (2 lists × 2).',
		successCheck:
			'Two distinct parallel ramps appear in the Palette tab when Expand is off. Enabling Expand multiplies rows correctly.',
		commonMistake:
			'Trying to blend anchors from two lists into one ramp. Lists never merge — cross-list blending requires putting all anchors into one list. Multi-list is for parallel output.',
		zone: 'sidebar-inline',
		target: '[data-tutorial="node-sources"]'
	}
];
