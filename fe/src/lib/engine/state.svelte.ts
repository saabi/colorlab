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
		id: 'example:large-color-ramp',
		name: 'Large Color Ramp',
		source: 'example' as const,
		snapshot: createExampleState({
			explorer: {
				spaceMode: 3,
				gamut: 'srgb',
				N: 256,
				slice: false,
				planeMode: 'L',
				off: 1,
				az: 0,
				el: 90,
				eps: 0,
				floor: true,
				lines: true,
				cutAbove: true,
				cutBelow: false,
				cylSlice: true,
				cylRad: 0.361,
				shell: 'none',
				planeOutline: true,
				cylinderOutline: true,
				outlineDepthTest: true,
				surfaceGridAlpha: 0.25,
				cvd: 'none',
				cvdSev: 1,
				theme: {
					A: {
						srgbLin: [0.002353332407759444, 0.0038332058213883316, 0.17366576656361682]
					},
					B: {
						srgbLin: [0.7610351858718939, 0.9402926643687034, 0.15604940886754892]
					},
					steps: 11,
					mode: 'arc',
					dh: 40,
					dc: 0,
					cprof: 'linear',
					arcLong: true,
					aa: 4.5,
					wcagBg: 'white'
				}
			},
			camera: {
				yaw: 1.355999999999995,
				pitch: 0.31399999999999906,
				dist: 1.5765230034944007,
				target: [0.05967533848186085, 0.09576925068959358, -0.09536971427920843],
				fov: 0.7853981633974483
			}
		})
	},
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
