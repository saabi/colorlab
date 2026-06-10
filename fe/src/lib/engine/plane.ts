import type { Vec3 } from '$lib/color/math';
import type { ExplorerState } from './types';

export function planeND(state: ExplorerState): { n: Vec3; d: number } {
	const d = state.off - 0.5;
	if (state.planeMode === 'L') return { n: [0, 1, 0], d };
	const azr = (state.az * Math.PI) / 180;
	if (state.planeMode === 'H') return { n: [Math.cos(azr), 0, Math.sin(azr)], d };
	const elr = (state.el * Math.PI) / 180;
	return {
		n: [Math.cos(elr) * Math.cos(azr), Math.sin(elr), Math.cos(elr) * Math.sin(azr)],
		d
	};
}
