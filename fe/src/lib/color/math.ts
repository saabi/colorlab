export type Vec3 = [number, number, number];
export type Mat3 = [number, number, number, number, number, number, number, number, number];

export const V3 = (x: number, y: number, z: number): Vec3 => [x, y, z];

export const m3 = {
	mulV: (m: Mat3, v: Vec3): Vec3 => [
		m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
		m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
		m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
	],
	mul: (a: Mat3, b: Mat3): Mat3 => {
		const r = new Array<number>(9);
		for (let i = 0; i < 3; i += 1) {
			for (let j = 0; j < 3; j += 1) {
				let s = 0;
				for (let k = 0; k < 3; k += 1) s += a[i * 3 + k] * b[k * 3 + j];
				r[i * 3 + j] = s;
			}
		}
		return r as Mat3;
	},
	inv: (m: Mat3): Mat3 => {
		const [a, b, c, d, e, f, g, h, i] = m;
		const A = e * i - f * h;
		const B = -(d * i - f * g);
		const C = d * h - e * g;
		const det = a * A + b * B + c * C;
		return [
			A / det,
			(c * h - b * i) / det,
			(b * f - c * e) / det,
			B / det,
			(a * i - c * g) / det,
			(c * d - a * f) / det,
			C / det,
			(b * g - a * h) / det,
			(a * e - b * d) / det
		];
	},
	diag: (v: Vec3): Mat3 => [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]
};

export const m3gl = (m: Mat3) =>
	new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);

export const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale3 = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: Vec3, b: Vec3): Vec3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
export const norm3 = (a: Vec3): Vec3 => {
	const l = Math.hypot(...a) || 1;
	return [a[0] / l, a[1] / l, a[2] / l];
};
