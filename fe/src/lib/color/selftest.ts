import { m3, type Vec3 } from './math';
import { GAMUTS, lab2xyz, lsrgb2oklab, oklab2lsrgb, rgbToXyzM, xyz2lab } from './pipeline';

export function selftest() {
	const M = rgbToXyzM(GAMUTS.srgb.P, GAMUTS.srgb.W);
	const Mi = m3.inv(M);
	let worst = 0;
	for (let i = 0; i < 200; i += 1) {
		const rgb: Vec3 = [Math.random(), Math.random(), Math.random()];
		const a = m3.mulV(Mi, lab2xyz(xyz2lab(m3.mulV(M, rgb))));
		const b = oklab2lsrgb(lsrgb2oklab(rgb));
		for (let k = 0; k < 3; k += 1) {
			worst = Math.max(worst, Math.abs(a[k] - rgb[k]), Math.abs(b[k] - rgb[k]));
		}
	}
	const method = worst < 1e-6 ? 'log' : 'error';
	console[method](`pipeline selftest: max round-trip error ${worst.toExponential(2)}`);
	return worst;
}
