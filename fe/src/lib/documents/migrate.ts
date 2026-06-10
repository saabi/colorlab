/**
 * Snapshot schema version changelog
 *
 * v1 (CURRENT_SNAPSHOT_VERSION): First explicit schemaVersion on ParameterSnapshot.
 *   Legacy v0 saves (explorer + camera, no schemaVersion) are upgraded on load.
 *
 * When adding v2+, append a line here and implement migrateVNToVN+1 below.
 */

import { CURRENT_SNAPSHOT_VERSION } from './types';

function migrateV0ToV1(raw: Record<string, unknown>) {
	raw.schemaVersion = 1;
	return raw;
}

export function migrateSnapshot(raw: unknown, fromVersion: number): unknown {
	if (!raw || typeof raw !== 'object') return raw;
	let current = { ...(raw as Record<string, unknown>) };
	for (let version = fromVersion; version < CURRENT_SNAPSHOT_VERSION; version += 1) {
		if (version === 0) current = migrateV0ToV1(current);
	}
	return current;
}
