import { m3, type Vec3 } from './math';
import { GAMUTS, rgbToXyzM, lsrgb2oklab, xyz2lab } from './pipeline';
import { DEFAULT_OBSERVERS, interpolateDataset } from './fundamentals';
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

const MB_L_SCALE = 1.9806536312072827;
const MB_S_SCALE = 0.10668241929719655;

export function lmsToMacLeodBoynton(lms: Vec3): [number, number] {
	const [L, M, S] = lms;
	const denom = MB_L_SCALE * L + M;
	if (denom <= 0) return [0, 0];
	return [(MB_L_SCALE * L) / denom, (MB_S_SCALE * S) / denom];
}

export function xyzToMacLeodBoynton2Deg(xyz: Vec3): [number, number] {
	const sourceObserver = DEFAULT_OBSERVERS['stockman-sharpe-2deg'];
	return lmsToMacLeodBoynton(m3.mulV(sourceObserver.toLmsMatrix, xyz));
}

export function macLeodBoynton2DegToXyz(l: number, s: number): Vec3 | null {
	if (!Number.isFinite(l) || !Number.isFinite(s) || l < 0 || l > 1 || s < 0) return null;
	const sourceObserver = DEFAULT_OBSERVERS['stockman-sharpe-2deg'];
	// MacLeod-Boynton chromaticity is scale-invariant. Use denominator = 1
	// to recover a source-basis LMS direction, then convert that direction to XYZ.
	const lms: Vec3 = [l / MB_L_SCALE, 1 - l, s / MB_S_SCALE];
	return m3.mulV(sourceObserver.toXyzMatrix, lms);
}

function observerCoordinateLabel(observerKey: string): string {
	if (observerKey.includes('stockman-sharpe-10deg') || observerKey.includes('ss10deg')) return 'CIE 2006 10° xF yF';
	if (observerKey.includes('stockman-sharpe-2deg') || observerKey.includes('ss2deg')) return 'CIE 2006 2° xF yF';
	if (observerKey.includes('ciexyz64') || observerKey.includes('1964')) return 'CIE 1964 10° x10 y10';
	if (observerKey.includes('ciexyzjv')) return 'Judd-Vos 1978 2° xy';
	if (observerKey.includes('ciexyzj')) return 'Judd 1951 2° xy';
	return 'CIE 1931 2° xy';
}

function observerName(observerKey: string): string {
	if (observerKey.includes('stockman-sharpe-10deg') || observerKey.includes('ss10deg')) return 'CIE 2006 10° observer';
	if (observerKey.includes('stockman-sharpe-2deg') || observerKey.includes('ss2deg')) return 'CIE 2006 2° observer';
	if (observerKey.includes('ciexyz64') || observerKey.includes('1964')) return 'CIE 1964 10° observer';
	if (observerKey.includes('ciexyzjv')) return 'Judd-Vos 1978 2° observer';
	if (observerKey.includes('ciexyzj')) return 'Judd 1951 2° observer';
	return 'CIE 1931 2° observer';
}

export function diagramDisplayLabel(diagramKey: string, observerKey: string): string {
	switch (diagramKey) {
		case 'cie1931-xy':
			return observerCoordinateLabel(observerKey);
		case 'cie1976-upvp':
			return `CIE 1976 UCS u'v' - ${observerName(observerKey)}`;
		case 'cie1960-uv':
			return `CIE 1960 UCS uv - ${observerName(observerKey)}`;
		case 'macleod-boynton':
			return 'MacLeod-Boynton 2° (l, s)';
		case 'oklab-ab':
			return 'Oklab a/b plane (L fixed)';
		case 'cielab-ab':
			return 'CIELAB a*/b* plane (L* fixed)';
		default:
			return DIAGRAMS[diagramKey]?.label ?? 'Chromaticity';
	}
}

export function diagramShortLabel(diagramKey: string): string {
	switch (diagramKey) {
		case 'cie1931-xy':
			return 'xy';
		case 'cie1976-upvp':
			return "u'v'";
		case 'cie1960-uv':
			return 'uv';
		case 'macleod-boynton':
			return 'l s';
		case 'oklab-ab':
			return 'a b';
		case 'cielab-ab':
			return 'a*b*';
		default:
			return 'xy';
	}
}

/** Inspector/sidebar footnote for the active chromaticity or plane view. */
export function diagramInspectorNote(diagramKey: string): string {
	switch (diagramKey) {
		case 'macleod-boynton':
			return 'Bundled CIE MacLeod-Boynton 2° table and Stockman-Sharpe 2° LMS basis — independent of the Observer model above.';
		case 'oklab-ab':
		case 'cielab-ab':
			return 'Fixed-lightness opponent-plane cross-section, not a chromaticity diagram.';
		case 'cie1931-xy':
		case 'cie1976-upvp':
		case 'cie1960-uv':
			return 'Chromaticity projection of the active observer\'s XYZ coordinates.';
		default:
			return 'General colors are tristimulus excitations, not points on the spectral locus.';
	}
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
		label: 'MacLeod-Boynton 2° (l, s)',
		xAxisLabel: 'l',
		yAxisLabel: 's',
		kind: 'chromaticity',
		project: (xyz) => {
			return xyzToMacLeodBoynton2Deg(xyz);
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
