<script lang="ts">
	import PipelinePopover from './PipelinePopover.svelte';

	import type { ExplorerState } from '$lib/engine/types';

	let { state = $bindable() } = $props<{ state: ExplorerState }>();

	const spaces = [
		{ value: 3, label: 'Oklab' },
		{ value: 2, label: 'CIELAB' },
		{ value: 1, label: 'XYZ' },
		{ value: 0, label: 'RGB' },
		{ value: 5, label: 'Luma' }
	] as const;

	const gamuts = [
		{ value: 'srgb', label: 'sRGB' },
		{ value: 'p3', label: 'P3' },
		{ value: 'rec2020', label: 'Rec.2020' },
		{ value: 'ntsc', label: 'NTSC' },
		{ value: 'ebu', label: 'EBU' },
		{ value: 'smptec', label: 'SMPTE-C' },
		{ value: 'cie', label: 'CIE RGB' }
	] as const;
</script>

<div class="viewport-toolbar" aria-label="Viewport controls">
	<label>
		<span>Space</span>
		<select bind:value={state.spaceMode}>
			{#each spaces as space}
				<option value={space.value}>{space.label}</option>
			{/each}
		</select>
	</label>

	<label>
		<span>Gamut</span>
		<select bind:value={state.gamut}>
			{#each gamuts as gamut}
				<option value={gamut.value}>{gamut.label}</option>
			{/each}
		</select>
	</label>

	<span class="toolbar-pipeline">
		<PipelinePopover cvd={state.cvd} cvdSev={state.cvdSev} />
	</span>

	<label class="toolbar-toggle">
		<input type="checkbox" bind:checked={state.slice} />
		<span>Slice</span>
	</label>

	<label class="toolbar-toggle">
		<input type="checkbox" bind:checked={state.cylSlice} />
		<span>Cylinder</span>
	</label>

	<label class="toolbar-vision">
		<span>Vision</span>
		<select bind:value={state.cvd}>
			<option value="none">Normal</option>
			<option value="protan">Protan</option>
			<option value="deutan">Deutan</option>
			<option value="tritan">Tritan</option>
		</select>
	</label>
</div>
