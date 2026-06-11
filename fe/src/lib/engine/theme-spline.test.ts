import { describe, expect, it } from 'vitest';

import { createAppState } from './state.svelte';
import { buildRamp } from './theme';
import { rebuildMatrices } from '$lib/renderer/uniforms';
import { INTERP_SPACES, INTERP_SPACE_KEYS } from '$lib/color/interp';
import { lsrgb2oklab, oklab2lsrgb } from '$lib/color/pipeline';
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

	it('clears the curve and stops when there are no source points', () => {
		const state = splineState('oklch', 'free');
		state.theme.points = [];
		buildRamp(state, matrices);
		expect(state.theme.stops).toEqual([]);
		expect(state.theme.splineCurve).toEqual([]);
	});

	it('emits a single seed stop for exactly one source point', () => {
		const state = splineState('oklch', 'free');
		state.theme.points = [{ srgbLin: [0.3, 0.3, 0.3] }];
		buildRamp(state, matrices);
		expect(state.theme.stops.length).toBe(1);
		expect(state.theme.splineCurve.length).toBe(1);
	});

	it('handles steps === 1 without producing NaN', () => {
		const state = splineState('oklch', 'free', 1);
		buildRamp(state, matrices);
		expect(state.theme.stops.length).toBe(1);
		expect(state.theme.stops[0].srgbLin.every(finite)).toBe(true);
	});

	const offAxis = () => ({ delta: 0, dir: 'off' as const });

	it('expand builds a 2-D palette (rows x columns); off keeps it 1-D', () => {
		const state = splineState('oklch', 'free', 4);
		state.theme.expandOn = false;
		buildRamp(state, matrices);
		expect(state.theme.grid).toEqual([]);

		// Tints & shades preset = column light sym walk.
		state.theme.expandOn = true;
		state.theme.expandCols = { count: 6, hue: offAxis(), chroma: offAxis(), light: { delta: -0.32, dir: 'sym' } };
		buildRamp(state, matrices);
		expect(state.theme.grid.length).toBe(4);
		expect(state.theme.grid.every((row) => row.length === 6)).toBe(true);
		expect(state.theme.grid.every((row) => row.every((c) => c.srgbLin.every(finite)))).toBe(true);
	});

	it('a single source point + spread columns fans the seed into a 1-row palette', () => {
		const state = createAppState().explorer;
		state.theme.mode = 'linear';
		state.theme.points = [{ srgbLin: [0.4, 0.2, 0.5] }];
		state.theme.expandOn = true;
		state.theme.expandCols = {
			count: 7,
			hue: { delta: 40, dir: 'sym' },
			chroma: { delta: 0.05, dir: 'sym' },
			light: offAxis()
		};
		buildRamp(state, matrices);
		expect(state.theme.stops.length).toBe(1); // one seed stop
		expect(state.theme.grid.length).toBe(1); // one row
		expect(state.theme.grid[0].length).toBe(7);
		expect(state.theme.grid[0].every((c) => c.srgbLin.every(finite))).toBe(true);
	});

	it('row hue walks produce one related ramp per harmony angle', () => {
		const cases = [
			[{ count: 2, delta: 180, dir: 'ramp' }, 2], // complementary
			[{ count: 3, delta: 240, dir: 'ramp' }, 3], // triadic
			[{ count: 3, delta: 30, dir: 'sym' }, 3], // analogous
			[{ count: 4, delta: 270, dir: 'ramp' }, 4] // tetradic
		] as const;
		for (const [cfg, rows] of cases) {
			const state = splineState('oklch', 'free', 5);
			state.theme.expandOn = true;
			state.theme.expandRows = {
				count: cfg.count,
				hue: { delta: cfg.delta, dir: cfg.dir },
				chroma: offAxis(),
				light: offAxis()
			};
			buildRamp(state, matrices);
			expect(state.theme.grid.length).toBe(rows);
			expect(state.theme.grid.every((row) => row.length === 5)).toBe(true);
			expect(state.theme.grid.every((row) => row.every((c) => c.srgbLin.every(finite)))).toBe(true);
		}
	});

	it('v2 spread matches the legacy operators (equivalence oracles)', () => {
		// Harmony oracle: rotate each stop's hue in Oklab by the scheme angles.
		const state = splineState('oklab', 'free', 5);
		state.theme.gamutMap = 'none';
		buildRamp(state, matrices);
		const base = state.theme.stops.map((s) => [...s.srgbLin] as [number, number, number]);
		state.theme.expandOn = true;
		state.theme.expandRows = { count: 3, hue: { delta: 240, dir: 'ramp' }, chroma: offAxis(), light: offAxis() };
		buildRamp(state, matrices);
		const angles = [0, 120, 240];
		state.theme.grid.forEach((row, r) => {
			const rad = (angles[r] * Math.PI) / 180;
			row.forEach((cell, i) => {
				const ok = lsrgb2oklab(base[i].map((v) => Math.min(Math.max(v, 0), 1)) as [number, number, number]);
				const a = ok[1] * Math.cos(rad) - ok[2] * Math.sin(rad);
				const b = ok[1] * Math.sin(rad) + ok[2] * Math.cos(rad);
				const expected = oklab2lsrgb([ok[0], a, b]);
				expected.forEach((v, k) => expect(Math.abs(cell.srgbLin[k] - v)).toBeLessThan(1e-6));
			});
		});

		// Tints oracle (mid-L colors, no clamping): old walked L from L+0.32 down to L-0.32.
		state.theme.expandRows = { count: 1, hue: offAxis(), chroma: offAxis(), light: offAxis() };
		state.theme.expandCols = { count: 5, hue: offAxis(), chroma: offAxis(), light: { delta: -0.32, dir: 'sym' } };
		state.theme.points = [{ srgbLin: [0.2, 0.18, 0.22] }, { srgbLin: [0.25, 0.22, 0.2] }];
		buildRamp(state, matrices);
		state.theme.grid.forEach((row, si) => {
			const ok = lsrgb2oklab(state.theme.stops[si].srgbLin.map((v) => Math.min(Math.max(v, 0), 1)) as [number, number, number]);
			row.forEach((cell, j) => {
				const t = j / 4;
				const L = ok[0] + 0.32 - 0.64 * t; // hi -> lo, matching old order
				const expected = oklab2lsrgb([L, ok[1], ok[2]]);
				expected.forEach((v, k) => expect(Math.abs(cell.srgbLin[k] - v)).toBeLessThan(1e-6));
			});
		});
	});

	it('disabled stages pass the picked colors through', () => {
		// Interpolate off: no curve; stops are the exact anchors.
		const state = splineState('oklch', 'free', 9);
		state.theme.interpolateOn = false;
		buildRamp(state, matrices);
		expect(state.theme.splineCurve).toEqual([]);
		expect(state.theme.stops.length).toBe(3);
		state.theme.stops.forEach((s, i) => {
			state.theme.points[i].srgbLin.forEach((v, k) => expect(Math.abs(s.srgbLin[k] - v)).toBeLessThan(1e-9));
		});

		// Place off (interpolate on): curve drawn, stops are still the anchors.
		state.theme.interpolateOn = true;
		state.theme.placeOn = false;
		buildRamp(state, matrices);
		expect(state.theme.splineCurve.length).toBeGreaterThan(1);
		expect(state.theme.stops.length).toBe(3);
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
