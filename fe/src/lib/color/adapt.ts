import { m3, type Mat3, type Vec3 } from './math';

// Bradford cone-response matrix (XYZ → sharpened cone space) used for von Kries
// chromatic adaptation. The inverse is derived numerically to avoid transcription
// error.
const BRADFORD: Mat3 = [
	0.8951, 0.2664, -0.1614,
	-0.7502, 1.7135, 0.0367,
	0.0389, -0.0685, 1.0296
];
const BRADFORD_INV = m3.inv(BRADFORD);

/**
 * Bradford chromatic-adaptation matrix mapping XYZ relative to `srcWhite` into
 * XYZ relative to `dstWhite`. Returns (numerically) the identity when the two
 * whites are equal. Whites are XYZ tristimulus (Y = 1), e.g. from `White(x, y)`.
 */
export function bradfordAdaptation(srcWhite: Vec3, dstWhite: Vec3): Mat3 {
	const s = m3.mulV(BRADFORD, srcWhite);
	const d = m3.mulV(BRADFORD, dstWhite);
	const scale = m3.diag([d[0] / s[0], d[1] / s[1], d[2] / s[2]]);
	return m3.mul(BRADFORD_INV, m3.mul(scale, BRADFORD));
}
