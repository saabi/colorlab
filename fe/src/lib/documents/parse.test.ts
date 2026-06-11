import { describe, expect, it } from 'vitest';

import { CURRENT_SNAPSHOT_VERSION } from './types';
import { defaultSnapshot } from './snapshot';
import { detectSchemaVersion, parseSnapshot } from './parse';

describe('detectSchemaVersion', () => {
	it('returns 0 for legacy saves without schemaVersion', () => {
		expect(
			detectSchemaVersion({
				explorer: { gamut: 'srgb' },
				camera: { yaw: 0.5 }
			})
		).toBe(0);
	});

	it('returns null for non-objects', () => {
		expect(detectSchemaVersion(null)).toBeNull();
		expect(detectSchemaVersion('bad')).toBeNull();
	});

	it('reads explicit schemaVersion', () => {
		expect(detectSchemaVersion({ schemaVersion: 1, explorer: {}, camera: {} })).toBe(1);
	});
});

describe('parseSnapshot', () => {
	const defaults = defaultSnapshot();

	it('loads v0 JSON missing a new field with factory default', () => {
		const { cylSlice: _cylSlice, ...explorerWithoutCyl } = defaults.explorer;
		const legacy = { explorer: explorerWithoutCyl, camera: defaults.camera };
		const result = parseSnapshot(legacy);
		expect(result.snapshot).not.toBeNull();
		expect(result.snapshot?.explorer.cylSlice).toBe(defaults.explorer.cylSlice);
		expect(result.snapshot?.schemaVersion).toBe(CURRENT_SNAPSHOT_VERSION);
		expect(result.migrated).toBe(true);
	});

	it('strips unknown explorer fields from legacy saves', () => {
		const legacy = {
			explorer: { ...defaults.explorer, legacyOutlineDetail: 4 },
			camera: defaults.camera
		};
		const result = parseSnapshot(legacy);
		expect(result.snapshot).not.toBeNull();
		expect('legacyOutlineDetail' in (result.snapshot?.explorer ?? {})).toBe(false);
	});

	it('replaces invalid gamut with default', () => {
		const legacy = {
			explorer: { ...defaults.explorer, gamut: 'invalid' },
			camera: defaults.camera
		};
		const result = parseSnapshot(legacy);
		expect(result.snapshot?.explorer.gamut).toBe('srgb');
	});

	it('coerces numeric strings', () => {
		const legacy = {
			explorer: { ...defaults.explorer, off: '0.55' },
			camera: defaults.camera
		};
		const result = parseSnapshot(legacy);
		expect(result.snapshot?.explorer.off).toBe(0.55);
	});

	it('rejects snapshots from a newer schema', () => {
		const future = {
			schemaVersion: CURRENT_SNAPSHOT_VERSION + 1,
			explorer: defaults.explorer,
			camera: defaults.camera
		};
		const result = parseSnapshot(future);
		expect(result.snapshot).toBeNull();
		expect(result.rejectReason).toBe('newer');
	});

	it('returns invalid for unrecognizable payloads', () => {
		expect(parseSnapshot({ foo: 'bar' }).rejectReason).toBe('invalid');
	});

	it('loads current schema without migration flag', () => {
		const current = defaultSnapshot();
		const result = parseSnapshot(current);
		expect(result.snapshot).not.toBeNull();
		expect(result.migrated).toBe(false);
		expect(result.snapshot?.schemaVersion).toBe(CURRENT_SNAPSHOT_VERSION);
	});

	it('migrates explicit v1 snapshots to current app state schema', () => {
		const v1 = { ...defaultSnapshot(), schemaVersion: 1 };
		const result = parseSnapshot(v1);
		expect(result.snapshot).not.toBeNull();
		expect(result.migrated).toBe(true);
		expect(result.fromVersion).toBe(1);
		expect(result.snapshot?.schemaVersion).toBe(CURRENT_SNAPSHOT_VERSION);
	});

	it('gives legacy saves without spline fields the factory defaults', () => {
		const { points: _cp, splineConstraint: _sc, splineSpace: _ss, ...themeWithoutSpline } =
			defaults.explorer.theme;
		const legacy = {
			explorer: { ...defaults.explorer, theme: themeWithoutSpline },
			camera: defaults.camera
		};
		const result = parseSnapshot(legacy);
		expect(result.snapshot?.explorer.theme.points).toEqual([]);
		expect(result.snapshot?.explorer.theme.splineConstraint).toBe('surface');
		expect(result.snapshot?.explorer.theme.splineSpace).toBe('oklch');
	});

	it('round-trips a spline document with control points', () => {
		const cps = [
			{ srgbLin: [0.1, 0.2, 0.3] as [number, number, number] },
			{ srgbLin: [0.4, 0.5, 0.6] as [number, number, number] }
		];
		const doc = {
			...defaults,
			explorer: {
				...defaults.explorer,
				theme: { ...defaults.explorer.theme, mode: 'spline', splineSpace: 'okhsv', points: cps }
			}
		};
		const result = parseSnapshot(doc);
		expect(result.snapshot?.explorer.theme.mode).toBe('spline');
		expect(result.snapshot?.explorer.theme.splineSpace).toBe('okhsv');
		expect(result.snapshot?.explorer.theme.points).toEqual(cps);
	});

	it('migrates a v2 spline-clip constraint to the v3 gamutMap policy', () => {
		const v2 = {
			schemaVersion: 2,
			explorer: {
				...defaults.explorer,
				theme: { ...defaults.explorer.theme, splineConstraint: 'preserve-chroma' }
			},
			camera: defaults.camera
		} as unknown;
		const result = parseSnapshot(v2);
		expect(result.migrated).toBe(true);
		expect(result.snapshot?.explorer.theme.splineConstraint).toBe('surface');
		expect(result.snapshot?.explorer.theme.gamutMap).toBe('preserve-chroma');
	});

	it('migrates v3 A/B + controlPoints into the unified points list', () => {
		const spline = {
			schemaVersion: 3,
			explorer: {
				theme: {
					mode: 'spline',
					A: { srgbLin: [0, 0, 0] },
					B: { srgbLin: [1, 1, 1] },
					controlPoints: [{ srgbLin: [0.2, 0.2, 0.2] }, { srgbLin: [0.8, 0.1, 0.1] }]
				}
			},
			camera: defaults.camera
		} as unknown;
		expect(parseSnapshot(spline).snapshot?.explorer.theme.points).toEqual([
			{ srgbLin: [0.2, 0.2, 0.2] },
			{ srgbLin: [0.8, 0.1, 0.1] }
		]);

		const seg = {
			schemaVersion: 3,
			explorer: {
				theme: { mode: 'seg', A: { srgbLin: [0.1, 0.1, 0.1] }, B: { srgbLin: [0.9, 0.9, 0.9] }, controlPoints: [] }
			},
			camera: defaults.camera
		} as unknown;
		expect(parseSnapshot(seg).snapshot?.explorer.theme.points).toEqual([
			{ srgbLin: [0.1, 0.1, 0.1] },
			{ srgbLin: [0.9, 0.9, 0.9] }
		]);
	});

	it('coerces garbage control points and unknown spline space to safe defaults', () => {
		const doc = {
			...defaults,
			explorer: {
				...defaults.explorer,
				theme: {
					...defaults.explorer.theme,
					splineSpace: 'not-a-space',
					points: [{ srgbLin: [0.1, 0.2, 0.3] }, 'garbage', null, { nope: true }]
				}
			}
		};
		const result = parseSnapshot(doc);
		expect(result.snapshot?.explorer.theme.splineSpace).toBe('oklch');
		expect(result.snapshot?.explorer.theme.points).toEqual([{ srgbLin: [0.1, 0.2, 0.3] }]);
	});

	it('persists openSteps, and defaults the set when absent', () => {
		const withSteps = { ...defaults, explorer: { ...defaults.explorer, openSteps: ['clip', 'export'] } };
		expect(parseSnapshot(withSteps).snapshot?.explorer.openSteps).toEqual(['clip', 'export']);

		const { openSteps: _omit, ...explorerNoSteps } = defaults.explorer;
		const legacy = { explorer: explorerNoSteps, camera: defaults.camera };
		expect(parseSnapshot(legacy).snapshot?.explorer.openSteps).toEqual(defaults.explorer.openSteps);
	});

	it('does not persist runtime-only auto-reduce fields', () => {
		const doc = {
			...defaults,
			explorer: { ...defaults.explorer, autoPerformance: false, minAverageFps: 15 }
		} as unknown;
		const snap = parseSnapshot(doc).snapshot;
		expect('autoPerformance' in (snap?.explorer ?? {})).toBe(false);
		expect('minAverageFps' in (snap?.explorer ?? {})).toBe(false);
	});
});
