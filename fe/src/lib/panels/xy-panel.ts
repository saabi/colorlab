import { m3 } from '$lib/color/math';
import { GAMUTS, rgbToXyzM, waveToXyz } from '$lib/color/pipeline';
import { TRC } from '$lib/color/transfer';
import { fitCanvas } from './canvas';

import type { ExplorerState, TransformChain } from '$lib/engine/types';

let locusCache: Array<[number, number]> | null = null;
let srgbFill: { w: number; h: number; cv: HTMLCanvasElement } | null = null;

export function drawXyPanel(canvas: HTMLCanvasElement, ch: TransformChain | null, state: ExplorerState) {
	const { ctx, w, h } = fitCanvas(canvas);
	ctx.clearRect(0, 0, w, h);
	const x0 = 10;
	const y0 = h - 8;
	const pw = w - 20;
	const ph = h - 16;
	const sx = (x: number) => x0 + (x / 0.8) * pw;
	const sy = (y: number) => y0 - (y / 0.9) * ph;
	if (!locusCache) {
		locusCache = [];
		for (let nm = 402; nm <= 682; nm += 2) {
			const xyz = waveToXyz(nm);
			const S = xyz[0] + xyz[1] + xyz[2];
			if (S > 5e-3) locusCache.push([xyz[0] / S, xyz[1] / S]);
		}
	}
	if (!srgbFill || srgbFill.w !== w || srgbFill.h !== h) {
		const cv = document.createElement('canvas');
		cv.width = w;
		cv.height = h;
		const c2 = cv.getContext('2d');
		if (!c2) return;
		const img = c2.createImageData(w, h);
		const P = GAMUTS.srgb.P;
		const R = [P[0], P[3]];
		const G = [P[1], P[4]];
		const B = [P[2], P[5]];
		const Mi = m3.inv(rgbToXyzM(GAMUTS.srgb.P, GAMUTS.srgb.W));
		const det = (R[0] - B[0]) * (G[1] - B[1]) - (G[0] - B[0]) * (R[1] - B[1]);
		for (let j = 0; j < h; j += 1) {
			for (let i = 0; i < w; i += 1) {
				const x = ((i - x0) * 0.8) / pw;
				const y = ((y0 - j) * 0.9) / ph;
				if (y <= 1e-4) continue;
				const l1 = ((G[1] - B[1]) * (x - B[0]) + (B[0] - G[0]) * (y - B[1])) / det;
				const l2 = ((B[1] - R[1]) * (x - B[0]) + (R[0] - B[0]) * (y - B[1])) / det;
				if (l1 < 0 || l2 < 0 || l1 + l2 > 1) continue;
				let rgb = m3.mulV(Mi, [x / y, 1, (1 - x - y) / y]).map((v) => Math.max(v, 0));
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
		srgbFill = { w, h, cv };
	}
	ctx.drawImage(srgbFill.cv, 0, 0, w, h);
	ctx.strokeStyle = '#5c5d63';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	locusCache.forEach((p, i) => {
		if (i) ctx.lineTo(sx(p[0]), sy(p[1]));
		else ctx.moveTo(sx(p[0]), sy(p[1]));
	});
	ctx.closePath();
	ctx.stroke();
	const Ps = GAMUTS.srgb.P;
	ctx.strokeStyle = '#9a9ba1';
	ctx.lineWidth = 1;
	ctx.beginPath();
	for (let i = 0; i < 3; i += 1) {
		const X = sx(Ps[i]);
		const Y = sy(Ps[3 + i]);
		if (i) ctx.lineTo(X, Y);
		else ctx.moveTo(X, Y);
	}
	ctx.closePath();
	ctx.stroke();
	const P = GAMUTS[state.gamut].P;
	ctx.strokeStyle = '#d6a93a';
	ctx.lineWidth = 1.3;
	if (state.gamut === 'srgb') ctx.setLineDash([4, 3]);
	ctx.beginPath();
	for (let i = 0; i < 3; i += 1) {
		const X = sx(P[i]);
		const Y = sy(P[3 + i]);
		if (i) ctx.lineTo(X, Y);
		else ctx.moveTo(X, Y);
	}
	ctx.closePath();
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.font = '9px "IBM Plex Mono", monospace';
	ctx.fillStyle = '#d6a93a';
	ctx.fillText('in: ' + GAMUTS[state.gamut].label, x0 + 2, 12);
	ctx.fillStyle = '#9a9ba1';
	ctx.fillText('out: sRGB', x0 + 2, 23);
	if (!ch) return;
	const S = ch.xyz[0] + ch.xyz[1] + ch.xyz[2];
	if (S > 1e-6) {
		const X = sx(ch.xyz[0] / S);
		const Y = sy(ch.xyz[1] / S);
		ctx.fillStyle = '#fff';
		ctx.beginPath();
		ctx.arc(X, Y, 3.5, 0, 7);
		ctx.fill();
		ctx.strokeStyle = '#5fb8c4';
		ctx.stroke();
	}
}
