import type { ExplorerState } from './types';

export function createExplorerState(): ExplorerState {
	return {
		spaceMode: 3,
		gamut: 'srgb',
		N: 128,
		slice: true,
		planeMode: 'L',
		off: 0,
		az: 25,
		el: 90,
		eps: 0.01,
		floor: true,
		lines: true,
		cutAbove: true,
		cutBelow: true,
		shell: 'none',
		outline: true,
		cvd: 'none',
		cvdSev: 1,
		theme: {
			A: null,
			B: null,
			steps: 7,
			arm: null,
			mode: 'seg',
			stops: [],
			dh: 40,
			dc: 0.1,
			cprof: 'linear',
			aa: 4.5,
			wcagBg: 'white'
		},
		hover: null
	};
}
