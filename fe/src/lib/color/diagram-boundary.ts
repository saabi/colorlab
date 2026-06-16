import { type Vec3, m3 } from './math';
import { GAMUTS, SRGB2XYZ, lab2xyz, oklab2lsrgb, rgbToXyzM } from './pipeline';

const EPS = 1e-7;
const FIXED_OKLAB_L = 0.5;
const FIXED_CIELAB_L = 50;

export function isOpponentPlaneDiagram(diagramKey: string): diagramKey is 'oklab-ab' | 'cielab-ab' {
	return diagramKey === 'oklab-ab' || diagramKey === 'cielab-ab';
}

export function opponentPlaneToXyz(diagramKey: string, x: number, y: number): Vec3 | null {
	if (diagramKey === 'oklab-ab') {
		const rgb = oklab2lsrgb([FIXED_OKLAB_L, x, y]);
		return m3.mulV(SRGB2XYZ, rgb);
	}
	if (diagramKey === 'cielab-ab') {
		return lab2xyz([FIXED_CIELAB_L, x, y]);
	}
	return null;
}

export function isXyzInsideGamut(xyz: Vec3, gamutKey: keyof typeof GAMUTS): boolean {
	const isInside = createGamutInclusionTest(gamutKey);
	return isInside(xyz);
}

export function createGamutInclusionTest(gamutKey: keyof typeof GAMUTS): (xyz: Vec3) => boolean {
	const gamut = GAMUTS[gamutKey];
	if (!gamut) return () => false;
	const xyzToRgb = m3.inv(rgbToXyzM(gamut.P, gamut.W));
	return (xyz: Vec3) => {
		const rgb = m3.mulV(xyzToRgb, xyz);
		return rgb.every((v) => v >= -EPS && v <= 1 + EPS);
	};
}

function pointAt(diagramKey: string, hue: number, chroma: number): [number, number] {
	return [Math.cos(hue) * chroma, Math.sin(hue) * chroma];
}

export function generateOpponentPlaneGamutBoundary(
	diagramKey: string,
	gamutKey: keyof typeof GAMUTS,
	segments = 192
): Array<[number, number]> {
	if (!isOpponentPlaneDiagram(diagramKey)) return [];

	const points: Array<[number, number]> = [];
	const safeSegments = Math.max(24, Math.floor(segments));
	const isInside = createGamutInclusionTest(gamutKey);

	for (let i = 0; i < safeSegments; i += 1) {
		const hue = (i / safeSegments) * Math.PI * 2;
		let lo = 0;
		let hi = 0.25;

		for (let guard = 0; guard < 12; guard += 1) {
			const pt = pointAt(diagramKey, hue, hi);
			const xyz = opponentPlaneToXyz(diagramKey, pt[0], pt[1]);
			if (!xyz || !isInside(xyz)) break;
			lo = hi;
			hi *= 2;
		}

		for (let iter = 0; iter < 24; iter += 1) {
			const mid = (lo + hi) * 0.5;
			const pt = pointAt(diagramKey, hue, mid);
			const xyz = opponentPlaneToXyz(diagramKey, pt[0], pt[1]);
			if (xyz && isInside(xyz)) lo = mid;
			else hi = mid;
		}

		points.push(pointAt(diagramKey, hue, lo));
	}

	return points;
}
