import { describe, expect, it } from 'vitest';

import { createAppState } from './state.svelte';
import { buildRamp } from './theme';
import { rebuildMatrices } from '$lib/renderer/uniforms';
import { INTERP_SPACES, INTERP_SPACE_KEYS } from '$lib/color/interp';
import { GAMUT_MAP_METHODS } from '$lib/color/gamut-map';
import type { GamutMapMethod } from '$lib/color/gamut-map';
import type { SplineConstraint } from './types';

const matrices = rebuildMatrices('srgb');
const CONSTRAINTS: readonly SplineConstraint[] = ['free', 'surface'];

function splineState(
	space: (typeof INTERP_SPACE_KEYS)[number],
	constraint: SplineConstraint,
	steps = 5,
	gamutMap: GamutMapMethod = 'none'
) {
	const state = createAppState().explorer;
	state.theme.mode = 'spline';
	state.theme.splineSpace = space;
	state.theme.splineConstraint = constraint;
	state.theme.gamutMap = gamutMap;
	state.theme.steps = steps;
	state.theme.points = [
		{ srgbLin: [0.02, 0.01, 0.2] },
		{ srgbLin: [0.6, 0.05, 0.05] },
		{ srgbLin: [0.7, 0.85, 0.1] }
	];
	return state;
}

const finite = (v: number) => Number.isFinite(v);

describe('interpolation-space round trips', () => {
	it('every registered space round-trips linear sRGB within tolerance', () => {
		const samples = [
			[0.1, 0.2, 0.3],
			[0.8, 0.4, 0.05],
			[0.5, 0.5, 0.5],
			[0.02, 0.9, 0.6]
		] as const;
		for (const key of INTERP_SPACE_KEYS) {
			const space = INTERP_SPACES[key];
			for (const s of samples) {
				const rt = space.toSrgbLin(space.fromSrgbLin([...s]));
				for (let k = 0; k < 3; k += 1) expect(Math.abs(rt[k] - s[k]), `${key}[${k}]`).toBeLessThan(2e-3);
			}
		}
	});
});

describe('buildSplineRamp', () => {
	it('produces `steps` finite stops and a hi-res curve for every space and curve constraint', () => {
		for (const key of INTERP_SPACE_KEYS) {
			for (const constraint of CONSTRAINTS) {
				const state = splineState(key, constraint, 7);
				buildRamp(state, matrices);
				expect(state.theme.stops.length, `${key}/${constraint} stops`).toBe(7);
				expect(state.theme.splineCurve.length, `${key}/${constraint} curve`).toBe(200);
				for (const stop of state.theme.stops) {
					expect(stop.world.every(finite) && stop.srgbLin.every(finite), `${key}/${constraint} finite`).toBe(true);
				}
			}
		}
	});

	it('applies every gamut-map policy producing finite, in-gamut stops', () => {
		for (const method of GAMUT_MAP_METHODS) {
			const state = splineState('okhsv', 'free', 7, method);
			buildRamp(state, matrices);
			expect(state.theme.stops.length, `${method} stops`).toBe(7);
			for (const stop of state.theme.stops) {
				expect(stop.srgbLin.every(finite), `${method} finite`).toBe(true);
				if (method !== 'none') {
					// mapped colors must be within sRGB (small float tolerance)
					expect(stop.srgbLin.every((v) => v >= -2e-3 && v <= 1 + 2e-3), `${method} in gamut`).toBe(true);
				}
			}
		}
	});

	it('passes through the control-point colors when free (curve interpolates anchors exactly)', () => {
		const state = splineState('oklab', 'free', 5);
		buildRamp(state, matrices);
		// The endpoints of the free curve must equal the first/last control points.
		const first = state.theme.splineCurve[0].srgbLin;
		const last = state.theme.splineCurve[state.theme.splineCurve.length - 1].srgbLin;
		state.theme.points[0].srgbLin.forEach((v: number, k: number) => expect(Math.abs(first[k] - v)).toBeLessThan(1e-6));
		state.theme.points[2].srgbLin.forEach((v: number, k: number) => expect(Math.abs(last[k] - v)).toBeLessThan(1e-6));
	});

	it('clears the curve and stops when fewer than two control points', () => {
		const state = splineState('oklch', 'free');
		state.theme.points = [{ srgbLin: [0.3, 0.3, 0.3] }];
		buildRamp(state, matrices);
		expect(state.theme.stops).toEqual([]);
		expect(state.theme.splineCurve).toEqual([]);
	});

	it('handles steps === 1 without producing NaN', () => {
		const state = splineState('oklch', 'free', 1);
		buildRamp(state, matrices);
		expect(state.theme.stops.length).toBe(1);
		expect(state.theme.stops[0].srgbLin.every(finite)).toBe(true);
	});

	it('every place policy yields the requested number of finite stops', () => {
		for (const place of ['even', 'uniform', 'tones', 'contrast'] as const) {
			const state = splineState('oklch', 'free', 8);
			state.theme.place = place;
			buildRamp(state, matrices);
			expect(state.theme.stops.length).toBe(8);
			expect(state.theme.stops.every((s) => s.srgbLin.every(finite))).toBe(true);
		}
	});

	it('linear mode interpolates in any space incl. world, endpoints anchored', () => {
		for (const space of ['world', 'oklab', 'oklch'] as const) {
			const state = createAppState().explorer;
			state.theme.mode = 'linear';
			state.theme.splineConstraint = 'free';
			state.theme.splineSpace = space;
			state.theme.steps = 7;
			state.theme.points = [
				{ srgbLin: [0.05, 0.05, 0.4] },
				{ srgbLin: [0.7, 0.8, 0.1] }
			];
			buildRamp(state, matrices);
			expect(state.theme.stops.length).toBe(7);
			expect(state.theme.stops.every((s) => s.srgbLin.every(finite))).toBe(true);
			// A straight line between two points lands its endpoints on those points.
			const first = state.theme.stops[0].srgbLin;
			const last = state.theme.stops[6].srgbLin;
			[0.05, 0.05, 0.4].forEach((v, k) => expect(Math.abs(first[k] - v)).toBeLessThan(1e-3));
			[0.7, 0.8, 0.1].forEach((v, k) => expect(Math.abs(last[k] - v)).toBeLessThan(1e-3));
		}
	});
});
