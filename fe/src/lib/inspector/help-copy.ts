export type InspectorPanelId = 'transfer' | 'cones' | 'xy' | 'values';
export type SidebarGroupId = 'colorModel' | 'clipping' | 'display' | 'theme' | 'performance';
export type HelpId = InspectorPanelId | SidebarGroupId;

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

export const SIDEBAR_HELP: Record<SidebarGroupId, PanelHelpContent> = {
	colorModel: {
		title: 'Color model',
		summary:
			'Choose how the RGB cube is arranged in world space (Oklab by default) and which primaries define the solid. Changing gamut recomputes RGB\u2194XYZ from chromaticities and reshapes the volume through the same transform pipeline.',
		sources: [
			{ label: 'Space registry and gamut matrices (registry.ts, pipeline.ts GAMUTS)' },
			{ label: 'Single-source pipeline design (design.md \u00a74)' },
			{ label: 'Bj\u00f6rn Ottosson, Oklab (2020)' },
			{
				label:
					'Bujack, R. et al., The Geometry of Color in the Light of a Non-Riemannian Space, CGF 2025',
				href: 'https://doi.org/10.1111/cgf.70136'
			}
		]
	},
	clipping: {
		title: 'Clipping',
		summary:
			'Slice the solid with an arbitrary plane \u2014 lightness, hue plane, or custom azimuth/elevation \u2014 plus an optional cylindrical radial cut. The vertex shader flattens vertices onto the true cross-section boundary by inverting world\u2192RGB and re-clamping to the cube.',
		sources: [
			{ label: 'Slice mathematics (design.md \u00a75)' },
			{ label: 'Clamp/project loop in solid.vert' }
		]
	},
	display: {
		title: 'Display',
		summary:
			'Toggle the floor grid, in-shader surface grid lines, plane and cylinder cross-section outlines (with optional depth test), a wide-gamut ghost shell, and LMS-stage color-vision simulation that propagates to the solid and all readouts.',
		sources: [
			{ label: 'CVD at LMS stage (design.md \u00a714)' },
			{ label: 'Vi\u00e9not/Brettel-style dichromat projection' },
			{ label: 'Outline z-order (design.md \u00a716)' }
		]
	},
	theme: {
		title: 'Theme',
		summary:
			'Build perceptual color ramps between anchors using straight segments, cylindrical hue arcs, spread mode, or a Catmull-Rom spline through any number of control points. Spline mode interpolates in a selectable color space (Oklab, OKLCH, OKLrCH, OKHSV, CIELAB/CIELCh, CIELUV/CIELCh(uv), linear sRGB) and can surface-lock the curve to the gamut shell. Auto-adjust fits stops inside sRGB, enforces WCAG contrast, and re-samples at equal Oklab arc length.',
		details: [
			'Spline gamut handling: "Surface (radial shell)" snaps each sample radially to the active solid boundary at constant lightness (pushes chroma to the shell; assumes a star-shaped cross-section about the neutral axis). The "Clip:" options instead apply Ottosson\u2019s sRGB gamut-clipping strategies \u2014 they leave in-gamut samples untouched and project only out-of-gamut samples back to the sRGB boundary in Oklab, differing in the projection focus L0: preserve chroma (constant lightness), project toward L=0.5, project toward the hue cusp, or adaptive blends that trade a little lightness for chroma. Clip targets the sRGB gamut regardless of the displayed gamut.'
		],
		sources: [
			{ label: 'Theme heuristics (design.md \u00a715)' },
			{ label: 'theme.ts ramp and gamut-fit logic; color/interp.ts interpolation spaces; color/clip.ts gamut clipping' },
			{ label: 'Bj\u00f6rn Ottosson, Oklab (2020)' },
			{
				label: 'Bj\u00f6rn Ottosson, Okhsv/Okhsl and the Lr lightness (ok_color.h)',
				href: 'https://bottosson.github.io/posts/colorpicker/'
			},
			{
				label: 'Bj\u00f6rn Ottosson, sRGB gamut clipping (ok_color.h)',
				href: 'https://bottosson.github.io/posts/gamutclipping/'
			}
		]
	},
	performance: {
		title: 'Performance',
		summary:
			'Tessellation density N per cube face (64\u2013256). The solid is one unit quad instanced 6\u00b7N\u00b2 times \u2014 no per-cell vertex buffers, keeping memory use flat as resolution increases. Auto-adjust samples recent redraw times and only steps N downward after a sustained miss against the selected average FPS target.',
		sources: [{ label: 'Instanced rendering (design.md \u00a78)' }]
	}
};

export const HELP_BY_ID: Record<HelpId, PanelHelpContent> = {
	...INSPECTOR_HELP,
	...SIDEBAR_HELP
};
