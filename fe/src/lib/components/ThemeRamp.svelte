<script lang="ts">
	import SegmentedControl from './SegmentedControl.svelte';
	import SliderRow from './SliderRow.svelte';

	import type { ExplorerState } from '$lib/engine/types';

	let { state } = $props<{ state: ExplorerState }>();
</script>

<div class="segmented" style="--segments: 2">
	<button
		type="button"
		class:active={state.theme.arm === 'A'}
		onclick={() => {
			state.theme.arm = state.theme.arm === 'A' ? null : 'A';
		}}
	>
		Set A
	</button>
	<button
		type="button"
		class:active={state.theme.arm === 'B'}
		onclick={() => {
			state.theme.arm = state.theme.arm === 'B' ? null : 'B';
		}}
	>
		Set B
	</button>
</div>

<div style="height: 4px"></div>
<SegmentedControl
	bind:value={state.theme.mode}
	options={[
		{ value: 'seg', label: 'Segment' },
		{ value: 'arc', label: 'Hue arc' },
		{ value: 'spread', label: 'Spread A' }
	]}
/>

{#if state.theme.mode === 'spread'}
	<SliderRow
		label="Delta hue"
		bind:value={state.theme.dh}
		min={0}
		max={180}
		step={1}
		format={(value) => `${value.toFixed(0)} deg`}
	/>
	<SliderRow
		label="Delta chroma"
		bind:value={state.theme.dc}
		min={0}
		max={0.4}
		step={0.005}
		format={(value) => value.toFixed(2)}
	/>
	<div class="segmented" style="--segments: 2">
		<button
			type="button"
			class:active={state.theme.cprof === 'linear'}
			onclick={() => {
				state.theme.cprof = 'linear';
			}}
		>
			Linear dc
		</button>
		<button
			type="button"
			class:active={state.theme.cprof === 'mirror'}
			onclick={() => {
				state.theme.cprof = 'mirror';
			}}
		>
			Mirror dc
		</button>
	</div>
{/if}

<SliderRow
	label="Steps"
	bind:value={state.theme.steps}
	min={2}
	max={12}
	step={1}
	format={(value) => value.toFixed(0)}
/>

<div class="ramp" aria-label="Theme ramp preview">
	{#if state.theme.stops.length}
		{#each state.theme.stops as stop}
			<div
				class="ramp-chip"
				style={`background: ${stop.hex}; ${stop.inG ? '' : 'outline: 1px dashed var(--warn); outline-offset: -2px;'}`}
			></div>
		{/each}
	{:else}
		{#each Array.from({ length: state.theme.steps }) as _}
			<div class="ramp-chip"></div>
		{/each}
	{/if}
</div>

<button type="button">Export CSS tokens (oklch)</button>
<button type="button" style="margin-top: 4px">Export DTCG JSON</button>

<div class="separator">
	<div class="panel-label" style="margin-top: 0">Auto-adjust</div>
	<button type="button">Fit stops inside sRGB</button>
	<button type="button" style="margin-top: 4px">Ensure WCAG AA on white</button>
	<SliderRow
		label="AA target"
		bind:value={state.theme.aa}
		min={3}
		max={7}
		step={0.5}
		format={(value) => `${value.toFixed(1)}:1`}
	/>
	<button type="button" style="margin-top: 4px">Even perceptual spacing</button>
</div>

<textarea class="export-box" readonly spellcheck="false"></textarea>
<p class="note">
	Arm an anchor, then click the solid or slice cap to drop it. Segment and hue arc are restored
	when the renderer and picking modules land.
</p>
