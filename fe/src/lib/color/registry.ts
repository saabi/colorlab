import { m3, type Mat3, type Vec3 } from './math';
import { CUBE_ROTi, lab2xyz, oklab2lsrgb } from './pipeline';

import type { SpaceMode } from '$lib/engine/types';

export interface GamutConversion {
	toSrgb: Mat3;
	fromSrgb: Mat3;
}

export interface SpaceDefinition {
	label: string;
	arrange?: {
		perm: Vec3;
		scale: Vec3;
		off: Vec3;
	};
	fromWorld(world: Vec3, rgbToXyz: Mat3, toSrgbLin: GamutConversion): Vec3;
}

export const SPACES: Record<SpaceMode, SpaceDefinition> = {
	0: {
		label: 'Linear RGB cube',
		fromWorld: (p) => {
			const c = m3.mulV(CUBE_ROTi, p);
			return [c[0] + 0.5, c[1] + 0.5, c[2] + 0.5];
		}
	},
	5: {
		label: 'Luminance romboid',
		fromWorld: (p) => {
			const c = m3.mulV(CUBE_ROTi, p);
			return [c[0] + 0.5, c[1] + 0.5, c[2] + 0.5];
		}
	},
	1: {
		label: 'CIE XYZ',
		arrange: { perm: [0, 1, 2], scale: [1, 1, 1], off: [-0.48, -0.5, -0.54] },
		fromWorld: (p, M) => m3.mulV(m3.inv(M), [p[0] + 0.48, p[1] + 0.5, p[2] + 0.54])
	},
	2: {
		label: 'CIELAB (deprecated)',
		arrange: { perm: [1, 0, 2], scale: [0.01, 0.01, 0.01], off: [0, -0.5, 0] },
		fromWorld: (p, M) => m3.mulV(m3.inv(M), lab2xyz([p[1] * 100 + 50, p[0] * 100, p[2] * 100]))
	},
	3: {
		label: 'Oklab',
		arrange: { perm: [1, 0, 2], scale: [2.2, 1, 2.2], off: [0, -0.5, 0] },
		fromWorld: (p, _M, toSrgbLin) => {
			const lab: Vec3 = [p[1] + 0.5, p[0] / 2.2, p[2] / 2.2];
			const s = oklab2lsrgb(lab);
			return m3.mulV(toSrgbLin.fromSrgb, s);
		}
	}
};
