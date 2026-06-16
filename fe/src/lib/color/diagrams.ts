import { type Vec3 } from './math';

export interface ChromaticityDiagram {
	key: string;
	label: string;
	xAxisLabel: string;
	yAxisLabel: string;
	// Projects XYZ and/or LMS coordinates onto 2D chromaticity space
	project(xyz: Vec3, lms: Vec3): [number, number];
}

export const DIAGRAMS: Record<string, ChromaticityDiagram> = {
	'cie1931-xy': {
		key: 'cie1931-xy',
		label: 'CIE 1931 (x, y)',
		xAxisLabel: 'x',
		yAxisLabel: 'y',
		project: (xyz) => {
			const [X, Y, Z] = xyz;
			const sum = X + Y + Z;
			if (sum <= 0) return [0.0, 0.0];
			return [X / sum, Y / sum];
		}
	},
	'cie1976-upvp': {
		key: 'cie1976-upvp',
		label: "CIE 1976 UCS (u', v')",
		xAxisLabel: "u'",
		yAxisLabel: "v'",
		project: (xyz) => {
			const [X, Y, Z] = xyz;
			const denom = X + 15 * Y + 3 * Z;
			if (denom <= 0) return [0.0, 0.0];
			return [(4 * X) / denom, (9 * Y) / denom];
		}
	},
	'cie1960-uv': {
		key: 'cie1960-uv',
		label: 'CIE 1960 UCS (u, v)',
		xAxisLabel: 'u',
		yAxisLabel: 'v',
		project: (xyz) => {
			const [X, Y, Z] = xyz;
			const denom = X + 15 * Y + 3 * Z;
			if (denom <= 0) return [0.0, 0.0];
			return [(4 * X) / denom, (6 * Y) / denom];
		}
	},
	'macleod-boynton': {
		key: 'macleod-boynton',
		label: 'MacLeod-Boynton (l, s)',
		xAxisLabel: 'l = L / (L+M)',
		yAxisLabel: 's = S / (L+M)',
		project: (xyz, lms) => {
			const [L, M, S] = lms;
			const sumLM = L + M;
			if (sumLM <= 0) return [0.0, 0.0];
			return [L / sumLM, S / sumLM];
		}
	}
};
