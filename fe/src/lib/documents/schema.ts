import { type Camera } from '$lib/engine/camera';
import { createAppState } from '$lib/engine/state.svelte';

import type {
	AxisSpreadConfig,
	ChromaticityOverlayKey,
	CvdMode,
	GamutKey,
	PersistedExplorer,
	PersistedTheme,
	PlaneMode,
	ShellKey,
	SpaceMode,
	SplineConstraint,
	SpreadAxis,
	SpreadDir,
	ThemeAnchor,
	ThemeMode,
	InterpSpaceChoice,
	PlacePolicy
} from '$lib/engine/types';
import { MAX_RAMP_STOPS } from '$lib/engine/types';
import { INTERP_SPACE_KEYS } from '$lib/color/interp';
import { GAMUT_CLIP_METHODS, GAMUT_MAP_METHODS, type GamutMapMethod } from '$lib/color/gamut-map';
import type { SurfaceProjectionMethod, SurfaceProjectionNeutralFallback, SurfaceProjectionParams } from '$lib/color/boundary-project';
import { CURRENT_SNAPSHOT_VERSION, type ParameterSnapshot } from './types';

const SPACE_MODES: readonly SpaceMode[] = [0, 1, 2, 3, 5];
const GAMUTS: readonly GamutKey[] = ['srgb', 'p3', 'rec2020', 'ntsc', 'ebu', 'smptec', 'cie'];
const TESS: readonly PersistedExplorer['N'][] = [64, 128, 192, 256, 512];
const PLANE_MODES: readonly PlaneMode[] = ['L', 'H', 'C'];
const SHELLS: readonly ShellKey[] = ['none', 'srgb', 'p3', 'rec2020', 'ntsc', 'cie'];
const CHROMA_OVERLAYS: readonly ChromaticityOverlayKey[] = ['off', 'spectral-locus', 'spectral-surface'];
const CVD_MODES: readonly CvdMode[] = ['none', 'protan', 'deutan', 'tritan'];
const THEME_MODES: readonly ThemeMode[] = ['linear', 'spline'];
const PLACE_POLICIES: readonly PlacePolicy[] = ['even', 'uniform', 'tones', 'contrast'];
const SPREAD_DIRS: readonly SpreadDir[] = ['off', 'ramp', 'sym', 'edges'];
const WCAG_BG: readonly PersistedTheme['wcagBg'][] = ['white', 'black'];
const SPLINE_CONSTRAINTS: readonly SplineConstraint[] = [
	'free',
	'surface-radial',
	'surface-oklab-chroma',
	'surface-oklab-project'
];
const SURFACE_PROJECTIONS: readonly SurfaceProjectionMethod[] = GAMUT_CLIP_METHODS;
const SURFACE_NEUTRAL_FALLBACKS: readonly SurfaceProjectionNeutralFallback[] = ['preserve', 'radial-fallback', 'remember-hue'];
const GAMUT_MAPS: readonly GamutMapMethod[] = GAMUT_MAP_METHODS;
const INTERP_SPACES: readonly InterpSpaceChoice[] = [...INTERP_SPACE_KEYS, 'world'];

function warn(message: string) {
	console.warn(`[documents] ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function finiteNumber(value: unknown, fallback: number, label: string) {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const n = Number(value);
		if (Number.isFinite(n)) return n;
	}
	if (value !== undefined) warn(`Invalid number for ${label}; using default.`);
	return fallback;
}

function enumOf<T extends string | number>(
	value: unknown,
	allowed: readonly T[],
	fallback: T,
	label: string
): T {
	if (typeof value === 'string' || typeof value === 'number') {
		if ((allowed as readonly (string | number)[]).includes(value)) return value as T;
	}
	if (value !== undefined) warn(`Invalid enum for ${label}; using default.`);
	return fallback;
}

function tuple3(value: unknown, fallback: [number, number, number], label: string): [number, number, number] {
	if (!Array.isArray(value) || value.length < 3) {
		if (value !== undefined) warn(`Invalid tuple for ${label}; using default.`);
		return fallback;
	}
	const a = finiteNumber(value[0], fallback[0], `${label}[0]`);
	const b = finiteNumber(value[1], fallback[1], `${label}[1]`);
	const c = finiteNumber(value[2], fallback[2], `${label}[2]`);
	return [a, b, c];
}

function coerceAnchor(value: unknown, fallback: ThemeAnchor | null, label: string): ThemeAnchor | null {
	if (value === null) return null;
	if (!isRecord(value)) {
		if (value !== undefined) warn(`Invalid anchor for ${label}; using default.`);
		return fallback;
	}
	return { srgbLin: tuple3(value.srgbLin, fallback?.srgbLin ?? [0, 0, 0], `${label}.srgbLin`) };
}

function coerceAnchorList(value: unknown, label: string): ThemeAnchor[] {
	if (!Array.isArray(value)) {
		if (value !== undefined) warn(`Invalid control point list for ${label}; using empty.`);
		return [];
	}
	const out: ThemeAnchor[] = [];
	value.forEach((entry, i) => {
		// Drop entries that are not a record carrying an srgbLin array, rather than
		// silently coercing them to black.
		if (!isRecord(entry) || !Array.isArray(entry.srgbLin)) {
			warn(`Dropping invalid control point ${label}[${i}].`);
			return;
		}
		const anchor = coerceAnchor(entry, null, `${label}[${i}]`);
		if (anchor) out.push(anchor);
	});
	return out;
}

function coerceSpreadAxis(raw: unknown, defaults: SpreadAxis, label: string): SpreadAxis {
	const axis = isRecord(raw) ? raw : {};
	return {
		delta: finiteNumber(axis.delta, defaults.delta, `${label}.delta`),
		dir: enumOf(axis.dir, SPREAD_DIRS, defaults.dir, `${label}.dir`)
	};
}

function coerceSpread(raw: unknown, defaults: AxisSpreadConfig, label: string): AxisSpreadConfig {
	const g = isRecord(raw) ? raw : {};
	return {
		count: Math.min(12, Math.max(1, Math.round(finiteNumber(g.count, defaults.count, `${label}.count`)))),
		hue: coerceSpreadAxis(g.hue, defaults.hue, `${label}.hue`),
		chroma: coerceSpreadAxis(g.chroma, defaults.chroma, `${label}.chroma`),
		light: coerceSpreadAxis(g.light, defaults.light, `${label}.light`)
	};
}

function coerceLists(value: unknown, label: string): ThemeAnchor[][] {
	const lists: ThemeAnchor[][] = [];
	if (Array.isArray(value)) {
		value.forEach((entry, i) => {
			if (!Array.isArray(entry)) {
				warn(`Dropping invalid source list ${label}[${i}].`);
				return;
			}
			lists.push(coerceAnchorList(entry, `${label}[${i}]`));
		});
	} else if (value !== undefined) {
		warn(`Invalid source lists for ${label}; using one empty list.`);
	}
	// Invariant: at least one list always exists (the active edit target).
	if (!lists.length) lists.push([]);
	return lists;
}

function coerceSurfaceProjectionParams(
	raw: unknown,
	defaults: SurfaceProjectionParams,
	method: SurfaceProjectionMethod
): SurfaceProjectionParams {
	const params = isRecord(raw) ? raw : {};
	return {
		method,
		alpha: Math.min(5, Math.max(0, finiteNumber(params.alpha, defaults.alpha, 'theme.surfaceProjectionParams.alpha'))),
		focusL: Math.min(1, Math.max(0, finiteNumber(params.focusL, defaults.focusL, 'theme.surfaceProjectionParams.focusL'))),
		neutral: enumOf(params.neutral, SURFACE_NEUTRAL_FALLBACKS, defaults.neutral, 'theme.surfaceProjectionParams.neutral')
	};
}

function coerceTheme(raw: unknown, defaults: PersistedTheme): PersistedTheme {
	const theme = isRecord(raw) ? raw : {};
	const lists = coerceLists(theme.lists, 'theme.lists');
	const surfaceProjection = enumOf(theme.surfaceProjection, SURFACE_PROJECTIONS, defaults.surfaceProjection, 'theme.surfaceProjection');
	return {
		lists,
		activeList: Math.min(
			lists.length - 1,
			Math.max(0, Math.round(finiteNumber(theme.activeList, 0, 'theme.activeList')))
		),
		splineConstraint: enumOf(theme.splineConstraint, SPLINE_CONSTRAINTS, defaults.splineConstraint, 'theme.splineConstraint'),
		surfaceProjection,
		surfaceProjectionParams: coerceSurfaceProjectionParams(theme.surfaceProjectionParams, defaults.surfaceProjectionParams, surfaceProjection),
		splineSpace: enumOf(theme.splineSpace, INTERP_SPACES, defaults.splineSpace, 'theme.splineSpace'),
		gamutMap: enumOf(theme.gamutMap, GAMUT_MAPS, defaults.gamutMap, 'theme.gamutMap'),
		steps: Math.min(MAX_RAMP_STOPS, Math.max(1, Math.round(finiteNumber(theme.steps, defaults.steps, 'theme.steps')))),
		interpolateOn: typeof theme.interpolateOn === 'boolean' ? theme.interpolateOn : defaults.interpolateOn,
		placeOn: typeof theme.placeOn === 'boolean' ? theme.placeOn : defaults.placeOn,
		mode: enumOf(theme.mode, THEME_MODES, defaults.mode, 'theme.mode'),
		arcLong: typeof theme.arcLong === 'boolean' ? theme.arcLong : defaults.arcLong,
		place: enumOf(theme.place, PLACE_POLICIES, defaults.place, 'theme.place'),
		contrastMin: Math.min(21, Math.max(1, finiteNumber(theme.contrastMin, defaults.contrastMin, 'theme.contrastMin'))),
		contrastMax: Math.min(21, Math.max(1, finiteNumber(theme.contrastMax, defaults.contrastMax, 'theme.contrastMax'))),
		expandOn: typeof theme.expandOn === 'boolean' ? theme.expandOn : defaults.expandOn,
		expandRows: coerceSpread(theme.expandRows, defaults.expandRows, 'theme.expandRows'),
		expandCols: coerceSpread(theme.expandCols, defaults.expandCols, 'theme.expandCols'),
		showPoints: typeof theme.showPoints === 'boolean' ? theme.showPoints : defaults.showPoints,
		showCurve: typeof theme.showCurve === 'boolean' ? theme.showCurve : defaults.showCurve,
		showStops: typeof theme.showStops === 'boolean' ? theme.showStops : defaults.showStops,
		showPalette: typeof theme.showPalette === 'boolean' ? theme.showPalette : defaults.showPalette,
		wcagBg: enumOf(theme.wcagBg, WCAG_BG, defaults.wcagBg, 'theme.wcagBg')
	};
}

function coerceCamera(raw: unknown, defaults: Camera): Camera {
	const camera = isRecord(raw) ? raw : {};
	return {
		yaw: finiteNumber(camera.yaw, defaults.yaw, 'camera.yaw'),
		pitch: finiteNumber(camera.pitch, defaults.pitch, 'camera.pitch'),
		dist: finiteNumber(camera.dist, defaults.dist, 'camera.dist'),
		target: tuple3(camera.target, defaults.target, 'camera.target'),
		fov: finiteNumber(camera.fov, defaults.fov, 'camera.fov')
	};
}

function coerceExplorer(raw: unknown, defaults: PersistedExplorer): PersistedExplorer {
	const explorer = isRecord(raw) ? raw : {};
	return {
		spaceMode: enumOf(explorer.spaceMode, SPACE_MODES, defaults.spaceMode, 'spaceMode'),
		gamut: enumOf(explorer.gamut, GAMUTS, defaults.gamut, 'gamut'),
		N: enumOf(explorer.N, TESS, defaults.N, 'N'),
		slice: typeof explorer.slice === 'boolean' ? explorer.slice : defaults.slice,
		planeMode: enumOf(explorer.planeMode, PLANE_MODES, defaults.planeMode, 'planeMode'),
		off: finiteNumber(explorer.off, defaults.off, 'off'),
		az: finiteNumber(explorer.az, defaults.az, 'az'),
		el: finiteNumber(explorer.el, defaults.el, 'el'),
		eps: finiteNumber(explorer.eps, defaults.eps, 'eps'),
		floor: typeof explorer.floor === 'boolean' ? explorer.floor : defaults.floor,
		lines: typeof explorer.lines === 'boolean' ? explorer.lines : defaults.lines,
		cutAbove: typeof explorer.cutAbove === 'boolean' ? explorer.cutAbove : defaults.cutAbove,
		cutBelow: typeof explorer.cutBelow === 'boolean' ? explorer.cutBelow : defaults.cutBelow,
		cylSlice: typeof explorer.cylSlice === 'boolean' ? explorer.cylSlice : defaults.cylSlice,
		cylRad: finiteNumber(explorer.cylRad, defaults.cylRad, 'cylRad'),
		shell: enumOf(explorer.shell, SHELLS, defaults.shell, 'shell'),
		chromaticityOverlay: enumOf(explorer.chromaticityOverlay, CHROMA_OVERLAYS, defaults.chromaticityOverlay, 'chromaticityOverlay'),
		planeOutline: typeof explorer.planeOutline === 'boolean' ? explorer.planeOutline : defaults.planeOutline,
		cylinderOutline:
			typeof explorer.cylinderOutline === 'boolean' ? explorer.cylinderOutline : defaults.cylinderOutline,
		outlineDepthTest:
			typeof explorer.outlineDepthTest === 'boolean' ? explorer.outlineDepthTest : defaults.outlineDepthTest,
		surfaceGridAlpha: finiteNumber(explorer.surfaceGridAlpha, defaults.surfaceGridAlpha, 'surfaceGridAlpha'),
		solidAlpha: Math.min(1, Math.max(0.05, finiteNumber(explorer.solidAlpha, defaults.solidAlpha, 'solidAlpha'))),
		hideAids: typeof explorer.hideAids === 'boolean' ? explorer.hideAids : defaults.hideAids,
		pinPalette: typeof explorer.pinPalette === 'boolean' ? explorer.pinPalette : defaults.pinPalette,
		openSteps: Array.isArray(explorer.openSteps)
			? explorer.openSteps.filter((s): s is string => typeof s === 'string')
			: defaults.openSteps,
		guideNote:
			typeof explorer.guideNote === 'string'
				? explorer.guideNote
				: explorer.guideNote === null
					? null
					: defaults.guideNote,
		guideNotePlacement:
			explorer.guideNotePlacement === 'sidebar' || explorer.guideNotePlacement === 'overlay'
				? explorer.guideNotePlacement
				: defaults.guideNotePlacement,
		guideNoteDismissed:
			typeof explorer.guideNoteDismissed === 'boolean'
				? explorer.guideNoteDismissed
				: defaults.guideNoteDismissed,
		cvd: enumOf(explorer.cvd, CVD_MODES, defaults.cvd, 'cvd'),
		cvdSev: finiteNumber(explorer.cvdSev, defaults.cvdSev, 'cvdSev'),
		theme: coerceTheme(explorer.theme, defaults.theme)
	};
}

export function coerceSnapshot(raw: unknown): ParameterSnapshot | null {
	if (!isRecord(raw)) return null;
	if (!isRecord(raw.explorer) && !isRecord(raw.camera)) return null;

	const factory = createAppState();
	const defaults: ParameterSnapshot = {
		schemaVersion: CURRENT_SNAPSHOT_VERSION,
		explorer: {
			spaceMode: factory.explorer.spaceMode,
			gamut: factory.explorer.gamut,
			N: factory.explorer.N,
			slice: factory.explorer.slice,
			planeMode: factory.explorer.planeMode,
			off: factory.explorer.off,
			az: factory.explorer.az,
			el: factory.explorer.el,
			eps: factory.explorer.eps,
			floor: factory.explorer.floor,
			lines: factory.explorer.lines,
			cutAbove: factory.explorer.cutAbove,
			cutBelow: factory.explorer.cutBelow,
			cylSlice: factory.explorer.cylSlice,
			cylRad: factory.explorer.cylRad,
			shell: factory.explorer.shell,
			chromaticityOverlay: factory.explorer.chromaticityOverlay,
			planeOutline: factory.explorer.planeOutline,
			cylinderOutline: factory.explorer.cylinderOutline,
			outlineDepthTest: factory.explorer.outlineDepthTest,
			surfaceGridAlpha: factory.explorer.surfaceGridAlpha,
			solidAlpha: factory.explorer.solidAlpha,
			hideAids: factory.explorer.hideAids,
			pinPalette: factory.explorer.pinPalette,
			openSteps: factory.explorer.openSteps,
			guideNote: factory.explorer.guideNote,
			guideNotePlacement: factory.explorer.guideNotePlacement,
			guideNoteDismissed: factory.explorer.guideNoteDismissed,
			cvd: factory.explorer.cvd,
			cvdSev: factory.explorer.cvdSev,
			theme: {
				lists: factory.explorer.theme.lists,
				activeList: factory.explorer.theme.activeList,
				splineConstraint: factory.explorer.theme.splineConstraint,
				surfaceProjection: factory.explorer.theme.surfaceProjection,
				surfaceProjectionParams: factory.explorer.theme.surfaceProjectionParams,
				splineSpace: factory.explorer.theme.splineSpace,
				gamutMap: factory.explorer.theme.gamutMap,
				steps: factory.explorer.theme.steps,
				mode: factory.explorer.theme.mode,
				arcLong: factory.explorer.theme.arcLong,
				place: factory.explorer.theme.place,
				contrastMin: factory.explorer.theme.contrastMin,
				contrastMax: factory.explorer.theme.contrastMax,
				interpolateOn: factory.explorer.theme.interpolateOn,
				placeOn: factory.explorer.theme.placeOn,
				expandOn: factory.explorer.theme.expandOn,
				expandRows: factory.explorer.theme.expandRows,
				expandCols: factory.explorer.theme.expandCols,
				showPoints: factory.explorer.theme.showPoints,
				showCurve: factory.explorer.theme.showCurve,
				showStops: factory.explorer.theme.showStops,
				showPalette: factory.explorer.theme.showPalette,
				wcagBg: factory.explorer.theme.wcagBg
			}
		},
		camera: factory.camera
	};

	return {
		schemaVersion: CURRENT_SNAPSHOT_VERSION,
		explorer: coerceExplorer(raw.explorer, defaults.explorer),
		camera: coerceCamera(raw.camera, defaults.camera)
	};
}
