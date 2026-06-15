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
/** Upper bound for theme.steps (Interpolate / Place stop count). */
export const MAX_RAMP_STOPS = 105;
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
// the volume; surface options snap samples to a boundary before placement/export.
// Out-of-gamut handling is a separate, global policy (theme.gamutMap).
export type SplineConstraint =
	| 'free'
	| 'surface-radial'
	| 'surface-oklab-chroma'
	| 'surface-oklab-project';
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

/** A boundary constraint (main curve or extension) with its projection params. */
export interface ConstraintConfig {
	constraint: SplineConstraint;
	projection: SurfaceProjectionMethod;
	projectionParams: SurfaceProjectionParams;
}

/** Per-list ramp pipeline settings — one per source list (each list is one ramp).
 *  The terminal gamut-map is intentionally NOT here; it is a single shared step
 *  on `theme` targeting the active colorspace. */
export interface ListPipeline {
	mode: ThemeMode;
	splineSpace: InterpSpaceChoice;
	interpolateOn: boolean;
	placeOn: boolean;
	place: PlacePolicy;
	arcLong: boolean;
	contrastMin: number;
	contrastMax: number;
	wcagBg: 'white' | 'black';
	steps: number;
	/** Main curve boundary constraint (Interpolate stage). */
	main: ConstraintConfig;
	expandOn: boolean;
	expandRows: AxisSpreadConfig;
	expandCols: AxisSpreadConfig;
	/** Extension boundary constraint (Extend/Expand stage). Wiring lands in a later phase. */
	extension: ConstraintConfig;
}

/** One source ramp: its anchors plus its own pipeline. */
export interface RampList {
	anchors: ThemeAnchor[];
	pipeline: ListPipeline;
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
	N: 64 | 128 | 192 | 256 | 512;
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
	/** Slow automatic orbit of the camera (app preference in localStorage; not saved in documents). */
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
		/** Ordered source ramps (persisted). Each carries its own anchors + pipeline —
		 *  multiple lists = multiple parallel ramps. Always >= 1 list. */
		lists: RampList[];
		/** Index of the list that edits/selection/picking target (persisted; clamped on load). */
		activeList: number;
		/** Selected source-point index within the active list (runtime UI selection, not persisted). */
		selectedPoint: number | null;
		/** Out-of-gamut mapping policy — a SINGLE SHARED terminal step for all lists,
		 *  targeting the active colorspace (persisted). Not per-list. */
		gamutMap: GamutMapMethod;
		/** Advanced parameters used by adaptive gamut-map policies (persisted). */
		gamutMapParams: GamutMapParams;
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
		/** Armed click action on the solid: append a point to the active list (runtime, not persisted). */
		arm: 'add' | null;
		/** Active list's final stops — alias of rows[activeList] (runtime, not persisted). */
		stops: ThemeStop[];
		/** 3D viewport aid visibility, each toggled from its producing step (persisted, global). */
		showPoints: boolean;
		showCurve: boolean;
		showStops: boolean;
		showPalette: boolean;
		/** 2-D palette output: Expand result, or all lists' ramps when more than one (runtime, not persisted). */
		grid: ThemeStop[][];
	};
	hover: HoverHit | null;
}
import type { Vec3 } from '$lib/color/math';
import type { GamutMapMethod, GamutMapParams } from '$lib/color/gamut-map';
import type { SurfaceProjectionMethod, SurfaceProjectionParams } from '$lib/color/boundary-project';
import type { Camera } from './camera';

export const CURRENT_STATE_SCHEMA_VERSION = 13 as const;
export type StateSchemaVersion = typeof CURRENT_STATE_SCHEMA_VERSION;

export type PersistedTheme = Omit<
	ExplorerState['theme'],
	'arm' | 'stops' | 'selectedPoint' | 'splineCurve' | 'rawStops' | 'grid' | 'curves' | 'rawRows' | 'rows'
>;
// autoPerformance/minAverageFps/autoRotate are app preferences (localStorage) — not part of saved documents.
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
