// Registry of color spaces a theme spline can be interpolated in.
//
// This is independent of `spaceMode` (which only controls the 3D viewport
// geometry). Each space provides forward/inverse conversions to/from LINEAR
// sRGB plus an optional `cyclic` index marking a hue coordinate (in degrees)
// that must be interpolated as an angle.
//
// OK* definitions follow Björn Ottosson's reference implementation; see
// _docs/references.md.

import { m3, type Vec3 } from './math';
import { SRGB2XYZ, lab2xyz, lsrgb2oklab, luv2xyz, oklab2lsrgb, xyz2lab, xyz2luv } from './pipeline';
import { lsrgbToOkhsv, okhsvToLsrgb, toe, toeInv } from './okhsv';

export type InterpSpaceKey =
	| 'oklab'
	| 'oklch'
	| 'oklrch'
	| 'okhsv'
	| 'cielab'
	| 'cielch'
	| 'cieluv'
	| 'cielchuv'
	| 'srgb-linear';

export interface InterpSpace {
	label: string;
	/** linear sRGB -> interpolation coordinates */
	fromSrgbLin(srgbLin: Vec3): Vec3;
	/** interpolation coordinates -> linear sRGB */
	toSrgbLin(coords: Vec3): Vec3;
	/** index of a coordinate that is a hue angle in degrees (interpolated cyclically), else null */
	cyclic: 0 | 1 | 2 | null;
}

const XYZ2SRGB = m3.inv(SRGB2XYZ);

const DEG = 180 / Math.PI;
// cartesian (a,b) -> cylindrical (C, h°)
const toLCh = (l: number, a: number, b: number): Vec3 => [l, Math.hypot(a, b), ((Math.atan2(b, a) * DEG) % 360 + 360) % 360];
// cylindrical (L, C, h°) -> cartesian (L, a, b)
const fromLCh = (l: number, c: number, h: number): Vec3 => [l, c * Math.cos(h / DEG), c * Math.sin(h / DEG)];

export const INTERP_SPACES: Record<InterpSpaceKey, InterpSpace> = {
	oklab: {
		label: 'Oklab',
		fromSrgbLin: (s) => lsrgb2oklab(s),
		toSrgbLin: (c) => oklab2lsrgb(c),
		cyclic: null
	},
	oklch: {
		label: 'OKLCH',
		fromSrgbLin: (s) => {
			const o = lsrgb2oklab(s);
			return toLCh(o[0], o[1], o[2]);
		},
		toSrgbLin: (c) => oklab2lsrgb(fromLCh(c[0], c[1], c[2])),
		cyclic: 2
	},
	oklrch: {
		// OKLCH with L replaced by the toe-corrected reference lightness Lr.
		label: 'OKLrCH',
		fromSrgbLin: (s) => {
			const o = lsrgb2oklab(s);
			const lch = toLCh(o[0], o[1], o[2]);
			return [toe(lch[0]), lch[1], lch[2]];
		},
		toSrgbLin: (c) => oklab2lsrgb(fromLCh(toeInv(c[0]), c[1], c[2])),
		cyclic: 2
	},
	okhsv: {
		// Gamut-anchored picking space. Hue exposed in degrees for the shared
		// cyclic-unwrap logic; okhsv.ts uses turns (0..1) internally.
		label: 'OKHSV',
		fromSrgbLin: (s) => {
			const hsv = lsrgbToOkhsv(s);
			return [hsv[0] * 360, hsv[1], hsv[2]];
		},
		toSrgbLin: (c) => okhsvToLsrgb((((c[0] % 360) + 360) % 360) / 360, c[1], c[2]),
		cyclic: 0
	},
	cielab: {
		label: 'CIELAB',
		fromSrgbLin: (s) => xyz2lab(m3.mulV(SRGB2XYZ, s)),
		toSrgbLin: (c) => m3.mulV(XYZ2SRGB, lab2xyz(c)),
		cyclic: null
	},
	cielch: {
		label: 'CIELCh',
		fromSrgbLin: (s) => {
			const l = xyz2lab(m3.mulV(SRGB2XYZ, s));
			return toLCh(l[0], l[1], l[2]);
		},
		toSrgbLin: (c) => m3.mulV(XYZ2SRGB, lab2xyz(fromLCh(c[0], c[1], c[2]))),
		cyclic: 2
	},
	cieluv: {
		label: 'CIELUV',
		fromSrgbLin: (s) => xyz2luv(m3.mulV(SRGB2XYZ, s)),
		toSrgbLin: (c) => m3.mulV(XYZ2SRGB, luv2xyz(c)),
		cyclic: null
	},
	cielchuv: {
		label: 'CIELCh(uv)',
		fromSrgbLin: (s) => {
			const l = xyz2luv(m3.mulV(SRGB2XYZ, s));
			return toLCh(l[0], l[1], l[2]);
		},
		toSrgbLin: (c) => m3.mulV(XYZ2SRGB, luv2xyz(fromLCh(c[0], c[1], c[2]))),
		cyclic: 2
	},
	'srgb-linear': {
		label: 'Linear sRGB',
		fromSrgbLin: (s) => s,
		toSrgbLin: (c) => c,
		cyclic: null
	}
};

export const INTERP_SPACE_KEYS = Object.keys(INTERP_SPACES) as InterpSpaceKey[];
