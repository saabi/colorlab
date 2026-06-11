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
		const { lists: _cp, splineConstraint: _sc, splineSpace: _ss, ...themeWithoutSpline } =
			defaults.explorer.theme;
		const legacy = {
			explorer: { ...defaults.explorer, theme: themeWithoutSpline },
			camera: defaults.camera
		};
		const result = parseSnapshot(legacy);
		expect(result.snapshot?.explorer.theme.lists).toEqual([[]]);
		expect(result.snapshot?.explorer.theme.splineConstraint).toBe('free');
		expect(result.snapshot?.explorer.theme.splineSpace).toBe('oklab');
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
				theme: { ...defaults.explorer.theme, mode: 'spline', splineSpace: 'okhsv', lists: [cps] }
			}
		};
		const result = parseSnapshot(doc);
		expect(result.snapshot?.explorer.theme.mode).toBe('spline');
		expect(result.snapshot?.explorer.theme.splineSpace).toBe('okhsv');
		expect(result.snapshot?.explorer.theme.lists).toEqual([cps]);
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
		expect(parseSnapshot(spline).snapshot?.explorer.theme.lists).toEqual([
			[
				{ srgbLin: [0.2, 0.2, 0.2] },
				{ srgbLin: [0.8, 0.1, 0.1] }
			]
		]);

		const seg = {
			schemaVersion: 3,
			explorer: {
				theme: { mode: 'seg', A: { srgbLin: [0.1, 0.1, 0.1] }, B: { srgbLin: [0.9, 0.9, 0.9] }, controlPoints: [] }
			},
			camera: defaults.camera
		} as unknown;
		expect(parseSnapshot(seg).snapshot?.explorer.theme.lists).toEqual([
			[
				{ srgbLin: [0.1, 0.1, 0.1] },
				{ srgbLin: [0.9, 0.9, 0.9] }
			]
		]);
	});

	it('migrates v4 seg/arc modes to linear with an explicit interpolation space', () => {
		const seg = {
			schemaVersion: 4,
			explorer: { theme: { mode: 'seg', points: [{ srgbLin: [0, 0, 0] }, { srgbLin: [1, 1, 1] }] } },
			camera: defaults.camera
		} as unknown;
		const s = parseSnapshot(seg).snapshot?.explorer.theme;
		expect(s?.mode).toBe('linear');
		expect(s?.splineSpace).toBe('world');

		const arc = {
			schemaVersion: 4,
			explorer: { theme: { mode: 'arc', points: [{ srgbLin: [0, 0, 0] }, { srgbLin: [1, 1, 1] }] } },
			camera: defaults.camera
		} as unknown;
		const a = parseSnapshot(arc).snapshot?.explorer.theme;
		expect(a?.mode).toBe('linear');
		expect(a?.splineSpace).toBe('oklch');
	});

	it('migrates v5 spread mode through to the v7 generalized Spread', () => {
		const doc = {
			schemaVersion: 5,
			explorer: { theme: { mode: 'spread', steps: 9, dh: 40, dc: 0.22, cprof: 'linear', points: [{ srgbLin: [0.3, 0.2, 0.4] }] } },
			camera: defaults.camera
		} as unknown;
		const t = parseSnapshot(doc).snapshot?.explorer.theme;
		expect(t?.mode).toBe('linear');
		expect(t?.expandOn).toBe(true);
		expect(t?.expandCols.count).toBe(9);
		expect(t?.expandCols.hue).toEqual({ delta: 40, dir: 'sym' });
		expect(t?.expandCols.chroma.dir).toBe('sym');
		expect(t?.expandCols.chroma.delta).toBeCloseTo(0.22 / 2.2, 6);
	});

	it('migrates v6 expand operators to v7 Spread generators', () => {
		const mk = (theme: Record<string, unknown>) =>
			parseSnapshot({ schemaVersion: 6, explorer: { theme }, camera: defaults.camera } as unknown).snapshot
				?.explorer.theme;

		const none = mk({ expand: 'none' });
		expect(none?.expandOn).toBe(false);

		const harmony = mk({ expand: 'harmony', harmony: 'triadic' });
		expect(harmony?.expandOn).toBe(true);
		expect(harmony?.expandRows).toEqual({
			count: 3,
			hue: { delta: 240, dir: 'ramp' },
			chroma: { delta: 0, dir: 'off' },
			light: { delta: 0, dir: 'off' }
		});

		const tints = mk({ expand: 'tints-shades', expandSteps: 7 });
		expect(tints?.expandOn).toBe(true);
		expect(tints?.expandCols.count).toBe(7);
		expect(tints?.expandCols.light).toEqual({ delta: -0.32, dir: 'sym' });

		const mirror = mk({ expand: 'spread', expandSteps: 4, dh: 60, dc: 0.11, cprof: 'mirror' });
		expect(mirror?.expandCols.chroma.dir).toBe('edges');
		expect(mirror?.expandCols.chroma.delta).toBeCloseTo(-0.11 / 2.2, 6);
	});

	it('coerces garbage control points and unknown spline space to safe defaults', () => {
		const doc = {
			...defaults,
			explorer: {
				...defaults.explorer,
				theme: {
					...defaults.explorer.theme,
					splineSpace: 'not-a-space',
					lists: [[{ srgbLin: [0.1, 0.2, 0.3] }, 'garbage', null, { nope: true }], 'not-a-list']
				}
			}
		};
		const result = parseSnapshot(doc);
		expect(result.snapshot?.explorer.theme.splineSpace).toBe('oklab');
		expect(result.snapshot?.explorer.theme.lists).toEqual([[{ srgbLin: [0.1, 0.2, 0.3] }]]);
	});

	it('migrates a v7 points list into v8 lists with activeList 0', () => {
		const v7 = {
			schemaVersion: 7,
			explorer: {
				theme: {
					mode: 'spline',
					points: [{ srgbLin: [0.2, 0.3, 0.4] }, { srgbLin: [0.6, 0.5, 0.1] }]
				}
			},
			camera: defaults.camera
		} as unknown;
		const result = parseSnapshot(v7);
		expect(result.migrated).toBe(true);
		expect(result.snapshot?.explorer.theme.lists).toEqual([
			[{ srgbLin: [0.2, 0.3, 0.4] }, { srgbLin: [0.6, 0.5, 0.1] }]
		]);
		expect(result.snapshot?.explorer.theme.activeList).toBe(0);
		expect('points' in (result.snapshot?.explorer.theme ?? {})).toBe(false);
	});

	it('clamps a persisted activeList to the available lists', () => {
		const doc = {
			...defaults,
			explorer: {
				...defaults.explorer,
				theme: {
					...defaults.explorer.theme,
					lists: [[{ srgbLin: [0.1, 0.2, 0.3] }], [{ srgbLin: [0.5, 0.5, 0.5] }]],
					activeList: 7
				}
			}
		};
		expect(parseSnapshot(doc).snapshot?.explorer.theme.activeList).toBe(1);
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
