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

function findCusp(a: number, b: number): { L: number; C: number } {
	const sCusp = computeMaxSaturation(a, b);
	const rgb = oklab2lsrgb([1, sCusp * a, sCusp * b]);
	const lCusp = Math.cbrt(1 / Math.max(rgb[0], rgb[1], rgb[2]));
	return { L: lCusp, C: lCusp * sCusp };
}

const toST = (cusp: { L: number; C: number }) => ({ S: cusp.C / cusp.L, T: cusp.C / (1 - cusp.L) });

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
