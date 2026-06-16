import { m3, type Mat3, type Vec3 } from '$lib/color/math';
import { GAMUTS, OK_M1, OK_M2, OK_M2i, rgbToXyzM } from '$lib/color/pipeline';
import { bradfordAdaptation } from '$lib/color/adapt';
import { DEFAULT_OBSERVERS } from '$lib/color/fundamentals';

import type { GamutConversion } from '$lib/color/registry';
import type { GamutKey, ShellKey } from '$lib/engine/types';

export interface DerivedMatrices {
	rgb2xyz: Mat3;
	xyz2rgb: Mat3;
	okM1: Mat3;
	okM2: Mat3;
	okM1i: Mat3;
	okM2i: Mat3;
	toSrgbLin: GamutConversion;
	white: Vec3;
	rgb2lms: Mat3;
	lms2rgb: Mat3;
}

export function rebuildMatrices(gamut: GamutKey, observerKey = 'stockman-sharpe-2deg', _trigger = 0): DerivedMatrices {
	const g = GAMUTS[gamut];
	const d65 = GAMUTS.srgb.W;
	// Chromatically adapt the active gamut's XYZ to the D65 interchange white via
	// Bradford. Non-D65 gamuts (NTSC = Illuminant C, CIE = E) are otherwise shown
	// silently wrong: their white renders tinted and Lab/Oklab geometry is off,
	// because the unadapted XYZ feeds the D65-referenced sRGB / Lab math. D65
	// gamuts get an exact identity (no-op). rgb2xyz is therefore D65-relative, so
	// `white` below is D65 and CPU `xyz2lab` (D65 default) and the shader's
	// `uWhite` Lab normalization agree.
	const rgb2xyz = m3.mul(bradfordAdaptation(g.W, d65), rgbToXyzM(g.P, g.W));
	const srgb2xyz = rgbToXyzM(GAMUTS.srgb.P, GAMUTS.srgb.W);
	const xyz2srgb = m3.inv(srgb2xyz);
	const gamut2srgbLin = m3.mul(xyz2srgb, rgb2xyz);
	const okM1 = m3.mul(OK_M1, gamut2srgbLin);

	// Compute dynamic LMS conversion matrices relative to the active gamut and active observer
	const activeObserver = DEFAULT_OBSERVERS[observerKey as keyof typeof DEFAULT_OBSERVERS] || DEFAULT_OBSERVERS['stockman-sharpe-2deg'];
	const rgb2lms = m3.mul(activeObserver.toLmsMatrix, rgb2xyz);
	const lms2rgb = m3.mul(m3.inv(rgb2xyz), activeObserver.toXyzMatrix);

	return {
		rgb2xyz,
		xyz2rgb: m3.inv(rgb2xyz),
		okM1,
		okM2: OK_M2,
		okM1i: m3.inv(okM1),
		okM2i: OK_M2i,
		toSrgbLin: { toSrgb: gamut2srgbLin, fromSrgb: m3.inv(gamut2srgbLin) },
		white: d65,
		rgb2lms,
		lms2rgb
	};
}

export function rebuildShell(shell: ShellKey, observerKey = 'stockman-sharpe-2deg', _trigger = 0): DerivedMatrices | null {
	if (shell === 'none') return null;
	return rebuildMatrices(shell, observerKey, _trigger);
}
