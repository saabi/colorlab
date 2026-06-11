/**
 * Snapshot schema version changelog
 *
 * v1: First explicit schemaVersion on ParameterSnapshot.
 *   Legacy v0 saves (explorer + camera, no schemaVersion) are upgraded on load.
 * v2: Snapshot schema is the durable AppState shape owned by engine state.
 * v3 (CURRENT_SNAPSHOT_VERSION): Gamut handling unified into a global theme.gamutMap
 *   policy. The spline-only theme.splineConstraint was narrowed to 'free'|'surface';
 *   its former clip values move to theme.gamutMap.
 *
 * When adding v3+, append a line here and implement migrateVNToVN+1 below.
 */

import { CURRENT_SNAPSHOT_VERSION } from './types';

// Clip strategies that used to live on splineConstraint (v2) and now live on gamutMap (v3).
const V2_CLIP_CONSTRAINTS = ['preserve-chroma', 'project-0.5', 'project-cusp', 'adaptive-0.5', 'adaptive-cusp'];

function migrateV0ToV1(raw: Record<string, unknown>) {
	raw.schemaVersion = 1;
	return raw;
}

function migrateV1ToV2(raw: Record<string, unknown>) {
	raw.schemaVersion = 2;
	return raw;
}

function migrateV2ToV3(raw: Record<string, unknown>) {
	raw.schemaVersion = 3;
	const explorer = raw.explorer as Record<string, unknown> | undefined;
	const theme = explorer?.theme as Record<string, unknown> | undefined;
	if (theme && typeof theme.splineConstraint === 'string' && V2_CLIP_CONSTRAINTS.includes(theme.splineConstraint)) {
		// The clip strategy was previously expressed through splineConstraint; move it
		// to the new global gamutMap policy and leave the curve snapped to the shell.
		theme.gamutMap = theme.splineConstraint;
		theme.splineConstraint = 'surface';
	}
	return raw;
}

export function migrateSnapshot(raw: unknown, fromVersion: number): unknown {
	if (!raw || typeof raw !== 'object') return raw;
	let current = { ...(raw as Record<string, unknown>) };
	for (let version = fromVersion; version < CURRENT_SNAPSHOT_VERSION; version += 1) {
		if (version === 0) current = migrateV0ToV1(current);
		if (version === 1) current = migrateV1ToV2(current);
		if (version === 2) current = migrateV2ToV3(current);
	}
	return current;
}
