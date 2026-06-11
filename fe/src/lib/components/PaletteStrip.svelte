<script lang="ts">
	import { simulateCvdSrgb } from '$lib/color/cvd';
	import type { CvdMode, ThemeStop } from '$lib/engine/types';

	// Reusable swatch grid for generated ramps/palettes. One inner array per row;
	// pass `[stops]` for a 1-D ramp or the full grid for a 2-D palette. Colors are
	// shown exactly as exported (post gamut-map), with a CVD preview and an
	// out-of-gamut affordance, at a configurable square size.
	let {
		rows,
		swatch = 18,
		gap = 2,
		cvd = 'none',
		cvdSev = 1,
		ariaLabel = 'Generated palette'
	} = $props<{
		rows: ThemeStop[][];
		swatch?: number;
		gap?: number;
		cvd?: CvdMode;
		cvdSev?: number;
		ariaLabel?: string;
	}>();

	function chipStyle(stop: ThemeStop) {
		const sim = simulateCvdSrgb(stop.srgbLin, cvd, cvdSev);
		const rgb = sim.map((v) => {
			const c = Math.min(Math.max(v, 0), 1);
			const encoded = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
			return Math.round(encoded * 255);
		});
		const oog = stop.inG ? '' : 'outline: 1px dashed var(--warn); outline-offset: -2px;';
		return `background: rgb(${rgb.join(',')}); width: ${swatch}px; height: ${swatch}px; ${oog}`;
	}
</script>

<div class="palette" style={`gap: ${gap}px`} aria-label={ariaLabel}>
	{#each rows as row}
		<div class="palette-row" style={`gap: ${gap}px`}>
			{#each row as stop}
				<div class="palette-cell" title={`${stop.hex}${stop.inG ? '' : ' (out of gamut)'}`} style={chipStyle(stop)}></div>
			{/each}
		</div>
	{/each}
</div>

<style>
	.palette {
		display: flex;
		flex-direction: column;
	}
	.palette-row {
		display: flex;
		flex-wrap: wrap;
	}
	.palette-cell {
		flex: none;
		border-radius: 3px;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
	}
</style>
