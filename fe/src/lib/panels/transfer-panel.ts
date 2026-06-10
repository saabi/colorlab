import { GAMUTS } from '$lib/color/pipeline';
import { fitCanvas } from './canvas';

import type { ExplorerState, TransformChain } from '$lib/engine/types';

export function drawTransferPanel(canvas: HTMLCanvasElement, ch: TransformChain | null, state: ExplorerState) {
	const { ctx, w, h } = fitCanvas(canvas);
	ctx.clearRect(0, 0, w, h);
	const g = GAMUTS[state.gamut];
	const x0 = 8;
	const y0 = h - 10;
	const pw = w - 16;
	const ph = h - 18;
	ctx.strokeStyle = '#26272b';
	ctx.strokeRect(x0, y0 - ph, pw, ph);
	ctx.strokeStyle = '#d6a93a';
	ctx.lineWidth = 1.6;
	ctx.beginPath();
	for (let i = 0; i <= pw; i += 1) {
		const lin = i / pw;
		const e = g.trc.enc(lin);
		const X = x0 + i;
		const Y = y0 - e * ph;
		if (i) ctx.lineTo(X, Y);
		else ctx.moveTo(X, Y);
	}
	ctx.stroke();
	if (!ch) return;
	const cols = ['#e0533d', '#39c46f', '#5b8def'];
	const drawMarkers = (values: [number, number, number], radius: number, stroke: string | null) => {
		values.forEach((v, i) => {
			const lin = Math.min(Math.max(v, 0), 1);
			const X = x0 + lin * pw;
			const Y = y0 - g.trc.enc(lin) * ph;
			ctx.fillStyle = cols[i];
			ctx.beginPath();
			ctx.arc(X, Y, radius, 0, 7);
			ctx.fill();
			if (stroke) {
				ctx.strokeStyle = stroke;
				ctx.lineWidth = 1.2;
				ctx.stroke();
			}
		});
	};
	drawMarkers(ch.rgbLin, 4, null);
	if (state.cvd !== 'none' && state.cvdSev > 0.001) drawMarkers(ch.cvdLin, 2.5, '#fff');
}
