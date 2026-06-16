import { LMS2RGB, RGB2LMS } from './pipeline';
import { m3, type Mat3, type Vec3 } from './math';

import type { CvdMode } from '$lib/engine/types';

export const CVD: Record<CvdMode, Mat3 | null> = {
	none: null,
	protan: [0, 1.33975219, -0.26447683, 0, 1, 0, 0, 0, 1],
	deutan: [1, 0, 0, 0.74640669, 0, 0.19740728, 0, 0, 1],
	tritan: [1, 0, 0, 0, 1, 0, -0.7407034, 1.51463889, 0]
};

export function applyCVD(lms: Vec3, type: CvdMode, severity: number): Vec3 {
	const matrix = CVD[type];
	if (!matrix) return lms;
	const sim = m3.mulV(matrix, lms);
	return [
		lms[0] + (sim[0] - lms[0]) * severity,
		lms[1] + (sim[1] - lms[1]) * severity,
		lms[2] + (sim[2] - lms[2]) * severity
	];
}

export function simulateCvdSrgb(
	srgbLin: Vec3,
	type: CvdMode,
	severity: number,
	rgb2lms: Mat3 = RGB2LMS,
	lms2rgb: Mat3 = LMS2RGB
): Vec3 {
	if (!CVD[type] || severity <= 0.001) return srgbLin;
	return m3.mulV(lms2rgb, applyCVD(m3.mulV(rgb2lms, srgbLin), type, severity));
}
