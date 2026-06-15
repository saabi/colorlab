/**
 * Snapshot schema version changelog
 *
 * v1: First explicit schemaVersion on ParameterSnapshot.
 *   Legacy v0 saves (explorer + camera, no schemaVersion) are upgraded on load.
 * v2: Snapshot schema is the durable AppState shape owned by engine state.
 * v3: Gamut handling unified into a global theme.gamutMap policy. The spline-only
 *   theme.splineConstraint was narrowed to 'free'|'surface'; its former clip values
 *   move to theme.gamutMap.
 * v4: theme.A/B + theme.controlPoints unified into one ordered theme.points list.
 *   spline docs -> points = controlPoints; others -> [A,B].
 * v5: theme.mode collapsed to 'linear'|'spline'|'spread' with an explicit
 *   interpolation space. seg -> linear+world; arc -> linear+oklch (cylindrical).
 * v6: spread is no longer a mode but an Expand operator.
 *   mode 'spread' -> mode 'linear' + expand 'spread' (expandSteps from old steps).
 * v7: Expand generalized to one Spread (Oklch axes).
 *   expand/harmony/expandSteps/dh/dc/cprof -> expandOn + expandRows + expandCols
 *   ({count, hue|chroma|light: {delta, dir: off|ramp|sym|edges}}). Harmony = row
 *   hue walks; tints = column light sym; spread = column hue sym + chroma
 *   sym/edges (dc scaled /2.2 from the old world-cylindrical frame).
 * v8: multiple source lists. theme.points ->
 *   theme.lists = [points] (one ramp per list) + theme.activeList = 0.
 * v9: spline surface constraint methods. Old
 *   theme.splineConstraint 'surface' -> 'surface-radial'; add
 *   theme.surfaceProjection = 'adaptive-0.5'.
 * v10: add theme.surfaceProjectionParams with
 *   adaptive alpha/focus/neutral defaults derived from theme.surfaceProjection.
 * v11: add theme.gamutMapParams with adaptive alpha
 *   defaults for terminal ramp gamut mapping.
 * v12 (CURRENT_SNAPSHOT_VERSION): add theme.gamutMapParams.focusL so fixed
 *   `L 0.5` methods become defaulted focus-lightness methods.
 *
 * When adding v8+, append a line here and implement migrateVNToVN+1 below.
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

function migrateV3ToV4(raw: Record<string, unknown>) {
	raw.schemaVersion = 4;
	const explorer = raw.explorer as Record<string, unknown> | undefined;
	const theme = explorer?.theme as Record<string, unknown> | undefined;
	if (theme && !Array.isArray(theme.points)) {
		// Unify A/B + controlPoints into one ordered points list.
		const cps = Array.isArray(theme.controlPoints) ? theme.controlPoints : [];
		theme.points =
			theme.mode === 'spline' ? cps : [theme.A, theme.B].filter((p) => p && typeof p === 'object');
		delete theme.A;
		delete theme.B;
		delete theme.controlPoints;
	}
	return raw;
}

function migrateV4ToV5(raw: Record<string, unknown>) {
	raw.schemaVersion = 5;
	const explorer = raw.explorer as Record<string, unknown> | undefined;
	const theme = explorer?.theme as Record<string, unknown> | undefined;
	if (theme) {
		if (theme.mode === 'seg') {
			theme.mode = 'linear';
			theme.splineSpace = 'world';
		} else if (theme.mode === 'arc') {
			theme.mode = 'linear';
			// Arc was cylindrical interpolation; OKLCH reproduces it (exactly in Oklab world).
			theme.splineSpace = 'oklch';
		}
		// 'spline' and 'spread' keep their mode and existing splineSpace.
	}
	return raw;
}

function migrateV5ToV6(raw: Record<string, unknown>) {
	raw.schemaVersion = 6;
	const explorer = raw.explorer as Record<string, unknown> | undefined;
	const theme = explorer?.theme as Record<string, unknown> | undefined;
	if (theme && theme.mode === 'spread') {
		// Spread becomes a per-stop Expand operator over a single-seed ramp.
		theme.mode = 'linear';
		theme.expand = 'spread';
		if (typeof theme.steps === 'number') theme.expandSteps = Math.min(12, Math.max(2, Math.round(theme.steps)));
	}
	return raw;
}

const SPREAD_OFF = { delta: 0, dir: 'off' };

function migrateV6ToV7(raw: Record<string, unknown>) {
	raw.schemaVersion = 7;
	const explorer = raw.explorer as Record<string, unknown> | undefined;
	const theme = explorer?.theme as Record<string, unknown> | undefined;
	if (theme && !theme.expandRows) {
		const count = typeof theme.expandSteps === 'number' ? theme.expandSteps : 5;
		const dh = typeof theme.dh === 'number' ? theme.dh : 40;
		const dc = typeof theme.dc === 'number' ? theme.dc : 0;
		let rows: unknown = { count: 2, hue: { delta: 180, dir: 'off' }, chroma: SPREAD_OFF, light: SPREAD_OFF };
		let cols: unknown = { count, hue: SPREAD_OFF, chroma: SPREAD_OFF, light: { delta: -0.32, dir: 'off' } };
		if (theme.expand === 'harmony') {
			// Harmony = row hue walks: complementary [0,180], triadic [0,120,240],
			// analogous [-30,0,30], tetradic [0,90,180,270].
			const h = theme.harmony;
			const cfg =
				h === 'triadic'
					? { count: 3, delta: 240, dir: 'ramp' }
					: h === 'analogous'
						? { count: 3, delta: 30, dir: 'sym' }
						: h === 'tetradic'
							? { count: 4, delta: 270, dir: 'ramp' }
							: { count: 2, delta: 180, dir: 'ramp' };
			rows = { count: cfg.count, hue: { delta: cfg.delta, dir: cfg.dir }, chroma: SPREAD_OFF, light: SPREAD_OFF };
		} else if (theme.expand === 'tints-shades') {
			// Old order walked light tint -> dark shade; negative delta preserves it.
			cols = { count, hue: SPREAD_OFF, chroma: SPREAD_OFF, light: { delta: -0.32, dir: 'sym' } };
		} else if (theme.expand === 'spread') {
			// Old spread fanned in the world cylindrical frame; in the Oklab world the
			// chroma radius carried a 2.2 scale, hence dc / 2.2 in Oklch.
			const chroma =
				theme.cprof === 'mirror' ? { delta: -dc / 2.2, dir: 'edges' } : { delta: dc / 2.2, dir: 'sym' };
			cols = { count, hue: { delta: dh, dir: 'sym' }, chroma, light: SPREAD_OFF };
		}
		theme.expandOn = theme.expand !== 'none' && theme.expand !== undefined;
		theme.expandRows = rows;
		theme.expandCols = cols;
		delete theme.expand;
		delete theme.harmony;
		delete theme.expandSteps;
		delete theme.dh;
		delete theme.dc;
		delete theme.cprof;
	}
	return raw;
}

function migrateV7ToV8(raw: Record<string, unknown>) {
	raw.schemaVersion = 8;
	const explorer = raw.explorer as Record<string, unknown> | undefined;
	const theme = explorer?.theme as Record<string, unknown> | undefined;
	if (theme && !Array.isArray(theme.lists)) {
		// One source-points list becomes the first (and active) of many.
		theme.lists = [Array.isArray(theme.points) ? theme.points : []];
		theme.activeList = 0;
		delete theme.points;
	}
	return raw;
}

function migrateV8ToV9(raw: Record<string, unknown>) {
	raw.schemaVersion = 9;
	const explorer = raw.explorer as Record<string, unknown> | undefined;
	const theme = explorer?.theme as Record<string, unknown> | undefined;
	if (theme) {
		if (theme.splineConstraint === 'surface') theme.splineConstraint = 'surface-radial';
		if (theme.surfaceProjection === undefined) theme.surfaceProjection = 'adaptive-0.5';
	}
	return raw;
}

function migrateV9ToV10(raw: Record<string, unknown>) {
	raw.schemaVersion = 10;
	const explorer = raw.explorer as Record<string, unknown> | undefined;
	const theme = explorer?.theme as Record<string, unknown> | undefined;
	if (theme && theme.surfaceProjectionParams === undefined) {
		theme.surfaceProjectionParams = {
			method: typeof theme.surfaceProjection === 'string' ? theme.surfaceProjection : 'adaptive-0.5',
			alpha: 0.05,
			focusL: 0.5,
			neutral: 'preserve'
		};
	}
	return raw;
}

function migrateV10ToV11(raw: Record<string, unknown>) {
	raw.schemaVersion = 11;
	const explorer = raw.explorer as Record<string, unknown> | undefined;
	const theme = explorer?.theme as Record<string, unknown> | undefined;
	if (theme && theme.gamutMapParams === undefined) {
		theme.gamutMapParams = {
			alpha: 0.05,
			focusL: 0.5
		};
	}
	return raw;
}

function migrateV11ToV12(raw: Record<string, unknown>) {
	raw.schemaVersion = 12;
	const explorer = raw.explorer as Record<string, unknown> | undefined;
	const theme = explorer?.theme as Record<string, unknown> | undefined;
	const params = theme?.gamutMapParams as Record<string, unknown> | undefined;
	if (theme && params === undefined) {
		theme.gamutMapParams = {
			alpha: 0.05,
			focusL: 0.5
		};
	} else if (params && params.focusL === undefined) {
		params.focusL = 0.5;
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
		if (version === 3) current = migrateV3ToV4(current);
		if (version === 4) current = migrateV4ToV5(current);
		if (version === 5) current = migrateV5ToV6(current);
		if (version === 6) current = migrateV6ToV7(current);
		if (version === 7) current = migrateV7ToV8(current);
		if (version === 8) current = migrateV8ToV9(current);
		if (version === 9) current = migrateV9ToV10(current);
		if (version === 10) current = migrateV10ToV11(current);
		if (version === 11) current = migrateV11ToV12(current);
	}
	return current;
}
