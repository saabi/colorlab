import { m3, type Vec3 } from './math';
import { GAMUTS, rgbToXyzM, lsrgb2oklab, xyz2lab } from './pipeline';
import { interpolateDataset } from './fundamentals';
import { smb_cc_2deg_1nm } from './data/smb_cc_2deg_1nm';

export interface ChromaticityDiagram {
	key: string;
	label: string;
	xAxisLabel: string;
	yAxisLabel: string;
	// Projects XYZ and/or LMS coordinates onto 2D chromaticity space
	project(xyz: Vec3, lms: Vec3): [number, number];
	// Optional source-table projection for spectral locus coordinates.
	projectWavelength?: (nm: number) => [number, number];
	kind?: 'chromaticity' | 'opponent-plane' | 'experimental';
}

const SRGB_XYZ = rgbToXyzM(GAMUTS.srgb.P, GAMUTS.srgb.W);
const XYZ2SRGB = m3.inv(SRGB_XYZ);

export const DIAGRAMS: Record<string, ChromaticityDiagram> = {
	'cie1931-xy': {
		key: 'cie1931-xy',
		label: 'CIE 1931 (x, y)',
		xAxisLabel: 'x',
		yAxisLabel: 'y',
		kind: 'chromaticity',
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
		kind: 'chromaticity',
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
		kind: 'chromaticity',
		project: (xyz) => {
			const [X, Y, Z] = xyz;
			const denom = X + 15 * Y + 3 * Z;
			if (denom <= 0) return [0.0, 0.0];
			return [(4 * X) / denom, (6 * Y) / denom];
		}
	},
	'macleod-boynton': {
		key: 'macleod-boynton',
		label: 'MacLeod-Boynton locus (experimental stimulus projection)',
		xAxisLabel: 'l',
		yAxisLabel: 's',
		kind: 'experimental',
		project: (xyz, lms) => {
			const [L, M, S] = lms;
			const sumLM = L + M;
			if (sumLM <= 0) return [0.0, 0.0];
			return [L / sumLM, S / sumLM];
		},
		projectWavelength: (nm) => {
			const l = interpolateDataset(smb_cc_2deg_1nm, nm, 'Mb1');
			const s = interpolateDataset(smb_cc_2deg_1nm, nm, 'Mb3');
			return [l, s];
		}
	},
	'oklab-ab': {
		key: 'oklab-ab',
		label: 'Oklab a/b plane (L fixed)',
		xAxisLabel: 'a',
		yAxisLabel: 'b',
		kind: 'opponent-plane',
		project: (xyz) => {
			const srgbLin = m3.mulV(XYZ2SRGB, xyz);
			const ok = lsrgb2oklab(srgbLin);
			const fixedL = 0.5;
			const scale = Math.abs(ok[0]) > 1e-9 ? fixedL / ok[0] : 0;
			return [ok[1] * scale, ok[2] * scale];
		}
	},
	'cielab-ab': {
		key: 'cielab-ab',
		label: 'CIELAB a*/b* plane (L* fixed)',
		xAxisLabel: 'a*',
		yAxisLabel: 'b*',
		kind: 'opponent-plane',
		project: (xyz) => {
			// Project every stimulus onto one L* slice so the plane is not mixed
			// with the spectrum's native luminous-efficiency variation.
			const fixedY = 0.18418651851244416; // lab2xyz([50, 0, 0])[1] for D65.
			const scale = xyz[1] > 1e-12 ? fixedY / xyz[1] : 0;
			const lab = xyz2lab([xyz[0] * scale, xyz[1] * scale, xyz[2] * scale]);
			return [lab[1], lab[2]];
		}
	}
};
