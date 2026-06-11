import { m3, type Vec3 } from './math';
import { GAMUTS, lab2xyz, lsrgb2oklab, luv2xyz, oklab2lsrgb, rgbToXyzM, xyz2lab, xyz2luv } from './pipeline';
import { INTERP_SPACES, INTERP_SPACE_KEYS } from './interp';

export function selftest() {
	const M = rgbToXyzM(GAMUTS.srgb.P, GAMUTS.srgb.W);
	const Mi = m3.inv(M);
	let worst = 0;
	let worstInterp = 0;
	for (let i = 0; i < 200; i += 1) {
		const rgb: Vec3 = [Math.random(), Math.random(), Math.random()];
		const a = m3.mulV(Mi, lab2xyz(xyz2lab(m3.mulV(M, rgb))));
		const b = oklab2lsrgb(lsrgb2oklab(rgb));
		const c = m3.mulV(Mi, luv2xyz(xyz2luv(m3.mulV(M, rgb))));
		for (let k = 0; k < 3; k += 1) {
			worst = Math.max(worst, Math.abs(a[k] - rgb[k]), Math.abs(b[k] - rgb[k]), Math.abs(c[k] - rgb[k]));
		}
		// Interpolation-space round-trips (linear sRGB -> space -> linear sRGB).
		// Okhsv uses a polynomial gamut-cusp approximation, so this is checked at a looser budget.
		for (const key of INTERP_SPACE_KEYS) {
			const space = INTERP_SPACES[key];
			const rt = space.toSrgbLin(space.fromSrgbLin(rgb));
			for (let k = 0; k < 3; k += 1) worstInterp = Math.max(worstInterp, Math.abs(rt[k] - rgb[k]));
		}
	}
	const method = worst < 1e-6 ? 'log' : 'error';
	console[method](`pipeline selftest: max round-trip error ${worst.toExponential(2)}`);
	const interpMethod = worstInterp < 1e-3 ? 'log' : 'error';
	console[interpMethod](`interp-space selftest: max round-trip error ${worstInterp.toExponential(2)}`);
	return worst;
}
