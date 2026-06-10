<script lang="ts">
	import ControlGroup from './ControlGroup.svelte';

	import type { ExplorerState } from '$lib/engine/types';
	import type { Vec3 } from '$lib/color/math';

	let { state } = $props<{ state: ExplorerState }>();

	const fmt = (value: number, places = 3) => (Math.abs(value) < 1e-4 ? 0 : value).toFixed(places);
	const fmtVec = (vec: Vec3, places = 3) => vec.map((v: number) => fmt(v, places)).join(' ');
	const encSrgb = (v: number) => {
		const c = Math.min(Math.max(v, 0), 1);
		return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
	};
	const rows = $derived.by(() => {
		const ch = state.hover?.chain;
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
		const ch = state.hover?.chain;
		if (!ch) return '';
		const disp = ch.srgbLin.map((v: number) => Math.round(encSrgb(v) * 255));
		return `background: rgb(${disp.join(',')}); color: ${state.hover?.inGamut ? '#0008' : '#fffb'};`;
	});
</script>

<aside class="side-panel right-panel">
	<ControlGroup title="Hovered stimulus">
		<div class:oog={!!state.hover && !state.hover.inGamut} class="swatch" style={swatchStyle}>
			<span>{state.hover ? (state.hover.inGamut ? '' : 'OUT OF GAMUT') : ''}</span>
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
	<canvas class="panel-canvas" aria-label="Transfer curve panel"></canvas>

	<div class="panel-label">Cone fundamentals L M S</div>
	<canvas class="panel-canvas" aria-label="Cone fundamentals panel"></canvas>

	<div class="panel-label">CIE xy chromaticity</div>
	<canvas class="panel-canvas tall" aria-label="CIE xy chromaticity panel"></canvas>

	<div class="panel-label">Spectrum</div>
	<canvas class="panel-canvas short" aria-label="Spectrum panel"></canvas>

	<p class="note">
		Panel drawing will move over with the picking and transform-chain modules so all readouts
		share one stimulus.
	</p>
</aside>
