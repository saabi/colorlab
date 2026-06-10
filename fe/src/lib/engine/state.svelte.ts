import type { ExplorerState } from './types';

export function createExplorerState(): ExplorerState {
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
