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
import { lsrgbToOkhsl, lsrgbToOkhsv, okhslToLsrgb, okhsvToLsrgb, toe, toeInv } from './okhsv';
import { TRC } from './transfer';

export type InterpSpaceKey =
	| 'hsv'
	| 'hsl'
	| 'oklab'
	| 'oklch'
	| 'oklrch'
	| 'okhsv'
	| 'okhsl'
	| 'cielab'
	| 'cielch'
	| 'cieluv'
	| 'cielchuv'
	| 'srgb-linear';

export interface InterpSpace {
	label: string;
	channels: [InterpChannel, InterpChannel, InterpChannel];
	/** linear sRGB -> interpolation coordinates */
	fromSrgbLin(srgbLin: Vec3): Vec3;
	/** interpolation coordinates -> linear sRGB */
	toSrgbLin(coords: Vec3): Vec3;
	/** index of a coordinate that is a hue angle in degrees (interpolated cyclically), else null */
	cyclic: 0 | 1 | 2 | null;
}

export interface InterpChannel {
	name: string;
	min: number;
	max: number;
}

const XYZ2SRGB = m3.inv(SRGB2XYZ);

const DEG = 180 / Math.PI;
// cartesian (a,b) -> cylindrical (C, h°)
const toLCh = (l: number, a: number, b: number): Vec3 => [l, Math.hypot(a, b), ((Math.atan2(b, a) * DEG) % 360 + 360) % 360];
// cylindrical (L, C, h°) -> cartesian (L, a, b)
const fromLCh = (l: number, c: number, h: number): Vec3 => [l, c * Math.cos(h / DEG), c * Math.sin(h / DEG)];
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const hue360 = (h: number) => (((h % 360) + 360) % 360) / 360;
const linToEnc = (s: Vec3): Vec3 => s.map((v) => TRC.srgb.enc(clamp01(v))) as Vec3;
const encToLin = (s: Vec3): Vec3 => s.map((v) => TRC.srgb.dec(clamp01(v))) as Vec3;

function encToHsv(rgb: Vec3): Vec3 {
	const [r, g, b] = rgb;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;
	let h = 0;
	const s = max === 0 ? 0 : d / max;
	if (d !== 0) {
		if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
		h *= 60;
	}
	return [h, s, max];
}

function hsvToEnc(h: number, s: number, v: number): Vec3 {
	const hue = hue360(h) * 6;
	const i = Math.floor(hue);
	const f = hue - i;
	const p = v * (1 - s);
	const q = v * (1 - f * s);
	const t = v * (1 - (1 - f) * s);
	switch (i % 6) {
		case 0: return [v, t, p];
		case 1: return [q, v, p];
		case 2: return [p, v, t];
		case 3: return [p, q, v];
		case 4: return [t, p, v];
		default: return [v, p, q];
	}
}

function encToHsl(rgb: Vec3): Vec3 {
	const [r, g, b] = rgb;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	const d = max - min;
	let h = 0;
	let s = 0;
	if (d !== 0) {
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
		h *= 60;
	}
	return [h, s, l];
}

function hslToEnc(h: number, s: number, l: number): Vec3 {
	if (s === 0) return [l, l, l];
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const hueToRgb = (t0: number) => {
		let t = t0;
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};
	const hue = hue360(h);
	return [hueToRgb(hue + 1 / 3), hueToRgb(hue), hueToRgb(hue - 1 / 3)];
}

export const INTERP_SPACES: Record<InterpSpaceKey, InterpSpace> = {
	hsv: {
		label: 'HSV',
		channels: [{ name: 'H', min: 0, max: 360 }, { name: 'S', min: 0, max: 1 }, { name: 'V', min: 0, max: 1 }],
		fromSrgbLin: (s) => encToHsv(linToEnc(s)),
		toSrgbLin: (c) => encToLin(hsvToEnc(c[0], c[1], c[2])),
		cyclic: 0
	},
	hsl: {
		label: 'HSL',
		channels: [{ name: 'H', min: 0, max: 360 }, { name: 'S', min: 0, max: 1 }, { name: 'L', min: 0, max: 1 }],
		fromSrgbLin: (s) => encToHsl(linToEnc(s)),
		toSrgbLin: (c) => encToLin(hslToEnc(c[0], c[1], c[2])),
		cyclic: 0
	},
	oklab: {
		label: 'Oklab',
		channels: [{ name: 'L', min: 0, max: 1 }, { name: 'a', min: -0.5, max: 0.5 }, { name: 'b', min: -0.5, max: 0.5 }],
		fromSrgbLin: (s) => lsrgb2oklab(s),
		toSrgbLin: (c) => oklab2lsrgb(c),
		cyclic: null
	},
	oklch: {
		label: 'OKLCH',
		channels: [{ name: 'L', min: 0, max: 1 }, { name: 'C', min: 0, max: 0.4 }, { name: 'h', min: 0, max: 360 }],
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
		channels: [{ name: 'Lr', min: 0, max: 1 }, { name: 'C', min: 0, max: 0.4 }, { name: 'h', min: 0, max: 360 }],
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
		channels: [{ name: 'H', min: 0, max: 360 }, { name: 'S', min: 0, max: 1 }, { name: 'V', min: 0, max: 1 }],
		fromSrgbLin: (s) => {
			const hsv = lsrgbToOkhsv(s);
			return [hsv[0] * 360, hsv[1], hsv[2]];
		},
		toSrgbLin: (c) => okhsvToLsrgb((((c[0] % 360) + 360) % 360) / 360, c[1], c[2]),
		cyclic: 0
	},
	okhsl: {
		label: 'OKHSL',
		channels: [{ name: 'H', min: 0, max: 360 }, { name: 'S', min: 0, max: 1 }, { name: 'L', min: 0, max: 1 }],
		fromSrgbLin: (s) => {
			const hsl = lsrgbToOkhsl(s);
			return [hsl[0] * 360, hsl[1], hsl[2]];
		},
		toSrgbLin: (c) => okhslToLsrgb(hue360(c[0]), c[1], c[2]),
		cyclic: 0
	},
	cielab: {
		label: 'CIELAB',
		channels: [{ name: 'L*', min: 0, max: 100 }, { name: 'a*', min: -128, max: 128 }, { name: 'b*', min: -128, max: 128 }],
		fromSrgbLin: (s) => xyz2lab(m3.mulV(SRGB2XYZ, s)),
		toSrgbLin: (c) => m3.mulV(XYZ2SRGB, lab2xyz(c)),
		cyclic: null
	},
	cielch: {
		label: 'CIELCh',
		channels: [{ name: 'L*', min: 0, max: 100 }, { name: 'C*', min: 0, max: 150 }, { name: 'h', min: 0, max: 360 }],
		fromSrgbLin: (s) => {
			const l = xyz2lab(m3.mulV(SRGB2XYZ, s));
			return toLCh(l[0], l[1], l[2]);
		},
		toSrgbLin: (c) => m3.mulV(XYZ2SRGB, lab2xyz(fromLCh(c[0], c[1], c[2]))),
		cyclic: 2
	},
	cieluv: {
		label: 'CIELUV',
		channels: [{ name: 'L*', min: 0, max: 100 }, { name: 'u*', min: -160, max: 160 }, { name: 'v*', min: -160, max: 160 }],
		fromSrgbLin: (s) => xyz2luv(m3.mulV(SRGB2XYZ, s)),
		toSrgbLin: (c) => m3.mulV(XYZ2SRGB, luv2xyz(c)),
		cyclic: null
	},
	cielchuv: {
		label: 'CIELCh(uv)',
		channels: [{ name: 'L*', min: 0, max: 100 }, { name: 'C*uv', min: 0, max: 180 }, { name: 'h', min: 0, max: 360 }],
		fromSrgbLin: (s) => {
			const l = xyz2luv(m3.mulV(SRGB2XYZ, s));
			return toLCh(l[0], l[1], l[2]);
		},
		toSrgbLin: (c) => m3.mulV(XYZ2SRGB, luv2xyz(fromLCh(c[0], c[1], c[2]))),
		cyclic: 2
	},
	'srgb-linear': {
		label: 'Linear sRGB',
		channels: [{ name: 'R', min: 0, max: 1 }, { name: 'G', min: 0, max: 1 }, { name: 'B', min: 0, max: 1 }],
		fromSrgbLin: (s) => s,
		toSrgbLin: (c) => c,
		cyclic: null
	}
};

export const INTERP_SPACE_KEYS = Object.keys(INTERP_SPACES) as InterpSpaceKey[];
