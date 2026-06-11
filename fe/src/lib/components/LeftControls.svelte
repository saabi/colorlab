<script lang="ts">
	import ControlGroup from './ControlGroup.svelte';
	import PipelinePopover from './PipelinePopover.svelte';
	import SegmentedControl from './SegmentedControl.svelte';
	import SliderRow from './SliderRow.svelte';
	import ThemeRamp from './ThemeRamp.svelte';
	import ToggleRow from './ToggleRow.svelte';

	import type { HelpId } from '$lib/inspector/help-copy';
	import type { ExplorerState } from '$lib/engine/types';
	import type { DerivedMatrices } from '$lib/renderer/uniforms';

	let { explorer, matrices } = $props<{ explorer: ExplorerState; matrices: DerivedMatrices }>();
	let openHelp = $state(null as HelpId | null);

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
	const minAverageFpsOptions = [15, 30, 60] as const;
</script>

<aside class="side-panel left-panel">
	<ControlGroup title="Color model" helpId="colorModel" bind:openHelp collapsible defaultOpen={false}>
		<label class="row" for="space-select"><span>World space</span></label>
		<select id="space-select" bind:value={explorer.spaceMode}>
			{#each spaces as space}
				<option value={space.value}>{space.label}</option>
			{/each}
		</select>

		<label class="row separator" for="gamut-select"><span>Gamut (cube primaries)</span></label>
		<select id="gamut-select" bind:value={explorer.gamut}>
			{#each gamuts as gamut}
				<option value={gamut.value}>{gamut.label}</option>
			{/each}
		</select>
		<p class="note">
			Changing primaries reshapes the solid through the same <PipelinePopover cvd={explorer.cvd} cvdSev={explorer.cvdSev} />.
		</p>
	</ControlGroup>

	<ControlGroup title="Clipping" helpId="clipping" bind:openHelp collapsible defaultOpen={false}>
		<ToggleRow label="Enable slice" bind:checked={explorer.slice} />
		<ToggleRow label="Cut above plane" bind:checked={explorer.cutAbove} />
		<ToggleRow label="Cut below plane" bind:checked={explorer.cutBelow} />
		<SegmentedControl
			bind:value={explorer.planeMode}
			options={[
				{ value: 'L', label: 'Lightness' },
				{ value: 'H', label: 'Hue plane' },
				{ value: 'C', label: 'Custom' }
			]}
		/>
		<SliderRow
			label="Offset"
			bind:value={explorer.off}
			min={0}
			max={1}
			step={0.005}
			format={(value) => value.toFixed(2)}
		/>
		<SliderRow
			label="Hue / azimuth"
			bind:value={explorer.az}
			min={0}
			max={360}
			step={1}
			format={(value) => `${value.toFixed(0)} deg`}
		/>
		<SliderRow
			label="Elevation (custom)"
			bind:value={explorer.el}
			min={0}
			max={90}
			step={1}
			format={(value) => `${value.toFixed(0)} deg`}
		/>
		<SliderRow
			label="Slab half-width eps"
			bind:value={explorer.eps}
			min={0.001}
			max={0.08}
			step={0.001}
			format={(value) => value.toFixed(3)}
		/>

		<div class="separator">
			<ToggleRow label="Enable cylindrical cut" bind:checked={explorer.cylSlice} />
		</div>
		<SliderRow
			label={explorer.spaceMode === 2 || explorer.spaceMode === 3 ? 'Chroma radius' : 'Radial distance'}
			bind:value={explorer.cylRad}
			min={0}
			max={0.8}
			step={0.005}
			format={(value) => value.toFixed(3)}
		/>
	</ControlGroup>

	<ControlGroup title="Display" helpId="display" bind:openHelp collapsible defaultOpen={false}>
		<ToggleRow label="Floor grid" bind:checked={explorer.floor} />
		<ToggleRow label="Surface grid lines" bind:checked={explorer.lines} />
		<ToggleRow label="Plane outline" bind:checked={explorer.planeOutline} />
		<ToggleRow label="Cylinder outline" bind:checked={explorer.cylinderOutline} />
		<ToggleRow label="Depth-test cross-section outlines" bind:checked={explorer.outlineDepthTest} />
		<SliderRow
			label="Clipped grid alpha"
			bind:value={explorer.surfaceGridAlpha}
			min={0}
			max={1}
			step={0.05}
			format={(value) => value.toFixed(2)}
		/>
		<label class="row" for="shell-select"><span>Wide-gamut shell</span></label>
		<select id="shell-select" bind:value={explorer.shell}>
			<option value="none">None</option>
			<option value="p3">DCI-P3 D65</option>
			<option value="rec2020">Rec.2020</option>
			<option value="ntsc">NTSC 1953</option>
			<option value="cie">CIE 1931 RGB</option>
		</select>
		<label class="row" for="cvd-select"><span>Color vision</span></label>
		<select id="cvd-select" bind:value={explorer.cvd}>
			<option value="none">Normal trichromat</option>
			<option value="protan">Protan (L-cone)</option>
			<option value="deutan">Deutan (M-cone)</option>
			<option value="tritan">Tritan (S-cone)</option>
		</select>
		<SliderRow
			label="Severity"
			bind:value={explorer.cvdSev}
			min={0}
			max={1}
			step={0.05}
			format={(value) => value.toFixed(2)}
		/>
		<p class="note">
			Simulated at the LMS cone stage. 1.0 = dichromat, less than 1 = anomalous trichromat.
		</p>
	</ControlGroup>

	<ControlGroup title="Theme" helpId="theme" bind:openHelp collapsible defaultOpen={true}>
		<ThemeRamp state={explorer} {matrices} />
	</ControlGroup>

	<ControlGroup title="Performance" helpId="performance" bind:openHelp collapsible defaultOpen={false}>
		<ToggleRow label="Auto-adjust tessellation" bind:checked={explorer.autoPerformance} />
		<label class="row" for="min-average-fps-select"><span>Minimum average FPS</span></label>
		<select id="min-average-fps-select" bind:value={explorer.minAverageFps} disabled={!explorer.autoPerformance}>
			{#each minAverageFpsOptions as fps}
				<option value={fps}>{fps} fps</option>
			{/each}
		</select>
		<label class="row" for="resolution-select"><span>Tessellation</span></label>
		<select id="resolution-select" bind:value={explorer.N}>
			{#each resolutions as resolution}
				<option value={resolution}>{resolution} x {resolution} / face</option>
			{/each}
		</select>
		<p class="note">{(6 * explorer.N * explorer.N).toLocaleString()} instances - 1 quad in memory</p>
		<p class="note">Auto-adjust only lowers tessellation after sustained redraw misses.</p>
	</ControlGroup>
</aside>
