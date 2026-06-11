export type InspectorPanelId = 'transfer' | 'cones' | 'xy' | 'values';
export type PipelineHelpId =
	| 'pipelineGamut'
	| 'pipelineWorld'
	| 'pipelineTessellation'
	| 'pipelineClip'
	| 'pipelineVision'
	| 'pipelinePick'
	| 'pipelinePoints'
	| 'pipelineInterpolate'
	| 'pipelineAdjust'
	| 'pipelineGamutMap'
	| 'pipelineExport'
	| 'pipelineView';
export type HelpId = InspectorPanelId | PipelineHelpId;

export interface HelpSource {
	label: string;
	href?: string;
}

export interface PanelHelpContent {
	title: string;
	summary: string;
	/** Optional extra paragraphs (e.g. pipeline scope, future work). */
	details?: string[];
	sources: HelpSource[];
}

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
		title: 'Cone fundamentals L M S',
		summary:
			'Cone sensitivity curves (L/M/S) with a CVD-aware visible-spectrum strip behind them. Bars are LMS excitations for the hovered color (integrals over the spectrum), not samples on the \u03bb-curves. Dominant-wavelength marker shown only for spectral colors.',
		sources: [
			{
				label:
					'Multi-Gaussian cone fits in pipeline.ts (ported from legacy colorspaces.glsl; shared LMS2XYZ2 basis)'
			},
			{ label: 'CVD simulation at LMS stage (Vi\u00e9not/Brettel-style projection; design \u00a714)' },
			{
				label:
					'Integral view of color (Helmholtz): general colors are three magnitudes, not points on wavelength curves'
			}
		]
	},
	xy: {
		title: 'CIE xy chromaticity',
		summary:
			'CIE 1931 xy chromaticity diagram. Spectral locus and gamut triangle come from the same cone fits as the LMS panel. Marker shows the hovered stimulus; sRGB fill is a display preview.',
		sources: [
			{ label: 'CIE 1931 colorimetry' },
			{ label: 'Spectral locus via waveToXyz / coneLMS in pipeline.ts' },
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
	}
};

export const PIPELINE_HELP: Record<PipelineHelpId, PanelHelpContent> = {
	pipelineGamut: {
		title: 'Gamut / encoding',
		summary: "Selects the RGB primary set and transfer assumptions used to decode the cube's encoded RGB values into linear-light RGB.",
		details: [
			'Input: encoded RGB cube coordinates.',
			'Changes: RGB primaries, RGB-to-XYZ matrices, and the transfer curve summary used by the explorer pipeline.',
			'Output: linear RGB and XYZ basis for downstream world-space conversion.',
			'Does not affect: ramp-only gamut mapping, CVD preview severity, camera, or display-aid visibility.'
		],
		sources: [
			{ label: 'pipeline.ts gamut registry' },
			{ label: 'transfer.ts transfer curves' },
			{ label: 'Single-source pipeline design (design.md)' }
		]
	},
	pipelineWorld: {
		title: 'World space',
		summary: 'Chooses how colorimetric data is placed in the 3D viewport.',
		details: [
			'Input: linear RGB converted through the active gamut matrices.',
			'Changes: geometric position of colors in RGB, XYZ, CIELAB, Oklab, or luminance layout.',
			'Output: world coordinates used by the renderer, picking, clipping, and ramp anchor placement.',
			'Does not affect: source color values, exported ramp tokens, or display simulation.'
		],
		sources: [
			{ label: 'registry.ts space registry' },
			{ label: 'theme.ts jsToWorld' },
			{ label: 'Oklab and CIELAB references' }
		]
	},
	pipelineClip: {
		title: 'Clip / cut',
		summary: 'Controls which part of the already-positioned color solid is visible.',
		details: [
			'Input: world-space solid geometry.',
			'Changes: slice plane, cut direction, slab width, cylindrical/chroma radius, and the cut outlines/grid that annotate the result.',
			'Output: visible subset of the solid plus pickable clipped surfaces.',
			'Does not affect: stored colors, ramp stops, or export output.'
		],
		sources: [
			{ label: 'Slice mathematics (design.md)' },
			{ label: 'plane.ts' },
			{ label: 'WebGL solid shader clipping uniforms' }
		]
	},
	pipelineVision: {
		title: 'Vision preview',
		summary: 'Applies LMS-stage color-vision-deficiency simulation to visual previews.',
		details: [
			'Input: display-bound linear sRGB colors.',
			'Changes: preview colors according to protan, deutan, or tritan deficiency severity.',
			'Output: simulated colors in viewport, inspector panels, and ramp previews.',
			'Does not affect: source RGB values, saved anchors, generated ramp stops, or exported tokens.'
		],
		sources: [
			{ label: 'cvd.ts' },
			{ label: 'LMS/cone fundamentals implementation' },
			{ label: 'CVD simulation notes (design.md)' }
		]
	},
	pipelineTessellation: {
		title: 'Tessellation',
		summary: 'Mesh resolution of the solid — and the accuracy of the clipped cross-section.',
		details: [
			'Input: the world-space solid before clipping.',
			'Changes: subdivisions per cube face (N), and the surface grid overlay that visualizes them.',
			'Output: a denser/sparser mesh; higher N sharpens slice/cut edges in the vertex shader.',
			'Does not affect: color values, ramp generation, or export. Auto-reduce is a separate footer policy.'
		],
		sources: [
			{ label: 'Instanced rendering (design.md): one quad x 6 N^2' },
			{ label: 'solid.vert clip/flatten loop' }
		]
	},
	pipelinePick: {
		title: 'Pick',
		summary: 'Selects where the next viewport click or tap writes a picked color into the ramp workflow.',
		details: [
			'Input: currently visible pick hit on the solid or clipped surface.',
			'Changes: active target, such as anchor A, anchor B, or adding a spline control point.',
			'Output: linear-sRGB source colors stored as ramp inputs.',
			'Does not affect: interpolation mode, adjustment policy, gamut mapping, or export format.'
		],
		sources: [
			{ label: 'Viewport.svelte picking handlers' },
			{ label: 'theme.ts anchor representation' }
		]
	},
	pipelinePoints: {
		title: 'Anchors / points',
		summary: 'Shows and edits the source colors used by ramp generation.',
		details: [
			'Input: picked linear-sRGB anchors and spline control points.',
			'Changes: point selection, ordering, duplication, deletion, and keyboard nudging.',
			'Output: ordered ramp source points for interpolation.',
			'Does not affect: interpolation method, WCAG/even adjustments, gamut mapping policy, or final export format.'
		],
		sources: [
			{ label: 'ThemeRamp.svelte control point panel' },
			{ label: 'Spline gesture plan' }
		]
	},
	pipelineInterpolate: {
		title: 'Interpolate',
		summary: 'Builds raw ramp samples from anchors or spline control points.',
		details: [
			'Input: anchors A/B or ordered spline control points.',
			'Changes: ramp mode, step count, hue-arc direction, spread parameters, spline interpolation space, and spline surface constraint.',
			'Output: raw ramp stops before adjustment and final gamut mapping.',
			'Does not affect: final export serialization or CVD preview; out-of-gamut colors may still exist at this stage.'
		],
		sources: [
			{ label: 'theme.ts buildRawRamp' },
			{ label: 'interp.ts interpolation spaces' },
			{ label: 'spline-surface-ramp-plan.md' }
		]
	},
	pipelineAdjust: {
		title: 'Adjust',
		summary: 'Post-processes generated ramp stops for contrast or perceptual spacing.',
		details: [
			'Input: raw interpolated ramp stops.',
			'Changes: WCAG AA fitting target and even perceptual spacing.',
			'Output: adjusted ramp stops that still pass through final gamut mapping afterward.',
			'Does not affect: source anchors/control points, interpolation mode, or viewport color solid.'
		],
		sources: [
			{ label: 'theme.ts fitWcag and fitEven' },
			{ label: 'WCAG contrast references' },
			{ label: 'Oklab references' }
		]
	},
	pipelineGamutMap: {
		title: 'Gamut map',
		summary: 'Applies the terminal ramp-only policy for out-of-gamut generated stops.',
		details: [
			'Input: adjusted ramp stops, possibly outside sRGB.',
			'Changes: clipping or Oklab projection method used to bring stops into the export gamut.',
			'Output: final in-gamut ramp colors for preview and export.',
			'Does not affect: the 3D explorer gamut, hover readouts, CVD simulation, or source anchors.'
		],
		sources: [
			{ label: 'gamut-map.ts' },
			{ label: 'theme.ts finalizeRamp' },
			{ label: 'Bjorn Ottosson, sRGB gamut clipping', href: 'https://bottosson.github.io/posts/gamutclipping/' }
		]
	},
	pipelineExport: {
		title: 'Export',
		summary: 'Serializes final ramp colors after interpolation, adjustment, and gamut mapping.',
		details: [
			'Input: final ramp stops.',
			'Changes: export action and output text format.',
			'Output: CSS OKLCH tokens or DTCG JSON.',
			'Does not affect: ramp source points, viewport display, or upstream pipeline settings.'
		],
		sources: [
			{ label: 'theme.ts exportTokens' },
			{ label: 'theme.ts exportDTCG' }
		]
	},
	pipelineView: {
		title: 'View / camera',
		summary: 'Camera projection, floor grid, and viewport navigation — the view of the model, not the model.',
		details: [
			'Input: current camera and gesture state.',
			'Changes: camera orientation, distance, field of view, target, and the floor orientation grid.',
			'Output: a different view of the same color model.',
			'Does not affect: color values, clipping parameters, ramp generation, or exports.'
		],
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
