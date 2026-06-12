export type SpaceMode = 0 | 1 | 2 | 3 | 5;
export type PlaneMode = 'L' | 'H' | 'C';
export type GamutKey = 'srgb' | 'p3' | 'rec2020' | 'ntsc' | 'ebu' | 'smptec' | 'cie';
export type ShellKey = 'none' | 'srgb' | 'p3' | 'rec2020' | 'ntsc' | 'cie';
export type ChromaticityOverlayKey = 'off' | 'spectral-locus' | 'spectral-surface';
export type CvdMode = 'none' | 'protan' | 'deutan' | 'tritan';
// Interpolation path type (linear/spline) plus the spread generator. Segment and
// Hue arc are just `linear` in a cartesian vs cylindrical space. (Spread is no
// longer a mode — it is an Expand operator; see ExpandPolicy.)
export type ThemeMode = 'linear' | 'spline';
// Interpolation space: any color space in the interp registry, plus "world" — the
// active 3D world geometry as shown (a straight line in the viewport).
export type InterpSpaceChoice = import('$lib/color/interp').InterpSpaceKey | 'world';
// Place stage: where the N stops land on the interpolated curve.
export type PlacePolicy = 'even' | 'uniform' | 'tones' | 'contrast';
// Expand stage (generalized Spread): offsets in Oklch per axis across columns.
//   ramp:  delta·t           (0 -> delta; sign of delta = direction)
//   sym:   delta·(2t-1)      (-delta -> +delta, centered)
//   edges: delta·|2t-1|      (0 at center, delta at both edges; legacy 'mirror')
export type SpreadDir = 'off' | 'ramp' | 'sym' | 'edges';
export interface SpreadAxis {
	delta: number;
	dir: SpreadDir;
}
/** One Spread generator: `count` instances varied along hue/chroma/lightness. */
export interface AxisSpreadConfig {
	count: number;
	hue: SpreadAxis;
	chroma: SpreadAxis;
	light: SpreadAxis;
}
// Spline curve geometry constraint (not a gamut map): 'free' interpolates inside
// the volume; 'surface' radially snaps samples to the active solid shell.
// Out-of-gamut handling is a separate, global policy (theme.gamutMap).
export type SplineConstraint = 'free' | 'surface';
export type MinAverageFps = 15 | 30 | 60;
/** Where a persisted example guide note is rendered in the UI. */
export type GuideNotePlacement = 'sidebar' | 'overlay';

/** One sample of the rendered spline curve: world position + linear-sRGB color. */
export interface SplineSample {
	world: Vec3;
	srgbLin: Vec3;
}

export interface ThemeAnchor {
	srgbLin: [number, number, number];
}

export interface ThemeStop {
	world: Vec3;
	srgbLin: Vec3;
	hex: string;
	inG: boolean;
	cw: number;
	cb: number;
	oklch: Vec3;
}

export interface TransformChain {
	enc: Vec3;
	rgbLin: Vec3;
	xyz: Vec3;
	lms: Vec3;
	lab: Vec3;
	ok: Vec3;
	oklch: Vec3;
	srgbLin: Vec3;
	cvdLin: Vec3;
}

export interface HoverHit {
	world: Vec3;
	rgbLin: Vec3;
	inGamut: boolean;
	chain: TransformChain;
}

export interface ExplorerState {
	spaceMode: SpaceMode;
	gamut: GamutKey;
	N: 64 | 128 | 192 | 256;
	autoPerformance: boolean;
	minAverageFps: MinAverageFps;
	slice: boolean;
	planeMode: PlaneMode;
	off: number;
	az: number;
	el: number;
	eps: number;
	floor: boolean;
	lines: boolean;
	cutAbove: boolean;
	cutBelow: boolean;
	cylSlice: boolean;
	cylRad: number;
	shell: ShellKey;
	chromaticityOverlay: ChromaticityOverlayKey;
	planeOutline: boolean;
	cylinderOutline: boolean;
	outlineDepthTest: boolean;
	surfaceGridAlpha: number;
	/** Opacity of the color solid (1 = opaque); < 1 reveals ramp markers/curves behind it. */
	solidAlpha: number;
	/** Master toggle hiding viewport overlays (surface grid, outlines, shell, ramp markers) without losing each setting. Floor is separate. */
	hideAids: boolean;
	/** Slow automatic orbit of the camera (runtime-only; not persisted). */
	autoRotate: boolean;
	/** Pin the exported palette as an overlay on the 3D viewport (desktop). */
	pinPalette: boolean;
	/** Pipeline step ids currently expanded in the left sidebar (persisted UI state). */
	openSteps: string[];
	/** Optional teaching note for examples (persisted). Null hides the guide UI. */
	guideNote: string | null;
	/** Where guideNote is shown when not dismissed (persisted). */
	guideNotePlacement: GuideNotePlacement;
	/** Whether the user closed the guide note (persisted). */
	guideNoteDismissed: boolean;
	cvd: CvdMode;
	cvdSev: number;
	theme: {
		/** Ordered source-color lists (persisted). Each list is one ramp's anchors —
		 *  multiple lists = multiple parallel ramps (e.g. several splines). Always >= 1 list. */
		lists: ThemeAnchor[][];
		/** Index of the list that edits/selection/picking target (persisted; clamped on load). */
		activeList: number;
		/** Selected source-point index within the active list (runtime UI selection, not persisted). */
		selectedPoint: number | null;
		/** Spline curve geometry constraint: free vs radial shell snap (persisted). */
		splineConstraint: SplineConstraint;
		/** Color space the ramp is interpolated in — any interp space or "world" (persisted). */
		splineSpace: InterpSpaceChoice;
		/** Out-of-gamut mapping policy applied to all ramp stops + spline curve (persisted). */
		gamutMap: GamutMapMethod;
		/** Per-list hi-res curve samples (runtime, not persisted). */
		curves: SplineSample[][];
		/** Per-list stops before the terminal gamut-map stage (runtime, not persisted). */
		rawRows: ThemeStop[][];
		/** Per-list final stops after gamut mapping (runtime, not persisted). */
		rows: ThemeStop[][];
		/** Active list's hi-res curve — alias of curves[activeList] (runtime, not persisted). */
		splineCurve: SplineSample[];
		/** Active list's pre-map stops — alias of rawRows[activeList] (runtime, not persisted). */
		rawStops: ThemeStop[];
		steps: number;
		/** Armed click action on the solid: append a point to the active list (runtime, not persisted). */
		arm: 'add' | null;
		/** Interpolate stage enabled (persisted). Off = source anchors pass through as stops. */
		interpolateOn: boolean;
		/** Place stage enabled (persisted). Off = stops are the exact picked colors. */
		placeOn: boolean;
		mode: ThemeMode;
		/** Active list's final stops — alias of rows[activeList] (runtime, not persisted). */
		stops: ThemeStop[];
		arcLong: boolean;
		/** Place stage: how the N stops are sampled along the interpolated curve (persisted). */
		place: PlacePolicy;
		/** Contrast-ladder target range (WCAG ratios vs the chosen background; persisted). */
		contrastMin: number;
		contrastMax: number;
		/** Expand stage enabled (persisted). Off = 1-D ramp passes through. */
		expandOn: boolean;
		/** Row generator: related ramps — offsets applied to every stop of a ramp copy (persisted). */
		expandRows: AxisSpreadConfig;
		/** Column generator: per-stop variants — offsets expand each stop into a ladder (persisted). */
		expandCols: AxisSpreadConfig;
		/** 3D viewport aid visibility, each toggled from its producing step (persisted). */
		showPoints: boolean;
		showCurve: boolean;
		showStops: boolean;
		showPalette: boolean;
		/** 2-D palette output: Expand result, or all lists' ramps when more than one (runtime, not persisted). */
		grid: ThemeStop[][];
		wcagBg: 'white' | 'black';
	};
	hover: HoverHit | null;
}
import type { Vec3 } from '$lib/color/math';
import type { GamutMapMethod } from '$lib/color/gamut-map';
import type { Camera } from './camera';

export const CURRENT_STATE_SCHEMA_VERSION = 8 as const;
export type StateSchemaVersion = typeof CURRENT_STATE_SCHEMA_VERSION;

export type PersistedTheme = Omit<
	ExplorerState['theme'],
	'arm' | 'stops' | 'selectedPoint' | 'splineCurve' | 'rawStops' | 'grid' | 'curves' | 'rawRows' | 'rows'
>;
// autoPerformance/minAverageFps/autoRotate are runtime-only renderer policy — not part of the saved artifact.
export type PersistedExplorer = Omit<
	ExplorerState,
	'hover' | 'theme' | 'autoPerformance' | 'minAverageFps' | 'autoRotate'
> & {
	theme: PersistedTheme;
};

export interface AppState {
	schemaVersion: StateSchemaVersion;
	explorer: ExplorerState;
	camera: Camera;
}

export interface PersistedAppState {
	schemaVersion: StateSchemaVersion;
	explorer: PersistedExplorer;
	camera: Camera;
}
