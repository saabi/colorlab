import { dot3, m3, type Vec3 } from '$lib/color/math';
import { CVD, applyCVD } from '$lib/color/cvd';
import { SPACES } from '$lib/color/registry';
import { GAMUTS, LMS2RGB, RGB2LMS, XYZ2LMS2, lsrgb2oklab, xyz2lab } from '$lib/color/pipeline';
import { camRay, type Camera } from './camera';
import { planeND } from './plane';

import type { ExplorerState, TransformChain } from './types';
import type { DerivedMatrices } from '$lib/renderer/uniforms';

function clamp01(v: number) {
	return Math.min(Math.max(v, 0), 1);
}

export function solidField(p: Vec3, state: ExplorerState, matrices: DerivedMatrices) {
	const rgb = SPACES[state.spaceMode].fromWorld(p, matrices.rgb2xyz, matrices.toSrgbLin);
	let v = -Infinity;
	for (let k = 0; k < 3; k += 1) v = Math.max(v, -rgb[k], rgb[k] - 1);
	if (state.slice && (state.cutAbove || state.cutBelow)) {
		const { n, d } = planeND(state);
		const s = dot3(n, p) - d;
		if (state.cutAbove) v = Math.max(v, s - state.eps);
		if (state.cutBelow) v = Math.max(v, -s - state.eps);
	}
	if (state.cylSlice) {
		const r = Math.hypot(p[0], p[2]);
		v = Math.max(v, r - state.cylRad);
	}
	return { v, rgb };
}

export function pick(
	px: number,
	py: number,
	w: number,
	h: number,
	state: ExplorerState,
	matrices: DerivedMatrices,
	camera: Camera
) {
	const { ro, rd } = camRay(px, py, w, h, camera);
	const at = (t: number): Vec3 => [ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t];
	if (solidField(ro, state, matrices).v <= 0) return null;
	const tMax = camera.dist + 2.5;
	const steps = 220;
	let tPrev = 0;
	for (let i = 1; i <= steps; i += 1) {
		const t = (i / steps) * tMax;
		if (solidField(at(t), state, matrices).v <= 0) {
			let a = tPrev;
			let b = t;
			for (let j = 0; j < 20; j += 1) {
				const mid = (a + b) / 2;
				if (solidField(at(mid), state, matrices).v <= 0) b = mid;
				else a = mid;
			}
			const world = at(b);
			const res = solidField(world, state, matrices);
			const tol = 2e-3;
			const inGamut = res.rgb.every((value) => value >= -tol && value <= 1 + tol);
			const rgbLin = res.rgb.map(clamp01) as Vec3;
			return { world, rgbLin, inGamut };
		}
		tPrev = t;
	}
	return null;
}

export function chain(rgbLin: Vec3, state: ExplorerState, matrices: DerivedMatrices): TransformChain {
	const g = GAMUTS[state.gamut];
	const enc = rgbLin.map((v) => g.trc.enc(clamp01(v))) as Vec3;
	const xyz = m3.mulV(matrices.rgb2xyz, rgbLin);
	const lms = m3.mulV(XYZ2LMS2, xyz);
	const lab = xyz2lab(xyz);
	const srgbLin = m3.mulV(matrices.toSrgbLin.toSrgb, rgbLin);
	const ok = lsrgb2oklab(srgbLin);
	const C = Math.hypot(ok[1], ok[2]);
	const Hh = ((Math.atan2(ok[2], ok[1]) * 180) / Math.PI + 360) % 360;
	let cvdLin = srgbLin;
	if (CVD[state.cvd] && state.cvdSev > 0.001) {
		const sourceLms = m3.mulV(RGB2LMS, srgbLin);
		const sim = applyCVD(sourceLms, state.cvd, state.cvdSev);
		cvdLin = m3.mulV(LMS2RGB, sim);
	}
	return { enc, rgbLin, xyz, lms, lab, ok, oklch: [ok[0], C, Hh], srgbLin, cvdLin };
}
