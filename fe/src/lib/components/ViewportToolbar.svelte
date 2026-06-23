<script module lang="ts">
	// ===== IMPORTS =====
	import { track } from '$lib/analytics/umami';
	import type { ExplorerState } from '$lib/engine/types';

	// ===== TYPES =====
	interface Props {
		state: ExplorerState;
		touchTool: 'auto' | 'slice' | 'cylinder' | 'add';
	}

	// ===== STATIC CONSTANTS =====
	const SPACES = [
		{ value: 3, label: 'Oklab' },
		{ value: 2, label: 'CIELAB' },
		{ value: 1, label: 'XYZ' },
		{ value: 0, label: 'RGB' },
		{ value: 5, label: 'Luma' }
	] as const;

	const GAMUTS = [
		{ value: 'srgb', label: 'sRGB' },
		{ value: 'p3', label: 'P3' },
		{ value: 'rec2020', label: 'Rec.2020' },
		{ value: 'ntsc', label: 'NTSC' },
		{ value: 'ebu', label: 'EBU' },
		{ value: 'smptec', label: 'SMPTE-C' },
		{ value: 'cie', label: 'CIE RGB' }
	] as const;
</script>

<script lang="ts">
	// ===== PROPS =====
	let {
		state = $bindable(),
		touchTool = $bindable()
	}: Props = $props();

	// ===== FUNCTIONS =====
	function onTouchToolChange() {
		track('touch_tool_change', { tool: touchTool });
	}
</script>

<div class="viewport-toolbar" aria-label="Viewport controls">
	<label>
		<span>Space</span>
		<select bind:value={state.spaceMode}>
			{#each SPACES as space}
				<option value={space.value}>{space.label}</option>
			{/each}
		</select>
	</label>

	<label>
		<span>Gamut</span>
		<select bind:value={state.gamut}>
			{#each GAMUTS as gamut}
				<option value={gamut.value}>{gamut.label}</option>
			{/each}
		</select>
	</label>

	<label class="toolbar-toggle">
		<input type="checkbox" bind:checked={state.slice} />
		<span>Slice</span>
	</label>

	<label class="toolbar-toggle">
		<input type="checkbox" bind:checked={state.cylSlice} />
		<span>Cylinder</span>
	</label>

	<label class="toolbar-toggle toolbar-pin">
		<input type="checkbox" bind:checked={state.pinPalette} />
		<span>Pin palette</span>
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

	<label class="toolbar-touch-tool">
		<span>Touch tool</span>
		<select bind:value={touchTool} onchange={onTouchToolChange}>
			<option value="auto">Auto</option>
			<option value="slice">Slice</option>
			<option value="cylinder">Radius</option>
			<option value="add">Add point</option>
		</select>
	</label>
</div>
