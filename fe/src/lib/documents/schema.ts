import { createCamera, type Camera } from '$lib/engine/camera';
import { createExplorerState } from '$lib/engine/state.svelte';

import type {
	ChromaProfile,
	CvdMode,
	GamutKey,
	PlaneMode,
	ShellKey,
	SpaceMode,
	ThemeAnchor,
	ThemeMode
} from '$lib/engine/types';
import { CURRENT_SNAPSHOT_VERSION, type ParameterSnapshot, type PersistedExplorer, type PersistedTheme } from './types';

const SPACE_MODES: readonly SpaceMode[] = [0, 1, 2, 3, 5];
const GAMUTS: readonly GamutKey[] = ['srgb', 'p3', 'rec2020', 'ntsc', 'ebu', 'smptec', 'cie'];
const TESS: readonly PersistedExplorer['N'][] = [64, 128, 192, 256];
const PLANE_MODES: readonly PlaneMode[] = ['L', 'H', 'C'];
const SHELLS: readonly ShellKey[] = ['none', 'p3', 'rec2020', 'ntsc', 'cie'];
const CVD_MODES: readonly CvdMode[] = ['none', 'protan', 'deutan', 'tritan'];
const THEME_MODES: readonly ThemeMode[] = ['seg', 'arc', 'spread'];
const CHROMA_PROFILES: readonly ChromaProfile[] = ['linear', 'mirror'];
const WCAG_BG: readonly PersistedTheme['wcagBg'][] = ['white', 'black'];

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

function coerceTheme(raw: unknown, defaults: PersistedTheme): PersistedTheme {
	const theme = isRecord(raw) ? raw : {};
	return {
		A: coerceAnchor(theme.A, defaults.A, 'theme.A'),
		B: coerceAnchor(theme.B, defaults.B, 'theme.B'),
		steps: Math.max(1, Math.round(finiteNumber(theme.steps, defaults.steps, 'theme.steps'))),
		mode: enumOf(theme.mode, THEME_MODES, defaults.mode, 'theme.mode'),
		dh: finiteNumber(theme.dh, defaults.dh, 'theme.dh'),
		dc: finiteNumber(theme.dc, defaults.dc, 'theme.dc'),
		cprof: enumOf(theme.cprof, CHROMA_PROFILES, defaults.cprof, 'theme.cprof'),
		arcLong: typeof theme.arcLong === 'boolean' ? theme.arcLong : defaults.arcLong,
		aa: finiteNumber(theme.aa, defaults.aa, 'theme.aa'),
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
		cylInside: typeof explorer.cylInside === 'boolean' ? explorer.cylInside : defaults.cylInside,
		shell: enumOf(explorer.shell, SHELLS, defaults.shell, 'shell'),
		planeOutline: typeof explorer.planeOutline === 'boolean' ? explorer.planeOutline : defaults.planeOutline,
		cylinderOutline:
			typeof explorer.cylinderOutline === 'boolean' ? explorer.cylinderOutline : defaults.cylinderOutline,
		surfaceGridAlpha: finiteNumber(explorer.surfaceGridAlpha, defaults.surfaceGridAlpha, 'surfaceGridAlpha'),
		cvd: enumOf(explorer.cvd, CVD_MODES, defaults.cvd, 'cvd'),
		cvdSev: finiteNumber(explorer.cvdSev, defaults.cvdSev, 'cvdSev'),
		theme: coerceTheme(explorer.theme, defaults.theme)
	};
}

export function coerceSnapshot(raw: unknown): ParameterSnapshot | null {
	if (!isRecord(raw)) return null;
	if (!isRecord(raw.explorer) && !isRecord(raw.camera)) return null;

	const factory = createExplorerState();
	const factoryCamera = createCamera();
	const defaults: ParameterSnapshot = {
		schemaVersion: CURRENT_SNAPSHOT_VERSION,
		explorer: {
			spaceMode: factory.spaceMode,
			gamut: factory.gamut,
			N: factory.N,
			slice: factory.slice,
			planeMode: factory.planeMode,
			off: factory.off,
			az: factory.az,
			el: factory.el,
			eps: factory.eps,
			floor: factory.floor,
			lines: factory.lines,
			cutAbove: factory.cutAbove,
			cutBelow: factory.cutBelow,
			cylSlice: factory.cylSlice,
			cylRad: factory.cylRad,
			cylInside: factory.cylInside,
			shell: factory.shell,
			planeOutline: factory.planeOutline,
			cylinderOutline: factory.cylinderOutline,
			surfaceGridAlpha: factory.surfaceGridAlpha,
			cvd: factory.cvd,
			cvdSev: factory.cvdSev,
			theme: {
				A: factory.theme.A,
				B: factory.theme.B,
				steps: factory.theme.steps,
				mode: factory.theme.mode,
				dh: factory.theme.dh,
				dc: factory.theme.dc,
				cprof: factory.theme.cprof,
				arcLong: factory.theme.arcLong,
				aa: factory.theme.aa,
				wcagBg: factory.theme.wcagBg
			}
		},
		camera: factoryCamera
	};

	return {
		schemaVersion: CURRENT_SNAPSHOT_VERSION,
		explorer: coerceExplorer(raw.explorer, defaults.explorer),
		camera: coerceCamera(raw.camera, defaults.camera)
	};
}
