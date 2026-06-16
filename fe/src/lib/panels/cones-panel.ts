import { GAMUTS, rgbToXyzM } from '$lib/color/pipeline';
import { m3, type Mat3 } from '$lib/color/math';
import { TRC } from '$lib/color/transfer';
import { simulateCvdSrgb } from '$lib/color/cvd';
import { fitCanvas } from './canvas';
import { DEFAULT_OBSERVERS } from '$lib/color/fundamentals';
import {
	CONE_PANEL_NM_MAX,
	CONE_PANEL_NM_MIN,
	dominantWavelength,
	spectrumColor
} from './spectrum-panel';

import type { ExplorerState, TransformChain } from '$lib/engine/types';

let spectrumCache: { key: string; cv: HTMLCanvasElement } | null = null;

function drawSpectrumBackground(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	nmA: number,
	nmB: number,
	state: ExplorerState
) {
	const key = `${w}:${nmA}:${nmB}:${state.cvd}:${state.cvdSev.toFixed(3)}:${state.observerModel}`;
	if (!spectrumCache || spectrumCache.key !== key) {
		const cv = document.createElement('canvas');
		cv.width = w;
		cv.height = 1;
		const c2 = cv.getContext('2d');
		if (!c2) return;
		const img = c2.createImageData(w, 1);
		
		const observer = DEFAULT_OBSERVERS[state.observerModel] || DEFAULT_OBSERVERS['stockman-sharpe-2deg'];
		const srgb2xyz = rgbToXyzM(GAMUTS.srgb.P, GAMUTS.srgb.W);
		const rgb2lms = m3.mul(observer.toLmsMatrix, srgb2xyz);
		const lms2rgb = m3.mul(m3.inv(srgb2xyz), observer.toXyzMatrix);

		for (let i = 0; i < w; i += 1) {
			const nm = nmA + ((nmB - nmA) * i) / Math.max(w - 1, 1);
			const rgb = spectrumColor(nm);
			const lin = rgb.map((v) => TRC.srgb.dec(v / 255)) as [number, number, number];
			const sim = simulateCvdSrgb(lin, state.cvd, state.cvdSev, rgb2lms, lms2rgb);
			const enc = sim.map((v) => Math.round(TRC.srgb.enc(Math.min(Math.max(v, 0), 1)) * 255));
			img.data[i * 4] = enc[0];
			img.data[i * 4 + 1] = enc[1];
			img.data[i * 4 + 2] = enc[2];
			img.data[i * 4 + 3] = 255;
		}
		c2.putImageData(img, 0, 0);
		spectrumCache = { key, cv };
	}
	ctx.save();
	ctx.globalAlpha = 0.36;
	ctx.drawImage(spectrumCache.cv, x, y, w, h);
	ctx.globalAlpha = 1;
	const fade = ctx.createLinearGradient(0, y, 0, y + h);
	fade.addColorStop(0, 'rgba(17, 18, 22, 0.18)');
	fade.addColorStop(1, 'rgba(17, 18, 22, 0.72)');
	ctx.fillStyle = fade;
	ctx.fillRect(x, y, w, h);
	ctx.restore();
}

export function drawConesPanel(canvas: HTMLCanvasElement, ch: TransformChain | null, state: ExplorerState) {
	const { ctx, w, h } = fitCanvas(canvas);
	ctx.clearRect(0, 0, w, h);
	const x0 = 6;
	const y0 = h - 8;
	const pw = w - 78;
	const ph = h - 16;
	const observer = DEFAULT_OBSERVERS[state.observerModel] || DEFAULT_OBSERVERS['stockman-sharpe-2deg'];
	const [nmA, nmB] = observer.dataset.wavelengthRange;
	drawSpectrumBackground(ctx, x0, y0 - ph, pw, ph, nmA, nmB, state);
	const cols = ['#e0533d', '#39c46f', '#5b8def'];
	let mx = 0;
	const samp: Array<[number, number, number]> = [];

	for (let i = 0; i <= pw; i += 1) {
		const nm = nmA + ((nmB - nmA) * i) / pw;
		const c = observer.evaluateLms(nm);
		samp.push(c);
		mx = Math.max(mx, c[0], c[1], c[2]);
	}
	for (let k = 0; k < 3; k += 1) {
		ctx.strokeStyle = cols[k];
		ctx.lineWidth = 1.4;
		ctx.beginPath();
		samp.forEach((c, i) => {
			const X = x0 + i;
			const Y = y0 - (Math.max(c[k], 0) / mx) * ph;
			if (i) ctx.lineTo(X, Y);
			else ctx.moveTo(X, Y);
		});
		ctx.stroke();
	}
	ctx.fillStyle = '#fffb';
	ctx.font = '9px "IBM Plex Mono", monospace';
	ctx.fillText(`${nmA}nm`, x0 + 2, y0 - 2);
	ctx.textAlign = 'right';
	ctx.fillText(`${nmB}nm`, x0 + pw - 2, y0 - 2);
	ctx.textAlign = 'left';
	if (!ch) return '';
	const dom = dominantWavelength(ch.xyz);
	let label = '';
	if (dom) {
		const X = x0 + ((dom.nm - nmA) / (nmB - nmA)) * pw;
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(X, 0);
		ctx.lineTo(X, h);
		ctx.stroke();
		label = `ld ~ ${dom.nm.toFixed(0)}nm`;
	}
	const bw = 16;
	const bx = w - 66;

	const srgb2xyz = rgbToXyzM(GAMUTS.srgb.P, GAMUTS.srgb.W);
	const srgb2lms = m3.mul(observer.toLmsMatrix, srgb2xyz);
	const cvdLms = m3.mulV(srgb2lms, ch.cvdLin);

	const active = state.cvd !== 'none' && state.cvdSev > 0.001;
	const m = Math.max(...ch.lms.map(Math.abs), ...(active ? cvdLms.map(Math.abs) : []), 1e-6);
	ch.lms.forEach((v, i) => {
		const bh = (Math.max(v, 0) / m) * ph;
		ctx.fillStyle = cols[i];
		ctx.fillRect(bx + i * (bw + 4), y0 - bh, bw, bh);
		ctx.strokeStyle = '#26272b';
		ctx.strokeRect(bx + i * (bw + 4), y0 - ph, bw, ph);
		if (active) {
			const simH = (Math.max(cvdLms[i], 0) / m) * ph;
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 1.4;
			ctx.strokeRect(bx + i * (bw + 4) + 2, y0 - simH, bw - 4, simH);
		}
	});
	return label;
}
