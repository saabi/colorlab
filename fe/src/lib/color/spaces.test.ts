import { describe, expect, it } from 'vitest';

import { OK_M1, OK_M2, SRGB2XYZ, lsrgb2oklab, oklab2lsrgb, xyz2lab, xyz2luv } from './pipeline';
import { INTERP_SPACES, INTERP_SPACE_KEYS } from './interp';
import { toe, toeInv } from './okhsv';
import { m3 } from './math';
import type { Mat3, Vec3 } from './math';

// Reference values for the sRGB primaries under the D65 white point (2deg observer).
// Lab/Luv figures match Bruce Lindbloom's CIELAB/CIELUV calculators and the
// ISO/CIE 11664-4 / 11664-5 definitions; Oklab figures match Bjorn Ottosson's
// Oklab post / CSS Color 4 sample values.
const RED: Vec3 = [1, 0, 0];
const GREEN: Vec3 = [0, 1, 0];
const BLUE: Vec3 = [0, 0, 1];
const WHITE: Vec3 = [1, 1, 1];

const close = (a: Vec3, b: Vec3, tol: number, label: string) => {
	for (let k = 0; k < 3; k += 1) expect(Math.abs(a[k] - b[k]), `${label}[${k}] (${a[k]} vs ${b[k]})`).toBeLessThan(tol);
};

describe('CIELAB (ISO/CIE 11664-4), D65 via sRGB matrix', () => {
	const lab = (rgb: Vec3) => xyz2lab(SRGB2XYZ.length ? mul(SRGB2XYZ, rgb) : rgb);
	function mul(m: number[], v: Vec3): Vec3 {
		return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
	}
	it('white -> L*=100, a*=b*=0', () => close(lab(WHITE), [100, 0, 0], 0.05, 'white'));
	it('sRGB red', () => close(lab(RED), [53.2408, 80.0925, 67.2032], 0.1, 'red'));
	it('sRGB green', () => close(lab(GREEN), [87.7347, -86.1827, 83.1793], 0.1, 'green'));
	it('sRGB blue', () => close(lab(BLUE), [32.2970, 79.1875, -107.8602], 0.1, 'blue'));
});

describe('CIELUV (ISO/CIE 11664-5), D65 via sRGB matrix', () => {
	function mul(m: number[], v: Vec3): Vec3 {
		return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
	}
	const luv = (rgb: Vec3) => xyz2luv(mul(SRGB2XYZ, rgb));
	it('white -> L*=100, u*=v*=0', () => close(luv(WHITE), [100, 0, 0], 0.05, 'white'));
	it('sRGB red', () => close(luv(RED), [53.2408, 175.0151, 37.7564], 0.2, 'red'));
	it('sRGB blue', () => close(luv(BLUE), [32.2970, -9.4054, -130.3423], 0.2, 'blue'));
});

describe('Oklab / OKLCH (Ottosson, CSS Color 4)', () => {
	// Reference Oklab values for the sRGB primaries (Ottosson / CSS Color 4).
	const RED_OK: Vec3 = [0.6279554, 0.2248631, 0.1258463];
	const GREEN_OK: Vec3 = [0.8664396, -0.2338874, 0.1794985];
	const BLUE_OK: Vec3 = [0.4520137, -0.0324548, -0.311528];

	// Canonical published inverse matrices (CSS Color 4 §oklab):
	// Oklab L,a,b -> non-linear l'm's' (M2 inverse)
	const M2I_REF: Mat3 = [
		1, 0.3963377774, 0.2158037573,
		1, -0.1055613458, -0.0638541728,
		1, -0.0894841775, -1.291485548
	];
	// l,m,s -> linear sRGB (M1 inverse)
	const M1I_REF: Mat3 = [
		4.0767416621, -3.3077115913, 0.2309699292,
		-1.2684380046, 2.6097574011, -0.3413193965,
		-0.0041960863, -0.7034186147, 1.707614701
	];

	it('forward: sRGB primaries -> Oklab', () => {
		close(lsrgb2oklab(RED), RED_OK, 1e-3, 'red');
		close(lsrgb2oklab(GREEN), GREEN_OK, 1e-3, 'green');
		close(lsrgb2oklab(BLUE), BLUE_OK, 1e-3, 'blue');
		close(lsrgb2oklab(WHITE), [1, 0, 0], 1e-4, 'white');
	});

	it('inverse: Oklab -> linear sRGB primaries', () => {
		close(oklab2lsrgb(RED_OK), RED, 1e-3, 'red');
		close(oklab2lsrgb(GREEN_OK), GREEN, 1e-3, 'green');
		close(oklab2lsrgb(BLUE_OK), BLUE, 1e-3, 'blue');
		close(oklab2lsrgb([1, 0, 0]), WHITE, 1e-4, 'white');
	});

	it('the numerically-inverted matrices match the canonical published inverses', () => {
		const m2i = m3.inv(OK_M2);
		const m1i = m3.inv(OK_M1);
		for (let i = 0; i < 9; i += 1) {
			expect(Math.abs(m2i[i] - M2I_REF[i]), `M2i[${i}]`).toBeLessThan(1e-6);
			expect(Math.abs(m1i[i] - M1I_REF[i]), `M1i[${i}]`).toBeLessThan(1e-6);
		}
	});

	it('full round-trip linear sRGB -> Oklab -> linear sRGB is near-exact', () => {
		const samples: Vec3[] = [
			[0.02, 0.4, 0.9],
			[0.73, 0.11, 0.46],
			[1, 1, 1],
			[0.001, 0.5, 0.25]
		];
		for (const s of samples) close(oklab2lsrgb(lsrgb2oklab(s)), s, 1e-9, 'oklab rt');
	});

	it('sRGB red -> OKLCH (C, h) and back', () => {
		const lch = INTERP_SPACES.oklch.fromSrgbLin(RED);
		expect(Math.abs(lch[1] - 0.25768)).toBeLessThan(1e-3); // chroma
		expect(Math.abs(lch[2] - 29.234)).toBeLessThan(0.05); // hue degrees
		close(INTERP_SPACES.oklch.toSrgbLin(lch), RED, 1e-9, 'oklch rt');
	});
});

describe('Lr toe function (Ottosson colorpicker / ok_color.h)', () => {
	it('toe(0) = 0 and toe(1) = 1 (fixed endpoints)', () => {
		expect(Math.abs(toe(0))).toBeLessThan(1e-9);
		expect(Math.abs(toe(1) - 1)).toBeLessThan(1e-9);
	});
	it('toe and toeInv are mutual inverses', () => {
		for (const x of [0.05, 0.18419, 0.3, 0.5, 0.75, 0.95]) {
			expect(Math.abs(toeInv(toe(x)) - x)).toBeLessThan(1e-9);
			expect(Math.abs(toe(toeInv(x)) - x)).toBeLessThan(1e-9);
		}
	});
	it('Lr = toe(Oklab L) closely matches CIELab L*/100 for grays (Ottosson: nearly equal at 50%)', () => {
		function mul(m: number[], v: Vec3): Vec3 {
			return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
		}
		for (const g of [0.05, 0.1842, 0.3, 0.6, 0.9]) {
			const gray: Vec3 = [g, g, g];
			const lr = toe(lsrgb2oklab(gray)[0]);
			const lStar = xyz2lab(mul(SRGB2XYZ, gray))[0] / 100;
			expect(Math.abs(lr - lStar), `gray ${g}`).toBeLessThan(0.02);
		}
		// Near-exact at the L*=50 gray (g = (66/116)^3 = 0.18426).
		const midGray: Vec3 = [0.18426, 0.18426, 0.18426];
		expect(Math.abs(toe(lsrgb2oklab(midGray)[0]) - 0.5)).toBeLessThan(2e-3);
	});
});

describe('Interpolation-space registry round-trips', () => {
	it('every space inverts linear sRGB within tolerance', () => {
		const samples: Vec3[] = [
			[0.1, 0.2, 0.3],
			[0.8, 0.4, 0.05],
			[0.5, 0.5, 0.5],
			[0.02, 0.9, 0.6],
			[0.95, 0.95, 0.2]
		];
		for (const key of INTERP_SPACE_KEYS) {
			const space = INTERP_SPACES[key];
			for (const s of samples) {
				const rt = space.toSrgbLin(space.fromSrgbLin([...s] as Vec3));
				close(rt, s, 2e-3, `${key} round-trip`);
			}
		}
	});
});
