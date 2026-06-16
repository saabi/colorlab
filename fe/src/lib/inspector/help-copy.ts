export type InspectorPanelId = 'transfer' | 'cones' | 'xy' | 'values' | 'palette';
export type PipelineHelpId =
	| 'pipelineGamut'
	| 'pipelineWorld'
	| 'pipelineTessellation'
	| 'pipelineClip'
	| 'pipelineVision'
	| 'pipelineRampBuilder'
	| 'pipelineSources'
	| 'pipelineInterpolate'
	| 'pipelineAdjust'
	| 'pipelineExpand'
	| 'pipelineGamutMap'
	| 'pipelineExport'
	| 'pipelineView';
export type HelpId = InspectorPanelId | PipelineHelpId;

export interface HelpSource {
	label: string;
	href?: string;
}

export interface HelpStageRow {
	label: 'Input' | 'Changes' | 'Output' | 'Does not affect' | string;
	text: string;
	tone?: 'neutral' | 'change' | 'output' | 'exclude';
}

export interface PanelHelpContent {
	title: string;
	summary: string;
	/** Optional extra paragraphs (e.g. pipeline scope, future work). */
	details?: string[];
	/** Optional structured stage rows for scan-friendly pipeline help. */
	stageRows?: HelpStageRow[];
	sources: HelpSource[];
}

const stageRows = (input: string, changes: string, output: string, exclude: string): HelpStageRow[] => [
	{ label: 'Input', text: input, tone: 'neutral' },
	{ label: 'Changes', text: changes, tone: 'change' },
	{ label: 'Output', text: output, tone: 'output' },
	{ label: 'Does not affect', text: exclude, tone: 'exclude' }
];

export const INSPECTOR_HELP: Record<InspectorPanelId, PanelHelpContent> = {
	transfer: {
		title: 'Transfer (encode to linear)',
		summary:
			'Plots the selected gamut\u2019s opto-electronic transfer function (encoded vs linear). RGB dots mark the hovered stimulus\u2019s linear channels on that curve; smaller white dots show the CVD-simulated path when vision simulation is active.',
		details: [
			'Pipeline role today: this is the encoding step only. Stored or display RGB codes are mapped to linear light through the active gamut\u2019s TRC (transfer.ts). Matrices, cone fundamentals, CIELAB/Oklab, and theme ramps all run downstream of this curve \u2014 nothing here uses a perceptual distance metric.',
			'Non-Riemannian color geometry does not affect this panel or step. Bujack et al. model how perceived difference between two colors accumulates (diminishing returns: large steps are not the sum of small ones; geodesics in perceptual space need not be straight lines in Oklab or CIELAB). That belongs after linearization, where the values panel and theme tools operate.',
			'Why it is cited here: the instrument chains physical display encoding (this curve) to perceptual readouts that inherit metric limitations. Theme \u201ceven Oklab spacing\u201d uses Euclidean arc length in Oklab \u2014 a practical local approximation, not the non-Riemannian metric from those papers.',
			'Possible later integration: a non-Riemannian distance field on linear RGB or Oklab could drive geodesic theme paths, large-step interpolation, or spacing that respects diminishing returns, while standard TRCs remain for device encoding unless a custom display transfer is modeled explicitly.'
		],
		sources: [
			{ label: 'IEC 61966-2-1 sRGB piecewise curve (sRGB / P3 / Rec.2020 gamuts)' },
			{ label: 'Pure gamma 2.2 (NTSC, EBU, SMPTE-C); linear (CIE 1931 RGB)' },
			{
				label:
					'Related (downstream): Bujack et al., non-Riemannian perceptual color space, PNAS 2022',
				href: 'https://doi.org/10.1073/pnas.2119753119'
			},
			{
				label:
					'Related (downstream): Bujack et al., The Geometry of Color in the Light of a Non-Riemannian Space, CGF 2025 (EuroVis)',
				href: 'https://doi.org/10.1111/cgf.70136'
			}
		]
	},
	cones: {
		title: 'Cone fundamentals / LMS excitations',
		summary:
			'Observer dataset sensitivity curves (L/M/S) with a CVD-aware visible-spectrum strip behind them. The panel title names the active observer dataset; bars are LMS excitations for the hovered color (integrals over the spectrum), not samples on the \u03bb-curves. Dominant-wavelength marker shown only for spectral colors.',
		sources: [
			{ label: 'Selected observer spectral dataset' },
			{ label: 'CVD simulation at LMS stage (Vi\u00e9not/Brettel-style projection; design \u00a714)' },
			{
				label:
					'Integral view of color (Helmholtz): general colors are three magnitudes, not points on wavelength curves'
			}
		]
	},
	xy: {
		title: 'Chromaticity / plane view',
		summary:
			'Observer-aware chromaticity or fixed-lightness opponent-plane view. CIE modes project the active observer\'s XYZ coordinates. MacLeod-Boynton is fixed to the bundled CIE 2° table and Stockman-Sharpe 2° LMS basis — it does not follow the Observer model selector. Oklab and CIELAB show sampled fixed-lightness gamut cross-sections. Marker shows the hovered stimulus; sRGB fill is a display preview where an inverse is defined.',
		sources: [
			{ label: 'CIE colorimetry and selected observer dataset (CIE xy/uv/u′v′ modes)' },
			{ label: 'CIE MacLeod-Boynton 2° chromaticity table (fixed SS 2° LMS basis)' },
			{ label: 'Spectral locus from the active observer model or table-backed diagram source' },
			{ label: 'Composite colors are off-locus excitations, not spectral points' }
		]
	},
	values: {
		title: 'Hovered stimulus',
		summary:
			'Numeric transform chain for the hovered point on the solid \u2014 encoded RGB through linear, XYZ, LMS, CIELAB, Oklab, OKLCh. All panels read from this single CPU evaluation so instruments cannot disagree.',
		sources: [
			{ label: 'Single-source pipeline design (design.md \u00a74, \u00a76)' },
			{ label: 'Bj\u00f6rn Ottosson, Oklab (2020)' },
			{ label: 'CIE 15 CIELAB; project-corrected a* = 500(fx\u2212fy) (design \u00a77)' }
		]
	},
	palette: {
		title: 'Exported palette',
		summary:
			'The final generated colors exactly as exported (post gamut-map) \u2014 the 1-D ramp, or the 2-D grid when the Expand stage is active. CVD preview and out-of-gamut affordance match the viewport.',
		sources: [
			{ label: 'theme.ts buildRamp / buildExpand' },
			{ label: 'Export tokens (CSS / DTCG)' }
		]
	}
};

export const PIPELINE_HELP: Record<PipelineHelpId, PanelHelpContent> = {
	pipelineGamut: {
		title: 'Gamut / encoding',
		summary: "The active gamut's RGB primary set and transfer assumptions decode the cube's encoded RGB values into linear-light RGB. (Choose the active gamut in Color Context, at the top of the sidebar.)",
		stageRows: stageRows(
			'Encoded RGB cube coordinates.',
			'RGB primaries, RGB-to-XYZ matrices, and the transfer curve summary used by the explorer pipeline.',
			'Linear RGB and XYZ basis for downstream world-space conversion.',
			'Ramp-only gamut mapping, CVD preview severity, camera, or display-aid visibility.'
		),
		details: [
			'Non-D65 gamuts (NTSC = Illuminant C, CIE 1931 RGB = Illuminant E) are adapted to the D65 interchange white with a Bradford chromatic adaptation before any Lab/Oklab world-space layout, so their neutral axis stays achromatic. D65 gamuts (sRGB, P3, Rec.2020, …) pass through unchanged. CPU, WebGL, and picking share the adapted matrices.',
			'The Observer model selected here (color-matching functions) drives the WebGL solid, CVD simulation, the Cones panel, and the CIE chromaticity diagrams — the rgb↔lms matrices are re-derived at runtime. The MacLeod–Boynton diagram is intentionally pinned to a fixed 2° basis and does not follow the selector.'
		],
		sources: [
			{ label: 'pipeline.ts gamut registry' },
			{ label: 'adapt.ts Bradford adaptation' },
			{ label: 'transfer.ts transfer curves' },
			{ label: 'Single-source pipeline design (design.md)' }
		]
	},
	pipelineWorld: {
		title: 'World space',
		summary: 'Chooses how colorimetric data is placed in the 3D viewport.',
		stageRows: stageRows(
			'Linear RGB converted through the active gamut matrices.',
			'Geometric position of colors in RGB, XYZ, CIELAB, Oklab, or luminance layout.',
			'World coordinates used by the renderer, picking, clipping, and ramp anchor placement.',
			'Source color values, exported ramp tokens, or display simulation.'
		),
		sources: [
			{ label: 'registry.ts space registry' },
			{ label: 'theme.ts jsToWorld' },
			{ label: 'Oklab and CIELAB references' }
		]
	},
	pipelineClip: {
		title: 'Clip / cut',
		summary: 'Controls which part of the already-positioned color solid is visible.',
		stageRows: stageRows(
			'World-space solid geometry.',
			'Slice plane, cut direction, slab width, cylindrical/chroma radius, and the cut outlines/grid that annotate the result.',
			'Visible subset of the solid plus pickable clipped surfaces.',
			'Stored colors, ramp stops, or export output.'
		),
		sources: [
			{ label: 'Slice mathematics (design.md)' },
			{ label: 'plane.ts' },
			{ label: 'WebGL solid shader clipping uniforms' }
		]
	},
	pipelineVision: {
		title: 'Vision preview',
		summary: 'Applies LMS-stage color-vision-deficiency simulation to visual previews.',
		stageRows: stageRows(
			'Display-bound linear sRGB colors.',
			'Preview colors according to protan, deutan, or tritan deficiency severity.',
			'Simulated colors in viewport, inspector panels, and ramp previews.',
			'Source RGB values, saved anchors, generated ramp stops, or exported tokens.'
		),
		sources: [
			{ label: 'cvd.ts' },
			{ label: 'LMS/cone fundamentals implementation' },
			{ label: 'CVD simulation notes (design.md)' }
		]
	},
	pipelineTessellation: {
		title: 'Tessellation',
		summary: 'Mesh resolution of the solid — and the accuracy of the clipped cross-section.',
		stageRows: stageRows(
			'The world-space solid before clipping.',
			'Subdivisions per cube face (N), and the surface grid overlay that visualizes them.',
			'A denser/sparser mesh; higher N sharpens slice/cut edges in the vertex shader.',
			'Color values, ramp generation, or export. Auto-reduce is a separate footer policy.'
		),
		sources: [
			{ label: 'Instanced rendering (design.md): one quad x 6 N^2' },
			{ label: 'solid.vert clip/flatten loop' }
		]
	},
	pipelineSources: {
		title: 'Source colors',
		summary: 'Pick and edit the ordered source colors for the active source list.',
		stageRows: stageRows(
			'Pick hits on the solid or clipped surface (+ Pick on solid, A + click, drag) or use the color picker.',
			'The source lists: add/remove lists, then add, select, drag, reorder, duplicate, delete points in the active list. Every point shapes its list’s ramp.',
			'Linear-sRGB source points feeding interpolation.',
			'Interpolation method, adjustment policy, gamut mapping, or export format.'
		),
		sources: [
			{ label: 'Viewport.svelte picking + drag handlers' },
			{ label: 'theme.ts points representation' }
		]
	},
	pipelineRampBuilder: {
		title: 'Ramp Builder',
		summary:
			'Owns the active source-list pipeline: source colors, interpolation, placement, and expansion. These settings belong to the selected list, while Gamut map and Export remain shared terminal steps.',
		stageRows: stageRows(
			'The selected source list and its source colors.',
			'List-scoped settings: source points, interpolation path, stop placement, and optional expansion into a palette. Adding a new list clones the active list’s pipeline; Apply pipeline to all copies the full active pipeline to every list.',
			'One ramp or expanded palette from the selected list; with multiple lists, each list runs through its own builder settings before the shared terminal Gamut map.',
			'The Explorer solid, camera, CVD preview, shared terminal gamut-map policy, or export format.'
		),
		details: [
			'Use 1.1-1.4 when changing how one list becomes ramp stops or palette cells. Use step 2 Gamut map when changing the shared output-gamut policy that runs after all lists have generated their colors.',
			'The list manager is deliberately above 1.1 because selecting, adding, removing, or syncing lists chooses which per-list pipeline the substeps edit.'
		],
		sources: [
			{ label: 'per-list-pipeline-plan.md' },
			{ label: 'theme.ts buildRamp / buildExpand' }
		]
	},
	pipelineInterpolate: {
		title: 'Interpolate',
		summary: 'Builds the continuous ramp path from the source points. Surface constraints happen here, before stops are placed or gamut-mapped.',
		stageRows: stageRows(
			'The ordered source points.',
			'Path type (linear/spline), interpolation space (incl. World), long-hue direction, curve constraint, projection method, focus lightness, and adaptive alpha. Surface constraints project the path onto the active clipped surface, not the full gamut shell.',
			'A hi-res curve in the chosen space, shaped by any active constraint, before placement and final gamut mapping.',
			'Stop sampling, final export serialization, or CVD preview. Curve constraints shape the path; the later Gamut Map stage controls exported out-of-gamut stops.'
		),
		details: [
			'Use this stage when the trajectory itself should follow the visible clipped surface. Use Gamut Map when the trajectory is acceptable but the final generated colors need to be reconciled with the export gamut.'
		],
		sources: [
			{ label: 'theme.ts interpolateRamp' },
			{ label: 'interp.ts interpolation spaces' },
			{ label: 'ramp-pipeline-plan.md' }
		]
	},
	pipelineAdjust: {
		title: 'Place',
		summary: 'Declarative sampling — where the N stops land on the already-built interpolated curve.',
		stageRows: stageRows(
			'The hi-res interpolated curve.',
			'Sampling policy: even ΔE, uniform parameter, lightness tones, or contrast ladder (vs white/black).',
			'The placed ramp stops, before final gamut mapping.',
			'Source points, interpolation path shape, surface constraints, or viewport color solid.'
		),
		sources: [
			{ label: 'theme.ts placeStops' },
			{ label: 'WCAG contrast references' },
			{ label: 'Oklab references' }
		]
	},
	pipelineExpand: {
		title: 'Expand',
		summary:
			'Spread generator that turns the 1-D ramp into a 2-D palette along two axes — related ramps (rows) and per-stop variants (columns).',
		stageRows: stageRows(
			'The placed 1-D ramp stops.',
			'Two axes — rows (related ramps) and columns (per-stop variants) — each offsetting hue, chroma, and/or lightness by a delta with a direction mode (ramp, sym, edges). Row and column counts are set per axis.',
			'A 2-D palette (rows × columns), exported as a CSS grid or nested DTCG groups.',
			'Interpolation path, placement policy, or the viewport color solid.'
		),
		sources: [{ label: 'theme.ts buildExpand' }, { label: 'ramp-pipeline-plan.md (Stage 3)' }]
	},
	pipelineGamutMap: {
		title: 'Gamut map',
		summary: 'Applies the terminal ramp-only policy for generated stops after interpolation, placement, and expansion. The output target is the active colorspace — currently sRGB by default.',
		stageRows: stageRows(
			'Generated ramp or palette stops, possibly outside the active colorspace.',
			'Clipping or Oklab projection method used to bring those stops into the active colorspace. Focus-based methods expose focus lightness; adaptive methods also expose alpha. This is a terminal correction, not a curve constraint.',
			'Final in-gamut ramp colors for preview, palette display, and export.',
			'The 3D explorer solid, hover readouts, CVD simulation, source anchors, or the upstream curve path.'
		),
		details: [
			'This stage is deliberately separate from Interpolate. Surface projection answers "where should the path run?"; Gamut map answers "what should exported/generated colors become if they are outside the active colorspace?"',
			'The Explorer Gamut setting controls the 3D solid being studied. The Gamut map target is the active colorspace; sRGB is the current default because the analytic mapper is sRGB-specific. Support for other active-gamut targets is planned.'
		],
		sources: [
			{ label: 'gamut-map.ts' },
			{ label: 'theme.ts finalizeRamp' },
			{ label: 'Bjorn Ottosson, sRGB gamut clipping', href: 'https://bottosson.github.io/posts/gamutclipping/' }
		]
	},
	pipelineExport: {
		title: 'Export',
		summary: 'Serializes final ramp colors after interpolation, placement, and gamut mapping to the active colorspace.',
		stageRows: stageRows(
			'Final ramp stops.',
			'Export action and output text format.',
			'CSS OKLCH tokens or DTCG JSON.',
			'Ramp source points, viewport display, or upstream pipeline settings.'
		),
		sources: [
			{ label: 'theme.ts exportTokens' },
			{ label: 'theme.ts exportDTCG' }
		]
	},
	pipelineView: {
		title: 'View / camera',
		summary: 'Camera projection, floor grid, and viewport navigation — the view of the model, not the model.',
		stageRows: stageRows(
			'Current camera and gesture state.',
			'Camera orientation, distance, field of view, target, and the floor orientation grid.',
			'A different view of the same color model.',
			'Color values, clipping parameters, ramp generation, or exports.'
		),
		sources: [
			{ label: 'Viewport.svelte camera and gesture handlers' },
			{ label: 'camera-and-canvas-gesture-plan.md' }
		]
	}
};

export const HELP_BY_ID: Record<HelpId, PanelHelpContent> = {
	...INSPECTOR_HELP,
	...PIPELINE_HELP
};
