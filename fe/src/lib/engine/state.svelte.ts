import { createCamera } from './camera';

import type { AppState, ExplorerState } from './types';
import type { Camera } from './camera';

export const EXAMPLE_ID_PREFIX = 'example:';

type PartialTheme = Partial<Omit<ExplorerState['theme'], 'stops'>>;
type ExamplePartial = {
	explorer?: Partial<Omit<ExplorerState, 'theme' | 'hover'>> & { theme?: PartialTheme };
	camera?: Partial<Camera>;
};

function createExplorerDefaults(): ExplorerState {
	return {
		spaceMode: 3,
		gamut: 'srgb',
		N: 256,
		slice: true,
		planeMode: 'L',
		off: 0.5,
		az: 0,
		el: 90,
		eps: 0.0,
		floor: true,
		lines: true,
		cutAbove: true,
		cutBelow: false,
		cylSlice: false,
		cylRad: 0.2,
		shell: 'none',
		planeOutline: true,
		cylinderOutline: true,
		outlineDepthTest: true,
		surfaceGridAlpha: 0.25,
		cvd: 'none',
		cvdSev: 1,
		theme: {
			A: null,
			B: null,
			steps: 5,
			arm: null,
			mode: 'seg',
			stops: [],
			dh: 40,
			dc: 0.0,
			cprof: 'linear',
			arcLong: false,
			aa: 4.5,
			wcagBg: 'white'
		},
		hover: null
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

export function cloneAppState(state: AppState): AppState {
	return JSON.parse(JSON.stringify(state)) as AppState;
}

export function createAppState(options: { mobile?: boolean } = {}): AppState {
	const state: AppState = {
		schemaVersion: 2,
		explorer: createExplorerDefaults(),
		camera: createCamera()
	};
	if (options.mobile) state.explorer.N = 128;
	return state;
}

export function createExplorerState(): ExplorerState {
	return createAppState().explorer;
}

export function createExampleState(partial: ExamplePartial): AppState {
	const state = createAppState();
	if (partial.explorer) {
		const { theme, ...explorer } = partial.explorer;
		Object.assign(state.explorer, explorer);
		if (theme) Object.assign(state.explorer.theme, theme);
	}
	if (partial.camera) Object.assign(state.camera, partial.camera);
	state.camera = cloneCamera(state.camera);
	return state;
}

export const EXAMPLE_STATES = [
	{
		id: 'example:oklab-l-slice',
		name: 'Oklab L-slice',
		source: 'example' as const,
		snapshot: createExampleState({
			explorer: {
				spaceMode: 3,
				slice: true,
				planeMode: 'L',
				off: 0.55
			},
			camera: { yaw: 0.9, pitch: 0.35 }
		})
	},
	{
		id: 'example:p3-shell',
		name: 'Display P3 + shell',
		source: 'example' as const,
		snapshot: createExampleState({
			explorer: {
				gamut: 'p3',
				shell: 'p3',
				cylSlice: true,
				cylRad: 0.35
			},
			camera: { dist: 3.2 }
		})
	}
];

export function isExampleId(id: string) {
	return id.startsWith(EXAMPLE_ID_PREFIX);
}
