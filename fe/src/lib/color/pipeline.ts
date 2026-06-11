import { m3, type Mat3, type Vec3 } from './math';
import { TRC, type TransferCurve } from './transfer';

const ry = (a: number): Mat3 => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const rx = (a: number): Mat3 => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const cubeRaw = m3.mul(rx(-Math.atan(Math.SQRT2)), ry(-Math.PI / 4));

export const CUBE_ROT = cubeRaw.map((v) => v * (0.5 / 0.8660254)) as Mat3;
export const CUBE_ROTi = m3.inv(CUBE_ROT);
export const REC709_Y: Vec3 = [0.2126, 0.7152, 0.0722];

export interface GamutDefinition {
	label: string;
	P: Mat3;
	W: Vec3;
	trc: TransferCurve;
}

export const Primaries = (
	r1: number,
	r2: number,
	g1: number,
	g2: number,
	b1: number,
	b2: number
): Mat3 => [r1, g1, b1, r2, g2, b2, 1 - r1 - r2, 1 - g1 - g2, 1 - b1 - b2];

export const White = (x: number, y: number): Vec3 => [x / y, 1, (1 - x - y) / y];

export function rgbToXyzM(primaries: Mat3, white: Vec3): Mat3 {
	const s = m3.mulV(m3.inv(primaries), white);
	return m3.mul(primaries, m3.diag(s));
}

export const GAMUTS = {
	srgb: {
		label: 'sRGB / Rec.709',
		P: Primaries(0.64, 0.33, 0.3, 0.6, 0.15, 0.06),
		W: White(0.312713, 0.329016),
		trc: TRC.srgb
	},
	p3: {
		label: 'DCI-P3 D65',
		P: Primaries(0.68, 0.32, 0.265, 0.69, 0.15, 0.06),
		W: White(0.312713, 0.329016),
		trc: TRC.srgb
	},
	rec2020: {
		label: 'Rec.2020',
		P: Primaries(0.708, 0.292, 0.17, 0.797, 0.131, 0.046),
		W: White(0.312713, 0.329016),
		trc: TRC.srgb
	},
	ntsc: {
		label: 'NTSC 1953',
		P: Primaries(0.67, 0.33, 0.21, 0.71, 0.14, 0.08),
		W: White(0.310063, 0.316158),
		trc: TRC.g22
	},
	ebu: {
		label: 'EBU (Rec.601-625)',
		P: Primaries(0.64, 0.33, 0.29, 0.6, 0.15, 0.06),
		W: White(0.312713, 0.329016),
		trc: TRC.g22
	},
	smptec: {
		label: 'SMPTE-C',
		P: Primaries(0.63, 0.34, 0.31, 0.595, 0.155, 0.07),
		W: White(0.312713, 0.329016),
		trc: TRC.g22
	},
	cie: {
		label: 'CIE 1931 RGB',
		P: Primaries(0.72329, 0.27671, 0.28557, 0.71045, 0.15235, 0.02),
		W: White(1 / 3, 1 / 3),
		trc: TRC.lin
	}
} satisfies Record<string, GamutDefinition>;

export const D65 = White(0.312713, 0.329016);
export const labF = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
export const labFi = (t: number) => {
	const t3 = t * t * t;
	return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
};

export function xyz2lab(xyz: Vec3, w: Vec3 = D65): Vec3 {
	const fx = labF(xyz[0] / w[0]);
	const fy = labF(xyz[1] / w[1]);
	const fz = labF(xyz[2] / w[2]);
	return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function lab2xyz(lab: Vec3, w: Vec3 = D65): Vec3 {
	const fy = (lab[0] + 16) / 116;
	const fx = lab[1] / 500 + fy;
	const fz = fy - lab[2] / 200;
	return [w[0] * labFi(fx), w[1] * labFi(fy), w[2] * labFi(fz)];
}

export function xyz2luv(xyz: Vec3, w: Vec3 = D65): Vec3 {
	const denom = xyz[0] + 15 * xyz[1] + 3 * xyz[2];
	const up = denom === 0 ? 0 : (4 * xyz[0]) / denom;
	const vp = denom === 0 ? 0 : (9 * xyz[1]) / denom;
	const wd = w[0] + 15 * w[1] + 3 * w[2];
	const un = (4 * w[0]) / wd;
	const vn = (9 * w[1]) / wd;
	const L = 116 * labF(xyz[1] / w[1]) - 16;
	return [L, 13 * L * (up - un), 13 * L * (vp - vn)];
}

export function luv2xyz(luv: Vec3, w: Vec3 = D65): Vec3 {
	const L = luv[0];
	if (L <= 1e-8) return [0, 0, 0];
	const wd = w[0] + 15 * w[1] + 3 * w[2];
	const un = (4 * w[0]) / wd;
	const vn = (9 * w[1]) / wd;
	const up = luv[1] / (13 * L) + un;
	const vp = luv[2] / (13 * L) + vn;
	const Y = w[1] * labFi((L + 16) / 116);
	if (vp === 0) return [0, Y, 0];
	const X = (Y * 9 * up) / (4 * vp);
	const Z = (Y * (12 - 3 * up - 20 * vp)) / (4 * vp);
	return [X, Y, Z];
}

export const OK_M1: Mat3 = [
	0.4122214708, 0.5363325363, 0.0514459929, 0.2119034982, 0.6806995451, 0.1073969566,
	0.0883024619, 0.2817188376, 0.6299787005
];
export const OK_M2: Mat3 = [
	0.2104542553, 0.793617785, -0.0040720468, 1.9779984951, -2.428592205, 0.4505937099,
	0.0259040371, 0.7827717662, -0.808675766
];
export const OK_M1i = m3.inv(OK_M1);
export const OK_M2i = m3.inv(OK_M2);

const scbrt = (v: number) => Math.sign(v) * Math.cbrt(Math.abs(v));

export function lsrgb2oklab(rgb: Vec3): Vec3 {
	const l = m3.mulV(OK_M1, rgb).map(scbrt) as Vec3;
	return m3.mulV(OK_M2, l);
}

export function oklab2lsrgb(lab: Vec3): Vec3 {
	const l = m3.mulV(OK_M2i, lab).map((v) => v * v * v) as Vec3;
	return m3.mulV(OK_M1i, l);
}

const gauss2 = (x: number, A: number, x0: number, dx: number) => A * Math.exp(-Math.LN2 * ((x - x0) / dx) ** 2);
const dgauss = (x: number, A: number, x0: number, dx: number) =>
	((-2 * Math.LN2 * A * (x - x0)) * Math.exp((-Math.LN2 * (x - x0) ** 2) / dx ** 2)) / dx ** 2;

export function coneL(nm: number) {
	return (
		gauss2(nm, 104344.92193406945, 569.5078040786743, 54.651444860776735) +
		dgauss(nm, -156430.21591338454, 590.1108598846736, 26.58929437546323) +
		dgauss(nm, -145288.27503926188, 512.6297253843892, 19.260656047167043) +
		gauss2(nm, -7591.194203449524, 641.0781271336464, 37.920029730475456) +
		gauss2(nm, 1905.4399959767024, 434.408633321614, 17.7321868069511)
	);
}

export function coneM(nm: number) {
	return (
		gauss2(nm, 108991.4133, 547.2395, 40.8751) +
		dgauss(nm, 486896.0939, 504.2192, 42.5372) +
		dgauss(nm, -58768.3624, 508.3118, 13.5221) +
		dgauss(nm, 97877.6717, 540.9401, 19.0589)
	);
}

export function coneS(nm: number) {
	return (
		gauss2(nm, 221368.60076492612, 444.9973131221829, 12.37472521822061) +
		dgauss(nm, 2185498.6747593815, 442.0889660569674, 17.327094668813405) +
		dgauss(nm, -628537.5904831715, 463.27066341009333, 25.92687407427804) +
		dgauss(nm, -2253931.2636179845, 451.54166499032675, 15.502068959529584) +
		dgauss(nm, -7463.1094212072485, 447.91353164623615, 3.692212735536991)
	);
}

export const coneLMS = (nm: number): Vec3 => [coneL(nm) / 1e5, coneM(nm) / 1e5, coneS(nm) / 1e5];
export const LMS2XYZ2: Mat3 = [1.94735469, -1.41445123, 0.36476327, 0.68990272, 0.34832189, 0, 0, 0, 1.93485343];
export const XYZ2LMS2 = m3.inv(LMS2XYZ2);
export const waveToXyz = (nm: number) => m3.mulV(LMS2XYZ2, coneLMS(nm));
export const SRGB2XYZ = rgbToXyzM(GAMUTS.srgb.P, GAMUTS.srgb.W);
export const RGB2LMS = m3.mul(XYZ2LMS2, SRGB2XYZ);
export const LMS2RGB = m3.inv(RGB2LMS);
