export type SpaceMode = 0 | 1 | 2 | 3 | 5;
export type PlaneMode = 'L' | 'H' | 'C';
export type GamutKey = 'srgb' | 'p3' | 'rec2020' | 'ntsc' | 'ebu' | 'smptec' | 'cie';
export type ShellKey = 'none' | 'p3' | 'rec2020' | 'ntsc' | 'cie';
export type CvdMode = 'none' | 'protan' | 'deutan' | 'tritan';
export type ThemeMode = 'seg' | 'arc' | 'spread' | 'spline';
export type ChromaProfile = 'linear' | 'mirror';
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
	cvd: CvdMode;
	cvdSev: number;
	theme: {
		A: ThemeAnchor | null;
		B: ThemeAnchor | null;
		/** Spline control points (persisted). */
		controlPoints: ThemeAnchor[];
		/** Selected control point index (runtime UI selection, not persisted). */
		selectedCp: number | null;
		/** Whether spline samples are snapped to the gamut boundary (persisted). */
		splineConstraint: SplineConstraint;
		/** Color space the spline is interpolated in (persisted). */
		splineSpace: InterpSpaceKey;
		/** Hi-res rendered curve samples (runtime, not persisted). */
		splineCurve: SplineSample[];
		steps: number;
		arm: 'A' | 'B' | 'spline-add' | null;
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
import type { Camera } from './camera';

export const CURRENT_STATE_SCHEMA_VERSION = 2 as const;
export type StateSchemaVersion = typeof CURRENT_STATE_SCHEMA_VERSION;

export type PersistedTheme = Omit<ExplorerState['theme'], 'arm' | 'stops' | 'selectedCp' | 'splineCurve'>;
export type PersistedExplorer = Omit<ExplorerState, 'hover' | 'theme'> & { theme: PersistedTheme };

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
