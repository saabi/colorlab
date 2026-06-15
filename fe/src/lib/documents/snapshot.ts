import { createAppState } from '$lib/engine/state.svelte';

import type { AppState, AxisSpreadConfig, ConstraintConfig, ExplorerState, ListPipeline, PersistedExplorer, RampList } from '$lib/engine/types';
import type { Camera } from '$lib/engine/camera';
import { CURRENT_SNAPSHOT_VERSION, type ParameterSnapshot } from './types';

function cloneSpread(g: AxisSpreadConfig): AxisSpreadConfig {
	return {
		count: g.count,
		hue: { delta: g.hue.delta, dir: g.hue.dir },
		chroma: { delta: g.chroma.delta, dir: g.chroma.dir },
		light: { delta: g.light.delta, dir: g.light.dir }
	};
}

function cloneConstraint(c: ConstraintConfig): ConstraintConfig {
	return {
		constraint: c.constraint,
		projection: c.projection,
		projectionParams: { ...c.projectionParams, method: c.projection }
	};
}

function clonePipeline(p: ListPipeline): ListPipeline {
	return {
		mode: p.mode,
		splineSpace: p.splineSpace,
		interpolateOn: p.interpolateOn,
		placeOn: p.placeOn,
		place: p.place,
		arcLong: p.arcLong,
		contrastMin: p.contrastMin,
		contrastMax: p.contrastMax,
		wcagBg: p.wcagBg,
		steps: p.steps,
		main: cloneConstraint(p.main),
		expandOn: p.expandOn,
		expandRows: cloneSpread(p.expandRows),
		expandCols: cloneSpread(p.expandCols),
		extension: cloneConstraint(p.extension)
	};
}

function cloneRampList(l: RampList): RampList {
	return {
		anchors: l.anchors.map((p) => ({
			srgbLin: [p.srgbLin[0], p.srgbLin[1], p.srgbLin[2]] as [number, number, number]
		})),
		pipeline: clonePipeline(l.pipeline)
	};
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
		chromaticityOverlay: explorer.chromaticityOverlay,
		planeOutline: explorer.planeOutline,
		cylinderOutline: explorer.cylinderOutline,
		outlineDepthTest: explorer.outlineDepthTest,
		surfaceGridAlpha: explorer.surfaceGridAlpha,
		solidAlpha: explorer.solidAlpha,
		hideAids: explorer.hideAids,
		pinPalette: explorer.pinPalette,
		openSteps: [...explorer.openSteps],
		guideNote: explorer.guideNote,
		guideNotePlacement: explorer.guideNotePlacement,
		guideNoteDismissed: explorer.guideNoteDismissed,
		cvd: explorer.cvd,
		cvdSev: explorer.cvdSev,
		theme: {
			lists: theme.lists.map(cloneRampList),
			activeList: theme.activeList,
			gamutMap: theme.gamutMap,
			gamutMapParams: { ...theme.gamutMapParams },
			showPoints: theme.showPoints,
			showCurve: theme.showCurve,
			showStops: theme.showStops,
			showPalette: theme.showPalette
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
	appState.explorer.theme.curves = [];
	appState.explorer.theme.rawRows = [];
	appState.explorer.theme.rows = [];
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
