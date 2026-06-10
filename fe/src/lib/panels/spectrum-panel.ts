import { m3 } from '$lib/color/math';
import { simulateCvdSrgb } from '$lib/color/cvd';
import { D65, GAMUTS, Primaries, White, rgbToXyzM, waveToXyz } from '$lib/color/pipeline';
import { TRC } from '$lib/color/transfer';
import { fitCanvas } from './canvas';

import type { ExplorerState, TransformChain } from '$lib/engine/types';

const smoothstep = (a: number, b: number, x: number) => {
	const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
	return t * t * (3 - 2 * t);
};

const PLms = Primaries(0.73840145, 0.26159855, 1.32671635, -0.32671635, 0.15861916, 0);
const whiteE = White(1 / 3, 1 / 3);
const toLms = m3.inv(rgbToXyzM(PLms, whiteE));
let specCache: { key: string; cv: HTMLCanvasElement } | null = null;
let locusNm: Array<{ nm: number; a: number }> | null = null;

function spectrumColor(wave: number) {
	let c = waveToXyz(wave).map((v) => v / 3.7 + 0.29) as [number, number, number];
	const num = m3.mulV(toLms, D65);
	const den = m3.mulV(toLms, whiteE);
	const WB = m3.mul(m3.inv(toLms), m3.mul(m3.diag([num[0] / den[0], num[1] / den[1], num[2] / den[2]]), toLms));
	c = m3.mulV(WB, c);
	const luma = c[1];
	let rgb = m3.mulV(m3.inv(rgbToXyzM(GAMUTS.srgb.P, GAMUTS.srgb.W)), c);
	const low = Math.min(rgb[0], rgb[1], rgb[2], 0);
	const high = Math.max(rgb[0], rgb[1], rgb[2], 1);
	const sc = Math.max(low / (low - luma), Math.max((high - 1) / (high - luma), 0));
	rgb = rgb.map((v) => v + sc * (luma - v)) as [number, number, number];
	const bk = (1 - smoothstep(380, 519, wave) + smoothstep(519, 730, wave)) * 0.29;
	const br = 0.82 - smoothstep(443, 535, wave) * 0.03 + smoothstep(535, 605, wave) * 0.21;
	rgb = rgb.map((v) => ((v - bk) * 1.12) / br) as [number, number, number];
	return rgb.map((v) => Math.round(TRC.srgb.enc(Math.min(Math.max(v, 0), 1)) * 255));
}

function dominantWavelength(xyz: [number, number, number]) {
	const S = xyz[0] + xyz[1] + xyz[2];
	if (S < 1e-6) return null;
	const x = xyz[0] / S;
	const y = xyz[1] / S;
	const wx = 0.312713;
	const wy = 0.329016;
	const a = Math.atan2(y - wy, x - wx);
	if (!locusNm) {
		locusNm = [];
		for (let nm = 402; nm <= 682; nm += 1) {
			const z = waveToXyz(nm);
			const Z = z[0] + z[1] + z[2];
			if (Z > 5e-3) locusNm.push({ nm, a: Math.atan2(z[1] / Z - wy, z[0] / Z - wx) });
		}
	}
	const find = (ang: number) => {
		let r: { nm: number; a: number } | null = null;
		let d = 1e9;
		for (const p of locusNm ?? []) {
			const dd = Math.abs((((ang - p.a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
			if (dd < d) {
				d = dd;
				r = p;
			}
		}
		return { r, d };
	};
	let purple = false;
	let f = find(a);
	if (f.d > 0.06) {
		purple = true;
		f = find(a + Math.PI);
	}
	return f.r ? { nm: f.r.nm, purple } : null;
}

export function drawSpectrumPanel(canvas: HTMLCanvasElement, ch: TransformChain | null, state: ExplorerState) {
	const { ctx, w, h } = fitCanvas(canvas);
	const key = `${w}:${state.cvd}:${state.cvdSev.toFixed(3)}`;
	if (!specCache || specCache.key !== key) {
		const cv = document.createElement('canvas');
		cv.width = w;
		cv.height = 1;
		const c2 = cv.getContext('2d');
		if (!c2) return '';
		const img = c2.createImageData(w, 1);
		for (let i = 0; i < w; i += 1) {
			const nm = 402 + ((682 - 402) * i) / (w - 1);
			const rgb = spectrumColor(nm);
			const lin = rgb.map((v) => TRC.srgb.dec(v / 255)) as [number, number, number];
			const sim = simulateCvdSrgb(lin, state.cvd, state.cvdSev);
			const enc = sim.map((v) => Math.round(TRC.srgb.enc(Math.min(Math.max(v, 0), 1)) * 255));
			img.data[i * 4] = enc[0];
			img.data[i * 4 + 1] = enc[1];
			img.data[i * 4 + 2] = enc[2];
			img.data[i * 4 + 3] = 255;
		}
		c2.putImageData(img, 0, 0);
		specCache = { key, cv };
	}
	ctx.clearRect(0, 0, w, h);
	ctx.drawImage(specCache.cv, 0, 0, w, h);
	if (!ch) return '';
	const dom = dominantWavelength(ch.xyz);
	if (!dom) return '';
	const x = ((dom.nm - 402) / (682 - 402)) * w;
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(x, 0);
	ctx.lineTo(x, h);
	ctx.stroke();
	return dom.purple ? `purple (c~${dom.nm.toFixed(0)}nm)` : `ld ~ ${dom.nm.toFixed(0)}nm`;
}
