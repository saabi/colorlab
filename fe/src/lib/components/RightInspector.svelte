<script lang="ts">
	import ControlGroup from './ControlGroup.svelte';

	import type { ExplorerState } from '$lib/engine/types';

	let { state } = $props<{ state: ExplorerState }>();

	const rows = [
		['encoded RGB', '-- -- --'],
		['linear RGB', '-- -- --'],
		['CIE XYZ', '-- -- --'],
		['LMS', '-- -- --'],
		['CIELAB', '-- -- --'],
		['Oklab', '-- -- --'],
		['OKLCh', '-- -- --']
	];
</script>

<aside class="side-panel right-panel">
	<ControlGroup title="Hovered stimulus">
		<div class="swatch"><span>{state.hover ? '' : 'NO PICK'}</span></div>
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
