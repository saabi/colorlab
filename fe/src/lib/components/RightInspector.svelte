<script lang="ts">
	import { onMount } from 'svelte';
	import ControlGroup from './ControlGroup.svelte';
	import { drawConesPanel } from '$lib/panels/cones-panel';
	import { drawTransferPanel } from '$lib/panels/transfer-panel';
	import { drawXyPanel } from '$lib/panels/xy-panel';

	import type { ExplorerState } from '$lib/engine/types';
	import type { Vec3 } from '$lib/color/math';

	let { state: explorer } = $props<{ state: ExplorerState }>();
	let transferCanvas: HTMLCanvasElement;
	let conesCanvas: HTMLCanvasElement;
	let xyCanvas: HTMLCanvasElement;
	let spectrumLabel = $state('');

	const fmt = (value: number, places = 3) => (Math.abs(value) < 1e-4 ? 0 : value).toFixed(places);
	const fmtVec = (vec: Vec3, places = 3) => vec.map((v: number) => fmt(v, places)).join(' ');
	const encSrgb = (v: number) => {
		const c = Math.min(Math.max(v, 0), 1);
		return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
	};
	const rows = $derived.by(() => {
		const ch = explorer.hover?.chain;
		if (!ch) return [['hover the solid...', '']];
		return [
			['encoded RGB', fmtVec(ch.enc)],
			['linear RGB', fmtVec(ch.rgbLin)],
			['CIE XYZ', fmtVec(ch.xyz)],
			['LMS', fmtVec(ch.lms)],
			['CIELAB', fmtVec(ch.lab, 1)],
			['Oklab', fmtVec(ch.ok)],
			['OKLCh', `${fmt(ch.oklch[0])} ${fmt(ch.oklch[1])} ${fmt(ch.oklch[2], 1)} deg`]
		];
	});
	const swatchStyle = $derived.by(() => {
		const ch = explorer.hover?.chain;
		if (!ch) return '';
		const disp = ch.cvdLin.map((v: number) => Math.round(encSrgb(v) * 255));
		return `background: rgb(${disp.join(',')}); color: ${explorer.hover?.inGamut ? '#0008' : '#fffb'};`;
	});

	function drawPanels() {
		if (!transferCanvas || !conesCanvas || !xyCanvas) return;
		const ch = explorer.hover?.chain ?? null;
		drawTransferPanel(transferCanvas, ch, explorer);
		spectrumLabel = drawConesPanel(conesCanvas, ch, explorer);
		drawXyPanel(xyCanvas, ch, explorer);
	}

	onMount(() => {
		const ro = new ResizeObserver(drawPanels);
		[transferCanvas, conesCanvas, xyCanvas].forEach((canvas) => ro.observe(canvas));
		drawPanels();
		return () => ro.disconnect();
	});

	$effect(() => {
		explorer.hover;
		explorer.gamut;
		explorer.cvd;
		explorer.cvdSev;
		drawPanels();
	});
</script>

<aside class="side-panel right-panel">
	<ControlGroup title="Hovered stimulus">
		<div class:oog={!!explorer.hover && !explorer.hover.inGamut} class="swatch" style={swatchStyle}>
			<span>{explorer.hover ? (explorer.hover.inGamut ? '' : 'OUT OF GAMUT') : ''}</span>
		</div>
		<div class="chain">
			{#each rows as row}
				<div class="stage">
					<b>{row[0]}</b>
					<span>{row[1]}</span>
				</div>
			{/each}
		</div>
	</ControlGroup>

	<div class="panel-label">Transfer (encode to linear)</div>
	<canvas bind:this={transferCanvas} class="panel-canvas" aria-label="Transfer curve panel"></canvas>

	<div class="panel-label">Cone fundamentals L M S <span style="float: right; text-transform: none">{spectrumLabel}</span></div>
	<canvas bind:this={conesCanvas} class="panel-canvas tall" aria-label="Cone fundamentals and spectrum panel"></canvas>

	<div class="panel-label">CIE xy chromaticity</div>
	<canvas bind:this={xyCanvas} class="panel-canvas tall" aria-label="CIE xy chromaticity panel"></canvas>

	<p class="note">
		Excitations are integrals: a general color is three magnitudes, not points on wavelength curves.
	</p>
</aside>
