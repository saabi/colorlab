import { coerceSnapshot } from './schema';
import { migrateSnapshot } from './migrate';

import { CURRENT_SNAPSHOT_VERSION, type ParameterSnapshot } from './types';

export type ParseRejectReason = 'newer' | 'invalid';

export interface ParseSnapshotResult {
	snapshot: ParameterSnapshot | null;
	fromVersion: number | null;
	migrated: boolean;
	rejectReason?: ParseRejectReason;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function detectSchemaVersion(raw: unknown): number | null {
	if (!isRecord(raw)) return null;
	if (typeof raw.schemaVersion === 'number' && Number.isInteger(raw.schemaVersion)) {
		return raw.schemaVersion;
	}
	if (isRecord(raw.explorer) && isRecord(raw.camera)) return 0;
	return null;
}

export function parseSnapshot(raw: unknown): ParseSnapshotResult {
	const fromVersion = detectSchemaVersion(raw);
	if (fromVersion === null) {
		return { snapshot: null, fromVersion: null, migrated: false, rejectReason: 'invalid' };
	}
	if (fromVersion > CURRENT_SNAPSHOT_VERSION) {
		console.warn(
			`[documents] Snapshot schema v${fromVersion} is newer than app v${CURRENT_SNAPSHOT_VERSION}; skipping document.`
		);
		return { snapshot: null, fromVersion, migrated: false, rejectReason: 'newer' };
	}

	const migrated = fromVersion < CURRENT_SNAPSHOT_VERSION;
	const migratedRaw = migrated ? migrateSnapshot(raw, fromVersion) : raw;
	const snapshot = coerceSnapshot(migratedRaw);
	if (!snapshot) {
		return { snapshot: null, fromVersion, migrated, rejectReason: 'invalid' };
	}
	return { snapshot, fromVersion, migrated };
}
