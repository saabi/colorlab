<script lang="ts">
	import ControlGroup from './ControlGroup.svelte';
	import SegmentedControl from './SegmentedControl.svelte';
	import SliderRow from './SliderRow.svelte';
	import ThemeRamp from './ThemeRamp.svelte';
	import ToggleRow from './ToggleRow.svelte';

	import type { ExplorerState } from '$lib/engine/types';
	import type { DerivedMatrices } from '$lib/renderer/uniforms';

	let { state = $bindable(), matrices } = $props<{ state: ExplorerState; matrices: DerivedMatrices }>();

	const spaces = [
		{ value: 3, label: 'Oklab' },
		{ value: 2, label: 'CIELAB (deprecated)' },
		{ value: 1, label: 'CIE XYZ' },
		{ value: 0, label: 'Linear RGB cube' },
		{ value: 5, label: 'Luminance romboid' }
	] as const;

	const gamuts = [
		{ value: 'srgb', label: 'sRGB / Rec.709' },
		{ value: 'p3', label: 'DCI-P3 D65' },
		{ value: 'rec2020', label: 'Rec.2020' },
		{ value: 'ntsc', label: 'NTSC 1953' },
		{ value: 'ebu', label: 'EBU (Rec.601-625)' },
		{ value: 'smptec', label: 'SMPTE-C' },
		{ value: 'cie', label: 'CIE 1931 RGB' }
	] as const;

	const resolutions = [64, 128, 192, 256] as const;
</script>

<aside class="side-panel left-panel">
	<ControlGroup title="Color space (world)">
		<select bind:value={state.spaceMode}>
			{#each spaces as space}
				<option value={space.value}>{space.label}</option>
			{/each}
		</select>
	</ControlGroup>

	<ControlGroup title="Gamut (cube primaries)">
		<select bind:value={state.gamut}>
			{#each gamuts as gamut}
				<option value={gamut.value}>{gamut.label}</option>
			{/each}
		</select>
		<p class="note">The conserved museum: changing primaries reshapes the solid through the same pipeline.</p>
	</ControlGroup>

	<ControlGroup title="Slice">
		<ToggleRow label="Enable slice" bind:checked={state.slice} />
		<ToggleRow label="Cut above plane" bind:checked={state.cutAbove} />
		<ToggleRow label="Cut below plane" bind:checked={state.cutBelow} />
		<SegmentedControl
			bind:value={state.planeMode}
			options={[
				{ value: 'L', label: 'Lightness' },
				{ value: 'H', label: 'Hue plane' },
				{ value: 'C', label: 'Custom' }
			]}
		/>
		<SliderRow
			label="Offset"
			bind:value={state.off}
			min={-0.6}
			max={0.6}
			step={0.005}
			format={(value) => value.toFixed(2)}
		/>
		<SliderRow
			label="Hue / azimuth"
			bind:value={state.az}
			min={0}
			max={360}
			step={1}
			format={(value) => `${value.toFixed(0)} deg`}
		/>
		<SliderRow
			label="Elevation (custom)"
			bind:value={state.el}
			min={0}
			max={90}
			step={1}
			format={(value) => `${value.toFixed(0)} deg`}
		/>
		<SliderRow
			label="Slab half-width eps"
			bind:value={state.eps}
			min={0.001}
			max={0.08}
			step={0.001}
			format={(value) => value.toFixed(3)}
		/>
	</ControlGroup>

	<ControlGroup title="Tessellation">
		<select bind:value={state.N}>
			{#each resolutions as resolution}
				<option value={resolution}>{resolution} x {resolution} / face</option>
			{/each}
		</select>
		<p class="note">{(6 * state.N * state.N).toLocaleString()} instances - 1 quad in memory</p>
	</ControlGroup>

	<ControlGroup title="Theme ramp (v0)">
		<ThemeRamp bind:state {matrices} />
	</ControlGroup>

	<ControlGroup title="Display">
		<ToggleRow label="Floor grid" bind:checked={state.floor} />
		<ToggleRow label="Surface grid lines" bind:checked={state.lines} />
		<ToggleRow label="Cross-section outline" bind:checked={state.outline} />
		<label class="row" for="shell-select"><span>Wide-gamut shell</span></label>
		<select id="shell-select" bind:value={state.shell}>
			<option value="none">None</option>
			<option value="p3">DCI-P3 D65</option>
			<option value="rec2020">Rec.2020</option>
			<option value="ntsc">NTSC 1953</option>
			<option value="cie">CIE 1931 RGB</option>
		</select>
		<label class="row" for="cvd-select"><span>Color vision</span></label>
		<select id="cvd-select" bind:value={state.cvd}>
			<option value="none">Normal trichromat</option>
			<option value="protan">Protan (L-cone)</option>
			<option value="deutan">Deutan (M-cone)</option>
			<option value="tritan">Tritan (S-cone)</option>
		</select>
		<SliderRow
			label="Severity"
			bind:value={state.cvdSev}
			min={0}
			max={1}
			step={0.05}
			format={(value) => value.toFixed(2)}
		/>
		<p class="note">
			Simulated at the LMS cone stage. 1.0 = dichromat, less than 1 = anomalous trichromat.
		</p>
	</ControlGroup>
</aside>
