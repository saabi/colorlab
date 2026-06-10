export type SpaceMode = 0 | 1 | 2 | 3 | 5;
export type PlaneMode = 'L' | 'H' | 'C';
export type GamutKey = 'srgb' | 'p3' | 'rec2020' | 'ntsc' | 'ebu' | 'smptec' | 'cie';
export type ShellKey = 'none' | 'p3' | 'rec2020' | 'ntsc' | 'cie';
export type CvdMode = 'none' | 'protan' | 'deutan' | 'tritan';
export type ThemeMode = 'seg' | 'arc' | 'spread';
export type ChromaProfile = 'linear' | 'mirror';

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
	cylInside: boolean;
	shell: ShellKey;
	outline: boolean;
	cvd: CvdMode;
	cvdSev: number;
	theme: {
		A: ThemeAnchor | null;
		B: ThemeAnchor | null;
		steps: number;
		arm: 'A' | 'B' | null;
		mode: ThemeMode;
		stops: ThemeStop[];
		dh: number;
		dc: number;
		cprof: ChromaProfile;
		aa: number;
		wcagBg: 'white' | 'black';
	};
	hover: HoverHit | null;
}
import type { Vec3 } from '$lib/color/math';
