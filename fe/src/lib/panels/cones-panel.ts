import { RGB2LMS, coneLMS } from '$lib/color/pipeline';
import { m3 } from '$lib/color/math';
import { fitCanvas } from './canvas';

import type { ExplorerState, TransformChain } from '$lib/engine/types';

export function drawConesPanel(canvas: HTMLCanvasElement, ch: TransformChain | null, state: ExplorerState) {
	const { ctx, w, h } = fitCanvas(canvas);
	ctx.clearRect(0, 0, w, h);
	const x0 = 6;
	const y0 = h - 8;
	const pw = w - 78;
	const ph = h - 16;
	const nmA = 390;
	const nmB = 710;
	const cols = ['#e0533d', '#39c46f', '#5b8def'];
	let mx = 0;
	const samp: Array<[number, number, number]> = [];
	for (let i = 0; i <= pw; i += 1) {
		const nm = nmA + ((nmB - nmA) * i) / pw;
		const c = coneLMS(nm);
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
	if (!ch) return;
	const bw = 16;
	const bx = w - 66;
	const cvdLms = m3.mulV(RGB2LMS, ch.cvdLin);
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
}
