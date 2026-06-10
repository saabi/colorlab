import { createCamera, type Camera } from '$lib/engine/camera';
import { createExplorerState } from '$lib/engine/state.svelte';

import type { ExplorerState, ThemeAnchor } from '$lib/engine/types';
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

export function toSnapshot(explorer: ExplorerState, camera: Camera): ParameterSnapshot {
	const theme = explorer.theme;
	return {
		schemaVersion: CURRENT_SNAPSHOT_VERSION,
		explorer: {
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
			cylInside: explorer.cylInside,
			shell: explorer.shell,
			planeOutline: explorer.planeOutline,
			cylinderOutline: explorer.cylinderOutline,
			surfaceGridAlpha: explorer.surfaceGridAlpha,
			cvd: explorer.cvd,
			cvdSev: explorer.cvdSev,
			theme: {
				A: cloneAnchor(theme.A),
				B: cloneAnchor(theme.B),
				steps: theme.steps,
				mode: theme.mode,
				dh: theme.dh,
				dc: theme.dc,
				cprof: theme.cprof,
				arcLong: theme.arcLong,
				aa: theme.aa,
				wcagBg: theme.wcagBg
			}
		},
		camera: cloneCamera(camera)
	};
}

export function applySnapshot(explorer: ExplorerState, camera: Camera, snapshot: ParameterSnapshot) {
	const { theme: themeSnap, ...explorerSnap } = snapshot.explorer;
	Object.assign(explorer, explorerSnap);
	Object.assign(explorer.theme, themeSnap);
	explorer.theme.arm = null;
	explorer.theme.stops = [];
	explorer.hover = null;
	Object.assign(camera, snapshot.camera);
}

export function snapshotsEqual(a: ParameterSnapshot, b: ParameterSnapshot) {
	return JSON.stringify(a) === JSON.stringify(b);
}

export function defaultSnapshot(): ParameterSnapshot {
	return toSnapshot(createExplorerState(), createCamera());
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
