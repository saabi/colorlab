import { m3, type Vec3 } from '$lib/color/math';
import { GAMUTS, rgbToXyzM } from '$lib/color/pipeline';
import { TRC } from '$lib/color/transfer';
import { fitCanvas } from './canvas';
import { SPECTRUM_NM_MAX, SPECTRUM_NM_MIN } from './spectrum-panel';
import { DEFAULT_OBSERVERS } from '$lib/color/fundamentals';
import { DIAGRAMS } from '$lib/color/diagrams';

import type { ExplorerState, TransformChain } from '$lib/engine/types';

interface CachedLocus {
	observerKey: string;
	diagramKey: string;
	points: Array<[number, number]>;
}

interface CachedFill {
	w: number;
	h: number;
	observerKey: string;
	diagramKey: string;
	cv: HTMLCanvasElement;
}

let locusCache: CachedLocus | null = null;
let srgbFill: CachedFill | null = null;

// Standard sRGB CMF inverse matrix to check sRGB gamut inclusion
const XYZ2SRGB = m3.inv(rgbToXyzM(GAMUTS.srgb.P, GAMUTS.srgb.W));

/**
 * Unprojects 2D chromaticity coordinates back to XYZ (with Y = 1.0)
 */
function unproject2d(x: number, y: number, diagramKey: string): Vec3 | null {
	if (diagramKey === 'cie1931-xy' || diagramKey === 'macleod-boynton') {
		// MacLeod-Boynton background is approximated with xy-like mapping for simplicity
		if (y <= 1e-4) return null;
		return [x / y, 1.0, (1.0 - x - y) / y];
	}
	if (diagramKey === 'cie1976-upvp' || diagramKey === 'cie1960-uv') {
		let u = x;
		let v = y;
		if (diagramKey === 'cie1960-uv') {
			v = y * 1.5; // v' = 1.5 * v
		}
		if (v <= 1e-4) return null;
		// Inverse u'v' -> XYZ:
		// X = 9u' / 4v', Y = 1.0, Z = (12 - 3u' - 20v') / 4v'
		return [(9 * u) / (4 * v), 1.0, (12 - 3 * u - 20 * v) / (4 * v)];
	}
	return null;
}

export function drawXyPanel(canvas: HTMLCanvasElement, ch: TransformChain | null, state: ExplorerState) {
	const { ctx, w, h } = fitCanvas(canvas);
	ctx.clearRect(0, 0, w, h);

	const obsKey = state.observerModel || 'stockman-sharpe-2deg';
	const diagKey = state.chromaticityDiagram || 'cie1931-xy';

	const observer = DEFAULT_OBSERVERS[obsKey] || DEFAULT_OBSERVERS['stockman-sharpe-2deg'];
	const diagram = DIAGRAMS[diagKey] || DIAGRAMS['cie1931-xy'];

	// Establish coordinates mapping depending on the diagram type
	let xMin = 0.0, xMax = 0.8, yMin = 0.0, yMax = 0.9;
	if (diagKey === 'cie1976-upvp') {
		xMin = 0.0; xMax = 0.7; yMin = 0.0; yMax = 0.7;
	} else if (diagKey === 'cie1960-uv') {
		xMin = 0.0; xMax = 0.6; yMin = 0.0; yMax = 0.6;
	} else if (diagKey === 'macleod-boynton') {
		xMin = 0.4; xMax = 1.0; yMin = 0.0; yMax = 0.08;
	}

	const xRange = xMax - xMin;
	const yRange = yMax - yMin;

	const x0 = 10;
	const y0 = h - 8;
	const pw = w - 20;
	const ph = h - 16;

	const sx = (x: number) => x0 + ((x - xMin) / xRange) * pw;
	const sy = (y: number) => y0 - ((y - yMin) / yRange) * ph;

	// 1. Rebuild Locus Cache if needed
	if (!locusCache || locusCache.observerKey !== obsKey || locusCache.diagramKey !== diagKey) {
		const points: Array<[number, number]> = [];
		for (let nm = SPECTRUM_NM_MIN; nm <= SPECTRUM_NM_MAX; nm += 2) {
			const lms = observer.evaluateLms(nm);
			const xyz = observer.evaluateXyz(nm);
			const pt = diagram.project(xyz, lms);
			points.push(pt);
		}
		locusCache = { observerKey: obsKey, diagramKey: diagKey, points };
	}

	// 2. Rebuild sRGB Gamut Background Fill if needed
	if (!srgbFill || srgbFill.w !== w || srgbFill.h !== h || srgbFill.observerKey !== obsKey || srgbFill.diagramKey !== diagKey) {
		const cv = document.createElement('canvas');
		cv.width = w;
		cv.height = h;
		const c2 = cv.getContext('2d');
		if (c2) {
			const img = c2.createImageData(w, h);
			
			// Compute 2D coordinates of sRGB primaries
			const srgbMat = rgbToXyzM(GAMUTS.srgb.P, GAMUTS.srgb.W);
			const rXyz: Vec3 = [srgbMat[0], srgbMat[3], srgbMat[6]];
			const gXyz: Vec3 = [srgbMat[1], srgbMat[4], srgbMat[7]];
			const bXyz: Vec3 = [srgbMat[2], srgbMat[5], srgbMat[8]];

			const r2d = diagram.project(rXyz, m3.mulV(observer.toLmsMatrix, rXyz));
			const g2d = diagram.project(gXyz, m3.mulV(observer.toLmsMatrix, gXyz));
			const b2d = diagram.project(bXyz, m3.mulV(observer.toLmsMatrix, bXyz));

			// Barycentric boundary check helper for drawing gamut triangle
			const det = (r2d[0] - b2d[0]) * (g2d[1] - b2d[1]) - (g2d[0] - b2d[0]) * (r2d[1] - b2d[1]);

			for (let j = 0; j < h; j += 1) {
				for (let i = 0; i < w; i += 1) {
					const x = xMin + ((i - x0) * xRange) / pw;
					const y = yMin + ((y0 - j) * yRange) / ph;

					// Check if pixel is inside the projected sRGB triangle
					const l1 = ((g2d[1] - b2d[1]) * (x - b2d[0]) + (b2d[0] - g2d[0]) * (y - b2d[1])) / det;
					const l2 = ((b2d[1] - r2d[1]) * (x - b2d[0]) + (r2d[0] - b2d[0]) * (y - b2d[1])) / det;
					if (l1 < 0 || l2 < 0 || l1 + l2 > 1.001) continue;

					// Unproject 2D diagram coordinate back to standard sRGB linear
					const xyzVal = unproject2d(x, y, diagKey);
					if (!xyzVal) continue;

					let rgb = m3.mulV(XYZ2SRGB, xyzVal).map((v) => Math.max(v, 0));
					const mx = Math.max(...rgb, 1e-6);
					rgb = rgb.map((v) => TRC.srgb.enc(v / mx));
					
					const idx = (j * w + i) * 4;
					img.data[idx] = rgb[0] * 255;
					img.data[idx + 1] = rgb[1] * 255;
					img.data[idx + 2] = rgb[2] * 255;
					img.data[idx + 3] = 185;
				}
			}
			c2.putImageData(img, 0, 0);
		}
		srgbFill = { w, h, observerKey: obsKey, diagramKey: diagKey, cv };
	}

	// Draw background
	ctx.drawImage(srgbFill.cv, 0, 0, w, h);

	// Draw Locus Rim
	ctx.strokeStyle = '#5c5d63';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	locusCache.points.forEach((p, i) => {
		if (i) ctx.lineTo(sx(p[0]), sy(p[1]));
		else ctx.moveTo(sx(p[0]), sy(p[1]));
	});
	ctx.closePath();
	ctx.stroke();

	// Draw sRGB Gamut Boundary
	const srgbMat = rgbToXyzM(GAMUTS.srgb.P, GAMUTS.srgb.W);
	const rXyz: Vec3 = [srgbMat[0], srgbMat[3], srgbMat[6]];
	const gXyz: Vec3 = [srgbMat[1], srgbMat[4], srgbMat[7]];
	const bXyz: Vec3 = [srgbMat[2], srgbMat[5], srgbMat[8]];

	const r2d = diagram.project(rXyz, m3.mulV(observer.toLmsMatrix, rXyz));
	const g2d = diagram.project(gXyz, m3.mulV(observer.toLmsMatrix, gXyz));
	const b2d = diagram.project(bXyz, m3.mulV(observer.toLmsMatrix, bXyz));

	ctx.strokeStyle = '#9a9ba1';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(sx(r2d[0]), sy(r2d[1]));
	ctx.lineTo(sx(g2d[0]), sy(g2d[1]));
	ctx.lineTo(sx(b2d[0]), sy(b2d[1]));
	ctx.closePath();
	ctx.stroke();

	// Draw Active Gamut Boundary
	const g = GAMUTS[state.gamut];
	const actMat = rgbToXyzM(g.P, g.W);
	const arXyz: Vec3 = [actMat[0], actMat[3], actMat[6]];
	const agXyz: Vec3 = [actMat[1], actMat[4], actMat[7]];
	const abXyz: Vec3 = [actMat[2], actMat[5], actMat[8]];

	const ar2d = diagram.project(arXyz, m3.mulV(observer.toLmsMatrix, arXyz));
	const ag2d = diagram.project(agXyz, m3.mulV(observer.toLmsMatrix, agXyz));
	const ab2d = diagram.project(abXyz, m3.mulV(observer.toLmsMatrix, abXyz));

	ctx.strokeStyle = '#d6a93a';
	ctx.lineWidth = 1.3;
	if (state.gamut === 'srgb') ctx.setLineDash([4, 3]);
	ctx.beginPath();
	ctx.moveTo(sx(ar2d[0]), sy(ar2d[1]));
	ctx.lineTo(sx(ag2d[0]), sy(ag2d[1]));
	ctx.lineTo(sx(ab2d[0]), sy(ab2d[1]));
	ctx.closePath();
	ctx.stroke();
	ctx.setLineDash([]);

	// Draw Hovered stimulus marker
	ctx.font = '9px "IBM Plex Mono", monospace';
	ctx.fillStyle = '#d6a93a';
	if (ch) {
		const ch2d = diagram.project(ch.xyz, ch.lms);
		ctx.fillStyle = '#fff';
		ctx.strokeStyle = '#000';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(sx(ch2d[0]), sy(ch2d[1]), 3.6, 0, Math.PI * 2);
		ctx.stroke();
		ctx.fill();

		ctx.fillStyle = '#9a9ba1';
		ctx.textAlign = 'left';
		ctx.fillText(
			`${diagram.xAxisLabel}=${ch2d[0].toFixed(3)} ${diagram.yAxisLabel}=${ch2d[1].toFixed(3)}`,
			x0 + 4,
			y0 - ph + 10
		);
	}
}
