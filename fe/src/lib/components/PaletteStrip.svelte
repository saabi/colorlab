<script lang="ts">
	import { simulateCvdSrgb } from '$lib/color/cvd';
	import type { CvdMode, ThemeStop } from '$lib/engine/types';

	// Reusable swatch grid for generated ramps/palettes. One inner array per row;
	// pass `[stops]` for a 1-D ramp or the full grid for a 2-D palette. Colors are
	// shown exactly as exported (post gamut-map), with a CVD preview and an
	// out-of-gamut affordance.
	//
	// layout='fixed': swatch-px squares, rows wrap (viewport pin, inspector tab).
	// layout='fluid': chips stretch to fill the available width at rowHeight px,
	//                 no wrap (sidebar previews — the original .ramp look).
	let {
		rows,
		layout = 'fixed',
		swatch = 18,
		rowHeight = 26,
		gap = 2,
		cvd = 'none',
		cvdSev = 1,
		ariaLabel = 'Generated palette'
	} = $props<{
		rows: ThemeStop[][];
		layout?: 'fixed' | 'fluid';
		swatch?: number;
		rowHeight?: number;
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
		const size = layout === 'fluid' ? `height: ${rowHeight}px;` : `width: ${swatch}px; height: ${swatch}px;`;
		return `background: rgb(${rgb.join(',')}); ${size} ${oog}`;
	}
</script>

<div class="palette" style={`gap: ${gap}px`} aria-label={ariaLabel}>
	{#each rows as row}
		<div class="palette-row" class:fluid={layout === 'fluid'} style={`gap: ${gap}px`}>
			{#each row as stop}
				<div class="palette-cell" class:fluid={layout === 'fluid'} title={`${stop.hex}${stop.inG ? '' : ' (out of gamut)'}`} style={chipStyle(stop)}></div>
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
	.palette-row.fluid {
		flex-wrap: nowrap;
	}
	.palette-cell {
		flex: none;
		border-radius: 3px;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
	}
	.palette-cell.fluid {
		flex: 1;
		min-width: 0;
		border-radius: 4px;
	}
</style>
