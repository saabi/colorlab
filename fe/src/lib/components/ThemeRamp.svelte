<script lang="ts">
	import SegmentedControl from './SegmentedControl.svelte';
	import SliderRow from './SliderRow.svelte';
	import { exportDTCG, exportTokens, fitEven, fitGamut, fitWcag } from '$lib/engine/theme';

	import type { ExplorerState } from '$lib/engine/types';
	import type { DerivedMatrices } from '$lib/renderer/uniforms';

	let { state: explorer = $bindable(), matrices } = $props<{ state: ExplorerState; matrices: DerivedMatrices }>();
	let exportText = $state('');

	function showExport(kind: 'css' | 'json') {
		exportText = kind === 'css' ? exportTokens(explorer.theme.stops) : exportDTCG(explorer.theme.stops);
		navigator.clipboard?.writeText(exportText).catch(() => {});
	}

</script>

<div class="segmented" style="--segments: 2">
	<button
		type="button"
		class:active={explorer.theme.arm === 'A'}
		onclick={() => {
			explorer.theme.arm = explorer.theme.arm === 'A' ? null : 'A';
		}}
	>
		Set A
	</button>
	<button
		type="button"
		class:active={explorer.theme.arm === 'B'}
		onclick={() => {
			explorer.theme.arm = explorer.theme.arm === 'B' ? null : 'B';
		}}
	>
		Set B
	</button>
</div>

<div style="height: 4px"></div>
<SegmentedControl
	bind:value={explorer.theme.mode}
	options={[
		{ value: 'seg', label: 'Segment' },
		{ value: 'arc', label: 'Hue arc' },
		{ value: 'spread', label: 'Spread A' }
	]}
/>

{#if explorer.theme.mode === 'spread'}
	<SliderRow
		label="Delta hue"
		bind:value={explorer.theme.dh}
		min={0}
		max={180}
		step={1}
		format={(value) => `${value.toFixed(0)} deg`}
	/>
	<SliderRow
		label="Delta chroma"
		bind:value={explorer.theme.dc}
		min={0}
		max={0.4}
		step={0.005}
		format={(value) => value.toFixed(2)}
	/>
	<div class="segmented" style="--segments: 2">
		<button
			type="button"
			class:active={explorer.theme.cprof === 'linear'}
			onclick={() => {
				explorer.theme.cprof = 'linear';
			}}
		>
			Linear dc
		</button>
		<button
			type="button"
			class:active={explorer.theme.cprof === 'mirror'}
			onclick={() => {
				explorer.theme.cprof = 'mirror';
			}}
		>
			Mirror dc
		</button>
	</div>
{/if}

<SliderRow
	label="Steps"
	bind:value={explorer.theme.steps}
	min={2}
	max={12}
	step={1}
	format={(value) => value.toFixed(0)}
/>

<div class="ramp" aria-label="Theme ramp preview">
	{#if explorer.theme.stops.length}
		{#each explorer.theme.stops as stop}
			<div
				class="ramp-chip"
				style={`background: ${stop.hex}; ${stop.inG ? '' : 'outline: 1px dashed var(--warn); outline-offset: -2px;'}`}
			></div>
		{/each}
	{:else}
		{#each Array.from({ length: explorer.theme.steps }) as _}
			<div class="ramp-chip"></div>
		{/each}
	{/if}
</div>

<button type="button" onclick={() => showExport('css')}>Export CSS tokens (oklch)</button>
<button type="button" style="margin-top: 4px" onclick={() => showExport('json')}>Export DTCG JSON</button>

<div class="separator">
	<div class="panel-label" style="margin-top: 0">Auto-adjust</div>
	<button type="button" onclick={() => fitGamut(explorer, matrices)}>Fit stops inside sRGB</button>
	<button type="button" style="margin-top: 4px" onclick={() => fitWcag(explorer, matrices)}>Ensure WCAG AA on white</button>
	<SliderRow
		label="AA target"
		bind:value={explorer.theme.aa}
		min={3}
		max={7}
		step={0.5}
		format={(value) => `${value.toFixed(1)}:1`}
	/>
	<button type="button" style="margin-top: 4px" onclick={() => fitEven(explorer, matrices)}>Even perceptual spacing</button>
</div>

<textarea class="export-box" class:visible={!!exportText} readonly spellcheck="false" bind:value={exportText}></textarea>
<p class="note">
	Arm an anchor, then click the solid or slice cap to drop it. Segment interpolates directly;
	hue arc sweeps around the neutral axis; spread builds from anchor A.
</p>
