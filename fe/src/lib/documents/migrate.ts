/**
 * Snapshot schema version changelog
 *
 * v1: First explicit schemaVersion on ParameterSnapshot.
 *   Legacy v0 saves (explorer + camera, no schemaVersion) are upgraded on load.
 * v2 (CURRENT_SNAPSHOT_VERSION): Snapshot schema is the durable AppState shape owned by engine state.
 *
 * When adding v2+, append a line here and implement migrateVNToVN+1 below.
 */

import { CURRENT_SNAPSHOT_VERSION } from './types';

function migrateV0ToV1(raw: Record<string, unknown>) {
	raw.schemaVersion = 1;
	return raw;
}

function migrateV1ToV2(raw: Record<string, unknown>) {
	raw.schemaVersion = 2;
	return raw;
}

export function migrateSnapshot(raw: unknown, fromVersion: number): unknown {
	if (!raw || typeof raw !== 'object') return raw;
	let current = { ...(raw as Record<string, unknown>) };
	for (let version = fromVersion; version < CURRENT_SNAPSHOT_VERSION; version += 1) {
		if (version === 0) current = migrateV0ToV1(current);
		if (version === 1) current = migrateV1ToV2(current);
	}
	return current;
}
