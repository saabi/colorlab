export type SpaceMode = 0 | 1 | 2 | 3 | 5;
export type PlaneMode = 'L' | 'H' | 'C';
export type GamutKey = 'srgb' | 'p3' | 'rec2020' | 'ntsc' | 'ebu' | 'smptec' | 'cie';
export type ShellKey = 'none' | 'p3' | 'rec2020' | 'ntsc' | 'cie';
export type CvdMode = 'none' | 'protan' | 'deutan' | 'tritan';
// Interpolation path type (linear/spline) plus the spread generator. Segment and
// Hue arc are just `linear` in a cartesian vs cylindrical space.
export type ThemeMode = 'linear' | 'spline' | 'spread';
// Interpolation space: any color space in the interp registry, plus "world" — the
// active 3D world geometry as shown (a straight line in the viewport).
export type InterpSpaceChoice = import('$lib/color/interp').InterpSpaceKey | 'world';
export type ChromaProfile = 'linear' | 'mirror';
// Spline curve geometry constraint (not a gamut map): 'free' interpolates inside
// the volume; 'surface' radially snaps samples to the active solid shell.
// Out-of-gamut handling is a separate, global policy (theme.gamutMap).
export type SplineConstraint = 'free' | 'surface';
export type MinAverageFps = 15 | 30 | 60;

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
	planeOutline: boolean;
	cylinderOutline: boolean;
	outlineDepthTest: boolean;
	surfaceGridAlpha: number;
	/** Master toggle hiding all viewport aids (floor, surface grid, outlines, shell) without losing each setting. */
	hideAids: boolean;
	/** Pipeline step ids currently expanded in the left sidebar (persisted UI state). */
	openSteps: string[];
	cvd: CvdMode;
	cvdSev: number;
	theme: {
		/** Unified ordered source colors (persisted). Segment/arc use points[0..1],
		 *  spread uses points[0], spline uses all. Replaces the old A/B + controlPoints. */
		points: ThemeAnchor[];
		/** Selected source-point index (runtime UI selection, not persisted). */
		selectedPoint: number | null;
		/** Spline curve geometry constraint: free vs radial shell snap (persisted). */
		splineConstraint: SplineConstraint;
		/** Color space the ramp is interpolated in — any interp space or "world" (persisted). */
		splineSpace: InterpSpaceChoice;
		/** Out-of-gamut mapping policy applied to all ramp stops + spline curve (persisted). */
		gamutMap: GamutMapMethod;
		/** Hi-res rendered curve samples (runtime, not persisted). */
		splineCurve: SplineSample[];
		/** Stops before the terminal gamut-map stage, for raw-vs-final preview (runtime, not persisted). */
		rawStops: ThemeStop[];
		steps: number;
		arm: 'A' | 'B' | 'add' | null;
		mode: ThemeMode;
		stops: ThemeStop[];
		dh: number;
		dc: number;
		cprof: ChromaProfile;
		arcLong: boolean;
		aa: number;
		wcagBg: 'white' | 'black';
	};
	hover: HoverHit | null;
}
import type { Vec3 } from '$lib/color/math';
import type { InterpSpaceKey } from '$lib/color/interp';
import type { GamutMapMethod } from '$lib/color/gamut-map';
import type { Camera } from './camera';

export const CURRENT_STATE_SCHEMA_VERSION = 5 as const;
export type StateSchemaVersion = typeof CURRENT_STATE_SCHEMA_VERSION;

export type PersistedTheme = Omit<ExplorerState['theme'], 'arm' | 'stops' | 'selectedPoint' | 'splineCurve' | 'rawStops'>;
// autoPerformance/minAverageFps are runtime-only renderer policy — not part of the saved artifact.
export type PersistedExplorer = Omit<ExplorerState, 'hover' | 'theme' | 'autoPerformance' | 'minAverageFps'> & {
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
