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
});
