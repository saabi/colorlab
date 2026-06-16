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
	const anchorsOf = (snapshot: ReturnType<typeof parseSnapshot>['snapshot']) =>
		snapshot?.explorer.theme.lists.map((list) => list.anchors);
	const pipelineOf = (snapshot: ReturnType<typeof parseSnapshot>['snapshot'], index = 0) =>
		snapshot?.explorer.theme.lists[index].pipeline;

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
		const { lists: _cp, ...themeWithoutSpline } = defaults.explorer.theme;
		const legacy = {
			explorer: { ...defaults.explorer, theme: themeWithoutSpline },
			camera: defaults.camera
		};
		const result = parseSnapshot(legacy);
		expect(anchorsOf(result.snapshot)).toEqual([[]]);
		expect(pipelineOf(result.snapshot)?.main.constraint).toBe('free');
		expect(pipelineOf(result.snapshot)?.splineSpace).toBe('oklab');
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
		expect(pipelineOf(result.snapshot)?.mode).toBe('spline');
		expect(pipelineOf(result.snapshot)?.splineSpace).toBe('okhsv');
		expect(anchorsOf(result.snapshot)).toEqual([cps]);
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
		expect(result.snapshot?.explorer.theme.lists[0].pipeline.main.constraint).toBe('surface-radial');
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
		expect(anchorsOf(parseSnapshot(spline).snapshot)).toEqual([
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
		expect(anchorsOf(parseSnapshot(seg).snapshot)).toEqual([
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
		expect(s?.lists[0].pipeline.mode).toBe('linear');
		expect(s?.lists[0].pipeline.splineSpace).toBe('world');

		const arc = {
			schemaVersion: 4,
			explorer: { theme: { mode: 'arc', points: [{ srgbLin: [0, 0, 0] }, { srgbLin: [1, 1, 1] }] } },
			camera: defaults.camera
		} as unknown;
		const a = parseSnapshot(arc).snapshot?.explorer.theme;
		expect(a?.lists[0].pipeline.mode).toBe('linear');
		expect(a?.lists[0].pipeline.splineSpace).toBe('oklch');
	});

	it('migrates v5 spread mode through to the v7 generalized Spread', () => {
		const doc = {
			schemaVersion: 5,
			explorer: { theme: { mode: 'spread', steps: 9, dh: 40, dc: 0.22, cprof: 'linear', points: [{ srgbLin: [0.3, 0.2, 0.4] }] } },
			camera: defaults.camera
		} as unknown;
		const t = parseSnapshot(doc).snapshot?.explorer.theme;
		expect(t?.lists[0].pipeline.mode).toBe('linear');
		expect(t?.lists[0].pipeline.expandOn).toBe(true);
		expect(t?.lists[0].pipeline.expandCols.count).toBe(9);
		expect(t?.lists[0].pipeline.expandCols.hue).toEqual({ delta: 40, dir: 'sym' });
		expect(t?.lists[0].pipeline.expandCols.chroma.dir).toBe('sym');
		expect(t?.lists[0].pipeline.expandCols.chroma.delta).toBeCloseTo(0.22 / 2.2, 6);
	});

	it('migrates v6 expand operators to v7 Spread generators', () => {
		const mk = (theme: Record<string, unknown>) =>
			parseSnapshot({ schemaVersion: 6, explorer: { theme }, camera: defaults.camera } as unknown).snapshot
				?.explorer.theme.lists[0].pipeline;

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
		expect(pipelineOf(result.snapshot)?.splineSpace).toBe('oklab');
		expect(anchorsOf(result.snapshot)).toEqual([[{ srgbLin: [0.1, 0.2, 0.3] }]]);
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
		expect(anchorsOf(result.snapshot)).toEqual([
			[{ srgbLin: [0.2, 0.3, 0.4] }, { srgbLin: [0.6, 0.5, 0.1] }]
		]);
		expect(result.snapshot?.explorer.theme.activeList).toBe(0);
		expect('points' in (result.snapshot?.explorer.theme ?? {})).toBe(false);
	});

	it('migrates v8 surface constraint to v9 radial surface and adds projection default', () => {
		const v8 = {
			schemaVersion: 8,
			explorer: {
				...defaults.explorer,
				theme: {
					...defaults.explorer.theme,
					splineConstraint: 'surface'
				}
			},
			camera: defaults.camera
		} as unknown;
		const result = parseSnapshot(v8);
		expect(result.migrated).toBe(true);
		expect(result.snapshot?.schemaVersion).toBe(CURRENT_SNAPSHOT_VERSION);
		expect(result.snapshot?.explorer.theme.lists[0].pipeline.main.constraint).toBe('surface-radial');
		expect(result.snapshot?.explorer.theme.lists[0].pipeline.main.projection).toBe('adaptive-0.5');
		expect(result.snapshot?.explorer.theme.lists[0].pipeline.main.projectionParams).toMatchObject({
			method: 'adaptive-0.5',
			alpha: 0.05,
			focusL: 0.5,
			neutral: 'preserve'
		});
	});

	it('migrates v9 surface projection defaults to v10 params', () => {
		const v9 = {
			schemaVersion: 9,
			explorer: {
				...defaults.explorer,
				theme: {
					...defaults.explorer.theme,
					surfaceProjection: 'adaptive-cusp'
				}
			},
			camera: defaults.camera
		} as unknown;
		const result = parseSnapshot(v9);
		expect(result.migrated).toBe(true);
		expect(result.snapshot?.schemaVersion).toBe(CURRENT_SNAPSHOT_VERSION);
		expect(result.snapshot?.explorer.theme.lists[0].pipeline.main.projectionParams).toMatchObject({
			method: 'adaptive-cusp',
			alpha: 0.05,
			focusL: 0.5,
			neutral: 'preserve'
		});
	});

	it('migrates v10 gamut map defaults to v12 params', () => {
		const v10 = {
			schemaVersion: 10,
			explorer: {
				...defaults.explorer,
				theme: {
					...defaults.explorer.theme,
					gamutMap: 'adaptive-cusp'
				}
			},
			camera: defaults.camera
		} as unknown;
		const result = parseSnapshot(v10);
		expect(result.migrated).toBe(true);
		expect(result.snapshot?.schemaVersion).toBe(CURRENT_SNAPSHOT_VERSION);
		expect(result.snapshot?.explorer.theme.gamutMapParams).toMatchObject({
			alpha: 0.05,
			focusL: 0.5
		});
	});

	it('migrates v11 gamut map params to v12 focus defaults', () => {
		const v11 = {
			schemaVersion: 11,
			explorer: {
				...defaults.explorer,
				theme: {
					...defaults.explorer.theme,
					gamutMap: 'adaptive-0.5',
					gamutMapParams: {
						alpha: 0.5
					}
				}
			},
			camera: defaults.camera
		} as unknown;
		const result = parseSnapshot(v11);
		expect(result.migrated).toBe(true);
		expect(result.snapshot?.schemaVersion).toBe(CURRENT_SNAPSHOT_VERSION);
		expect(result.snapshot?.explorer.theme.gamutMapParams).toMatchObject({
			alpha: 0.5,
			focusL: 0.5
		});
	});

	it('migrates v12 flat global settings to v13 per-list pipelines', () => {
		const v12 = {
			schemaVersion: 12,
			explorer: {
				theme: {
					lists: [[{ srgbLin: [0.1, 0.2, 0.3] }], [{ srgbLin: [0.4, 0.5, 0.6] }]],
					activeList: 1,
					mode: 'spline',
					splineSpace: 'oklch',
					interpolateOn: true,
					placeOn: true,
					place: 'tones',
					arcLong: true,
					contrastMin: 2.0,
					contrastMax: 10.0,
					wcagBg: 'black',
					steps: 9,
					splineConstraint: 'surface-radial',
					surfaceProjection: 'project-cusp',
					surfaceProjectionParams: {
						method: 'project-cusp',
						alpha: 0.1,
						focusL: 0.5,
						neutral: 'radial-fallback'
					},
					expandOn: true,
					expandRows: { count: 3, hue: { delta: 10, dir: 'sym' }, chroma: { delta: 0, dir: 'off' }, light: { delta: 0, dir: 'off' } },
					expandCols: { count: 4, hue: { delta: 0, dir: 'off' }, chroma: { delta: 0.1, dir: 'sym' }, light: { delta: 0, dir: 'off' } },
					gamutMap: 'adaptive-cusp',
					gamutMapParams: { alpha: 0.5, focusL: 0.4 }
				}
			},
			camera: defaults.camera
		} as unknown;
		const result = parseSnapshot(v12);
		expect(result.migrated).toBe(true);
		expect(result.snapshot?.schemaVersion).toBe(CURRENT_SNAPSHOT_VERSION);

		const theme = result.snapshot?.explorer.theme;
		expect(theme?.activeList).toBe(1);
		expect(theme?.gamutMap).toBe('adaptive-cusp');
		expect(theme?.gamutMapParams).toMatchObject({ alpha: 0.5, focusL: 0.4 });

		expect(theme?.lists.length).toBe(2);
		expect(theme?.lists[0].anchors).toEqual([{ srgbLin: [0.1, 0.2, 0.3] }]);
		expect(theme?.lists[1].anchors).toEqual([{ srgbLin: [0.4, 0.5, 0.6] }]);

		const p1 = theme?.lists[1].pipeline;
		expect(p1?.mode).toBe('spline');
		expect(p1?.splineSpace).toBe('oklch');
		expect(p1?.interpolateOn).toBe(true);
		expect(p1?.placeOn).toBe(true);
		expect(p1?.place).toBe('tones');
		expect(p1?.arcLong).toBe(true);
		expect(p1?.contrastMin).toBe(2.0);
		expect(p1?.contrastMax).toBe(10.0);
		expect(p1?.wcagBg).toBe('black');
		expect(p1?.steps).toBe(9);
		expect(p1?.main.constraint).toBe('surface-radial');
		expect(p1?.main.projection).toBe('project-cusp');
		expect(p1?.main.projectionParams.neutral).toBe('radial-fallback');
		expect(p1?.expandOn).toBe(true);
		expect(p1?.expandRows.count).toBe(3);
		expect(p1?.expandCols.count).toBe(4);
		expect(p1?.extension.constraint).toBe('free');
	});

	it('round-trips new surface projection constraint fields', () => {
		const list = defaults.explorer.theme.lists[0];
		const doc = {
			...defaults,
			explorer: {
				...defaults.explorer,
				theme: {
					...defaults.explorer.theme,
					lists: [
						{
							...list,
							pipeline: {
								...list.pipeline,
								main: {
									constraint: 'surface-oklab-project',
									projection: 'adaptive-cusp',
									projectionParams: {
										method: 'adaptive-cusp',
										alpha: 0.5,
										focusL: 0.5,
										neutral: 'preserve'
									}
								}
							}
						}
					]
				}
			}
		};
		const result = parseSnapshot(doc);
		expect(result.snapshot?.explorer.theme.lists[0].pipeline.main.constraint).toBe('surface-oklab-project');
		expect(result.snapshot?.explorer.theme.lists[0].pipeline.main.projection).toBe('adaptive-cusp');
		expect(result.snapshot?.explorer.theme.lists[0].pipeline.main.projectionParams.alpha).toBe(0.5);
	});

	it('round-trips gamut map adaptive params', () => {
		const doc = {
			...defaults,
			explorer: {
				...defaults.explorer,
				theme: {
					...defaults.explorer.theme,
					gamutMap: 'adaptive-cusp',
					gamutMapParams: {
						alpha: 0.5,
						focusL: 0.35
					}
				}
			}
		};
		const result = parseSnapshot(doc);
		expect(result.snapshot?.explorer.theme.gamutMap).toBe('adaptive-cusp');
		expect(result.snapshot?.explorer.theme.gamutMapParams.alpha).toBe(0.5);
		expect(result.snapshot?.explorer.theme.gamutMapParams.focusL).toBe(0.35);
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

		const oldRampUi = { ...defaults, explorer: { ...defaults.explorer, openSteps: ['gamut', 'sources'] } };
		expect(parseSnapshot(oldRampUi).snapshot?.explorer.openSteps).toEqual(['gamut', 'sources', 'ramp-builder']);
	});

	it('persists guide notes and defaults them when absent', () => {
		const withGuide = {
			...defaults,
			explorer: {
				...defaults.explorer,
				guideNote: 'Try the slice plane.',
				guideNotePlacement: 'overlay',
				guideNoteDismissed: true
			}
		};
		const snap = parseSnapshot(withGuide).snapshot?.explorer;
		expect(snap?.guideNote).toBe('Try the slice plane.');
		expect(snap?.guideNotePlacement).toBe('overlay');
		expect(snap?.guideNoteDismissed).toBe(true);

		const { guideNote: _n, guideNotePlacement: _p, guideNoteDismissed: _d, ...explorerNoGuide } =
			defaults.explorer;
		const legacy = { explorer: explorerNoGuide, camera: defaults.camera };
		const legacySnap = parseSnapshot(legacy).snapshot?.explorer;
		expect(legacySnap?.guideNote).toBe(defaults.explorer.guideNote);
		expect(legacySnap?.guideNotePlacement).toBe(defaults.explorer.guideNotePlacement);
		expect(legacySnap?.guideNoteDismissed).toBe(defaults.explorer.guideNoteDismissed);
	});

	it('does not persist runtime-only auto-reduce fields', () => {
		const doc = {
			...defaults,
			explorer: {
				...defaults.explorer,
				autoPerformance: false,
				minAverageFps: 15,
				autoRotate: false,
				neutralBackdrop: true
			}
		} as unknown;
		const snap = parseSnapshot(doc).snapshot;
		expect('autoPerformance' in (snap?.explorer ?? {})).toBe(false);
		expect('minAverageFps' in (snap?.explorer ?? {})).toBe(false);
		expect('autoRotate' in (snap?.explorer ?? {})).toBe(false);
		expect('neutralBackdrop' in (snap?.explorer ?? {})).toBe(false);
	});
});
