import { createAppState } from '$lib/engine/state.svelte';

import type { AppState, ExplorerState, PersistedExplorer, ThemeAnchor } from '$lib/engine/types';
import type { Camera } from '$lib/engine/camera';
import { CURRENT_SNAPSHOT_VERSION, type ParameterSnapshot } from './types';

function cloneAnchor(anchor: ThemeAnchor | null): ThemeAnchor | null {
	if (!anchor) return null;
	return { srgbLin: [anchor.srgbLin[0], anchor.srgbLin[1], anchor.srgbLin[2]] };
}

function cloneCamera(camera: Camera): Camera {
	return {
		yaw: camera.yaw,
		pitch: camera.pitch,
		dist: camera.dist,
		target: [camera.target[0], camera.target[1], camera.target[2]],
		fov: camera.fov
	};
}

export function cloneSnapshot(snapshot: ParameterSnapshot): ParameterSnapshot {
	return JSON.parse(JSON.stringify(snapshot)) as ParameterSnapshot;
}

export function toPersistedExplorer(explorer: ExplorerState): PersistedExplorer {
	const theme = explorer.theme;
	return {
		spaceMode: explorer.spaceMode,
		gamut: explorer.gamut,
		N: explorer.N,
		slice: explorer.slice,
		planeMode: explorer.planeMode,
		off: explorer.off,
		az: explorer.az,
		el: explorer.el,
		eps: explorer.eps,
		floor: explorer.floor,
		lines: explorer.lines,
		cutAbove: explorer.cutAbove,
		cutBelow: explorer.cutBelow,
		cylSlice: explorer.cylSlice,
		cylRad: explorer.cylRad,
		shell: explorer.shell,
		planeOutline: explorer.planeOutline,
		cylinderOutline: explorer.cylinderOutline,
		outlineDepthTest: explorer.outlineDepthTest,
		surfaceGridAlpha: explorer.surfaceGridAlpha,
		hideAids: explorer.hideAids,
		openSteps: [...explorer.openSteps],
		cvd: explorer.cvd,
		cvdSev: explorer.cvdSev,
		theme: {
			points: theme.points.map((p) => ({
				srgbLin: [p.srgbLin[0], p.srgbLin[1], p.srgbLin[2]] as [number, number, number]
			})),
			splineConstraint: theme.splineConstraint,
			splineSpace: theme.splineSpace,
			gamutMap: theme.gamutMap,
			steps: theme.steps,
			mode: theme.mode,
			dh: theme.dh,
			dc: theme.dc,
			cprof: theme.cprof,
			arcLong: theme.arcLong,
			place: theme.place,
			contrastMin: theme.contrastMin,
			contrastMax: theme.contrastMax,
			expand: theme.expand,
			expandSteps: theme.expandSteps,
			harmony: theme.harmony,
			showPoints: theme.showPoints,
			showCurve: theme.showCurve,
			showStops: theme.showStops,
			showPalette: theme.showPalette,
			aa: theme.aa,
			wcagBg: theme.wcagBg
		}
	};
}

export function toSnapshot(appState: AppState): ParameterSnapshot {
	return {
		schemaVersion: CURRENT_SNAPSHOT_VERSION,
		explorer: toPersistedExplorer(appState.explorer),
		camera: cloneCamera(appState.camera)
	};
}

export function applySnapshot(appState: AppState, snapshot: ParameterSnapshot) {
	const { theme: themeSnap, ...explorerSnap } = snapshot.explorer;
	appState.schemaVersion = CURRENT_SNAPSHOT_VERSION;
	Object.assign(appState.explorer, explorerSnap);
	Object.assign(appState.explorer.theme, themeSnap);
	appState.explorer.theme.arm = null;
	appState.explorer.theme.stops = [];
	appState.explorer.theme.grid = [];
	appState.explorer.theme.selectedPoint = null;
	appState.explorer.theme.splineCurve = [];
	appState.explorer.theme.rawStops = [];
	appState.explorer.hover = null;
	Object.assign(appState.camera, snapshot.camera);
}

export function snapshotsEqual(a: ParameterSnapshot, b: ParameterSnapshot) {
	return JSON.stringify(a) === JSON.stringify(b);
}

export function defaultSnapshot(): ParameterSnapshot {
	return toSnapshot(createAppState());
}

export function mergeSnapshot(
	base: ParameterSnapshot,
	partial: {
		explorer?: Partial<ParameterSnapshot['explorer']> & {
			theme?: Partial<ParameterSnapshot['explorer']['theme']>;
		};
	camera?: Partial<Camera>;
	}
): ParameterSnapshot {
	const merged = cloneSnapshot(base);
	if (partial.explorer) {
		const { theme, ...rest } = partial.explorer;
		Object.assign(merged.explorer, rest);
		if (theme) Object.assign(merged.explorer.theme, theme);
	}
	if (partial.camera) Object.assign(merged.camera, partial.camera);
	merged.schemaVersion = CURRENT_SNAPSHOT_VERSION;
	return merged;
}
