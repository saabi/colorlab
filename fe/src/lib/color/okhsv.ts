// Okhsv color space + the toe / reference-lightness (Lr) helpers.
//
// Ported from Björn Ottosson's reference implementation `ok_color.h`
// (https://bottosson.github.io/misc/ok_color.h). This module operates entirely
// in LINEAR sRGB — we skip the sRGB transfer function the header applies, since
// the rest of the app works in linear light. `oklab_to_linear_srgb` /
// `linear_srgb_to_oklab` map to the existing pipeline functions.
//
// The gamut-cusp constants (compute_max_saturation, find_gamut_intersection) are
// specific to the sRGB gamut, which is correct here because theme anchors are
// stored as linear sRGB.

import { lsrgb2oklab, oklab2lsrgb } from './pipeline';
import type { Vec3 } from './math';

const K1 = 0.206;
const K2 = 0.03;
const K3 = (1 + K1) / (1 + K2);

/** Oklab L -> reference lightness Lr (closely matches CIELab L*). */
export const toe = (x: number): number =>
	0.5 * (K3 * x - K1 + Math.sqrt((K3 * x - K1) * (K3 * x - K1) + 4 * K2 * K3 * x));

/** Lr -> Oklab L. */
export const toeInv = (x: number): number => (x * x + K1 * x) / (K3 * (x + K2));

function computeMaxSaturation(a: number, b: number): number {
	let k0, k1, k2, k3, k4, wl, wm, ws;
	if (-1.88170328 * a - 0.80936493 * b > 1) {
		k0 = 1.19086277; k1 = 1.76576728; k2 = 0.59662641; k3 = 0.75515197; k4 = 0.56771245;
		wl = 4.0767416621; wm = -3.3077115913; ws = 0.2309699292;
	} else if (1.81444104 * a - 1.19445276 * b > 1) {
		k0 = 0.73956515; k1 = -0.45954404; k2 = 0.08285427; k3 = 0.1254107; k4 = 0.14503204;
		wl = -1.2684380046; wm = 2.6097574011; ws = -0.3413193965;
	} else {
		k0 = 1.35733652; k1 = -0.00915799; k2 = -1.1513021; k3 = -0.50559606; k4 = 0.00692167;
		wl = -0.0041960863; wm = -0.7034186147; ws = 1.707614701;
	}
	let S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;
	const kl = 0.3963377774 * a + 0.2158037573 * b;
	const km = -0.1055613458 * a - 0.0638541728 * b;
	const ks = -0.0894841775 * a - 1.291485548 * b;
	const l_ = 1 + S * kl;
	const m_ = 1 + S * km;
	const s_ = 1 + S * ks;
	const l = l_ * l_ * l_;
	const m = m_ * m_ * m_;
	const s = s_ * s_ * s_;
	const ldS = 3 * kl * l_ * l_;
	const mdS = 3 * km * m_ * m_;
	const sdS = 3 * ks * s_ * s_;
	const ldS2 = 6 * kl * kl * l_;
	const mdS2 = 6 * km * km * m_;
	const sdS2 = 6 * ks * ks * s_;
	const f = wl * l + wm * m + ws * s;
	const f1 = wl * ldS + wm * mdS + ws * sdS;
	const f2 = wl * ldS2 + wm * mdS2 + ws * sdS2;
	return S - (f * f1) / (f1 * f1 - 0.5 * f * f2);
}

export function findCusp(a: number, b: number): { L: number; C: number } {
	const sCusp = computeMaxSaturation(a, b);
	const rgb = oklab2lsrgb([1, sCusp * a, sCusp * b]);
	const lCusp = Math.cbrt(1 / Math.max(rgb[0], rgb[1], rgb[2]));
	return { L: lCusp, C: lCusp * sCusp };
}

// Finds intersection of the line defined by, in (L, C):
//   L = L0 * (1 - t) + t * L1
//   C = t * C1
// with the sRGB gamut boundary, for a normalized hue direction (a, b).
// Ported verbatim from ok_color.h (Newton-step refinement of the analytic
// triangle approximation). Returns the parameter t along that line.
export function findGamutIntersection(
	a: number,
	b: number,
	L1: number,
	C1: number,
	L0: number,
	cuspLC?: { L: number; C: number }
): number {
	const cusp = cuspLC ?? findCusp(a, b);
	let t: number;
	if ((L1 - L0) * cusp.C - (cusp.L - L0) * C1 <= 0) {
		t = (cusp.C * L0) / (C1 * cusp.L + cusp.C * (L0 - L1));
	} else {
		t = (cusp.C * (L0 - 1)) / (C1 * (cusp.L - 1) + cusp.C * (L0 - L1));
		const dL = L1 - L0;
		const dC = C1;
		const kl = 0.3963377774 * a + 0.2158037573 * b;
		const km = -0.1055613458 * a - 0.0638541728 * b;
		const ks = -0.0894841775 * a - 1.291485548 * b;
		const lDt = dL + dC * kl;
		const mDt = dL + dC * km;
		const sDt = dL + dC * ks;
		const L = L0 * (1 - t) + t * L1;
		const C = t * C1;
		const l_ = L + C * kl;
		const m_ = L + C * km;
		const s_ = L + C * ks;
		const l = l_ * l_ * l_;
		const m = m_ * m_ * m_;
		const s = s_ * s_ * s_;
		const ldt = 3 * lDt * l_ * l_;
		const mdt = 3 * mDt * m_ * m_;
		const sdt = 3 * sDt * s_ * s_;
		const ldt2 = 6 * lDt * lDt * l_;
		const mdt2 = 6 * mDt * mDt * m_;
		const sdt2 = 6 * sDt * sDt * s_;
		const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s - 1;
		const r1 = 4.0767416621 * ldt - 3.3077115913 * mdt + 0.2309699292 * sdt;
		const r2 = 4.0767416621 * ldt2 - 3.3077115913 * mdt2 + 0.2309699292 * sdt2;
		const uR = r1 / (r1 * r1 - 0.5 * r * r2);
		let tR = -r * uR;
		const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s - 1;
		const g1 = -1.2684380046 * ldt + 2.6097574011 * mdt - 0.3413193965 * sdt;
		const g2 = -1.2684380046 * ldt2 + 2.6097574011 * mdt2 - 0.3413193965 * sdt2;
		const uG = g1 / (g1 * g1 - 0.5 * g * g2);
		let tG = -g * uG;
		const bv = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s - 1;
		const b1 = -0.0041960863 * ldt - 0.7034186147 * mdt + 1.707614701 * sdt;
		const b2 = -0.0041960863 * ldt2 - 0.7034186147 * mdt2 + 1.707614701 * sdt2;
		const uB = b1 / (b1 * b1 - 0.5 * bv * b2);
		let tB = -bv * uB;
		tR = uR >= 0 ? tR : Number.MAX_VALUE;
		tG = uG >= 0 ? tG : Number.MAX_VALUE;
		tB = uB >= 0 ? tB : Number.MAX_VALUE;
		t += Math.min(tR, Math.min(tG, tB));
	}
	return t;
}

const toST = (cusp: { L: number; C: number }) => ({ S: cusp.C / cusp.L, T: cusp.C / (1 - cusp.L) });

function getSTMid(a_: number, b_: number): { S: number; T: number } {
	const S =
		0.11516993 +
		1 /
			(7.4477897 +
				4.1590124 * b_ +
				a_ *
					(-2.19557347 +
						1.75198401 * b_ +
						a_ * (-2.13704948 - 10.02301043 * b_ + a_ * (-4.24894561 + 5.38770819 * b_ + 4.69891013 * a_))));
	const T =
		0.11239642 +
		1 /
			(1.6132032 -
				0.68124379 * b_ +
				a_ *
					(0.40370612 +
						0.90148123 * b_ +
						a_ * (-0.27087943 + 0.6122399 * b_ + a_ * (0.00299215 - 0.45399568 * b_ - 0.14661872 * a_))));
	return { S, T };
}

function getCs(L: number, a_: number, b_: number): { C0: number; Cmid: number; Cmax: number } {
	if (L <= 0 || L >= 1) return { C0: 0, Cmid: 0, Cmax: 0 };
	const cusp = findCusp(a_, b_);
	const Cmax = findGamutIntersection(a_, b_, L, 1, L, cusp);
	const { S: Smax, T: Tmax } = toST(cusp);
	const { S: Smid, T: Tmid } = getSTMid(a_, b_);
	const k = Cmax / Math.min(L * Smax, (1 - L) * Tmax);
	const CaMid = L * Smid;
	const CbMid = (1 - L) * Tmid;
	const Cmid = 0.9 * k * Math.pow(1 / (1 / (CaMid ** 4) + 1 / (CbMid ** 4)), 0.25);
	const Ca0 = L * 0.4;
	const Cb0 = (1 - L) * 0.8;
	const C0 = Math.sqrt(1 / (1 / (Ca0 * Ca0) + 1 / (Cb0 * Cb0)));
	return { C0, Cmid, Cmax };
}

/** Okhsv (h in turns 0..1, s, v in 0..1) -> linear sRGB. */
export function okhsvToLsrgb(h: number, s: number, v: number): Vec3 {
	const a_ = Math.cos(2 * Math.PI * h);
	const b_ = Math.sin(2 * Math.PI * h);
	const { S: Smax, T: Tmax } = toST(findCusp(a_, b_));
	const S0 = 0.5;
	const k = 1 - S0 / Smax;
	const Lv = 1 - (s * S0) / (S0 + Tmax - Tmax * k * s);
	const Cv = (s * Tmax * S0) / (S0 + Tmax - Tmax * k * s);
	let L = v * Lv;
	let C = v * Cv;
	const Lvt = toeInv(Lv);
	const Cvt = (Cv * Lvt) / Lv;
	const Lnew = toeInv(L);
	C = L > 0 ? (C * Lnew) / L : 0;
	L = Lnew;
	const rgbScale = oklab2lsrgb([Lvt, a_ * Cvt, b_ * Cvt]);
	const scaleL = Math.cbrt(1 / Math.max(rgbScale[0], rgbScale[1], rgbScale[2], 0));
	L *= scaleL;
	C *= scaleL;
	return oklab2lsrgb([L, C * a_, C * b_]);
}

/** linear sRGB -> Okhsv (h in turns 0..1, s, v in 0..1). */
export function lsrgbToOkhsv(rgb: Vec3): Vec3 {
	const lab = lsrgb2oklab(rgb);
	let C = Math.hypot(lab[1], lab[2]);
	const a_ = C > 1e-9 ? lab[1] / C : 1;
	const b_ = C > 1e-9 ? lab[2] / C : 0;
	let L = lab[0];
	const h = 0.5 + (0.5 * Math.atan2(-lab[2], -lab[1])) / Math.PI;
	const { S: Smax, T: Tmax } = toST(findCusp(a_, b_));
	const S0 = 0.5;
	const k = 1 - S0 / Smax;
	const t = Tmax / (C + L * Tmax);
	const Lv = t * L;
	const Cv = t * C;
	const Lvt = toeInv(Lv);
	const Cvt = Lv > 0 ? (Cv * Lvt) / Lv : 0;
	const rgbScale = oklab2lsrgb([Lvt, a_ * Cvt, b_ * Cvt]);
	const scaleL = Math.cbrt(1 / Math.max(rgbScale[0], rgbScale[1], rgbScale[2], 0));
	L /= scaleL;
	C /= scaleL;
	C = L > 0 ? (C * toe(L)) / L : 0;
	L = toe(L);
	const v = Lv > 0 ? L / Lv : 0;
	const sOut = (S0 + Tmax) * Cv / (Tmax * S0 + Tmax * k * Cv);
	return [h, sOut, v];
}

/** Okhsl (h in turns 0..1, s/l in 0..1) -> linear sRGB. */
export function okhslToLsrgb(h: number, s: number, l: number): Vec3 {
	if (l >= 1) return [1, 1, 1];
	if (l <= 0) return [0, 0, 0];
	const a_ = Math.cos(2 * Math.PI * h);
	const b_ = Math.sin(2 * Math.PI * h);
	const L = toeInv(l);
	const { C0, Cmid, Cmax } = getCs(L, a_, b_);
	let C = 0;
	if (s < 0.8) {
		const t = 1.25 * s;
		const k0 = 0;
		const k1 = 0.8 * C0;
		const k2 = 1 - k1 / Cmid;
		C = k0 + (t * k1) / (1 - k2 * t);
	} else {
		const t = 5 * (s - 0.8);
		const k0 = Cmid;
		const k1 = (0.2 * Cmid * Cmid * 1.25 * 1.25) / C0;
		const k2 = 1 - k1 / (Cmax - Cmid);
		C = k0 + (t * k1) / (1 - k2 * t);
	}
	return oklab2lsrgb([L, C * a_, C * b_]);
}

/** linear sRGB -> Okhsl (h in turns 0..1, s/l in 0..1). */
export function lsrgbToOkhsl(rgb: Vec3): Vec3 {
	const lab = lsrgb2oklab(rgb);
	const C = Math.hypot(lab[1], lab[2]);
	if (C < 1e-9) return [0, 0, toe(lab[0])];
	const a_ = lab[1] / C;
	const b_ = lab[2] / C;
	const h = 0.5 + (0.5 * Math.atan2(-lab[2], -lab[1])) / Math.PI;
	const { C0, Cmid, Cmax } = getCs(lab[0], a_, b_);
	let s = 0;
	if (C < Cmid) {
		const k0 = 0;
		const k1 = 0.8 * C0;
		const k2 = 1 - k1 / Cmid;
		const t = (C - k0) / (k1 + k2 * (C - k0));
		s = t * 0.8;
	} else {
		const k0 = Cmid;
		const k1 = (0.2 * Cmid * Cmid * 1.25 * 1.25) / C0;
		const k2 = 1 - k1 / (Cmax - Cmid);
		const t = (C - k0) / (k1 + k2 * (C - k0));
		s = 0.8 + 0.2 * t;
	}
	return [h, s, toe(lab[0])];
}
