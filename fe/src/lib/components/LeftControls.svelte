<script lang="ts">
	import ControlGroup from './ControlGroup.svelte';
	import PipelinePopover from './PipelinePopover.svelte';
	import SegmentedControl from './SegmentedControl.svelte';
	import SliderRow from './SliderRow.svelte';
	import ThemeRamp from './ThemeRamp.svelte';
	import ToggleRow from './ToggleRow.svelte';
	import { MAX_CAMERA_DIST, MAX_CAMERA_FOV, MAX_CAMERA_PITCH, MIN_CAMERA_DIST, MIN_CAMERA_FOV, resetCamera } from '$lib/engine/camera';
	import { getPipelineNode, hasRampSource, type PipelineNodeId } from './pipeline-nodes';

	import type { ExplorerState } from '$lib/engine/types';
	import type { Camera } from '$lib/engine/camera';
	import type { DerivedMatrices } from '$lib/renderer/uniforms';
	import type { TouchTool } from './Viewport.svelte';

	let {
		explorer,
		matrices,
		camera,
		touchTool = $bindable('auto'),
		selectedNode = 'all'
	} = $props<{ explorer: ExplorerState; matrices: DerivedMatrices; camera: Camera; touchTool: TouchTool; selectedNode?: PipelineNodeId }>();
	let openHelp = $state<string | null>(null);
	const activeNode = $derived(getPipelineNode(selectedNode));
	const sourceMissing = $derived(!!activeNode.requiresSource && !hasRampSource(explorer));

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

	const showAll = $derived(selectedNode === 'all');
	const showGamut = $derived(showAll || selectedNode === 'gamut');
	const showWorld = $derived(showAll || selectedNode === 'world');
	const showClipping = $derived(showAll || selectedNode === 'clip');
	const showVision = $derived(showAll || selectedNode === 'cvd');
	const showDisplay = $derived(showAll || selectedNode === 'display');
	const showView = $derived(showAll || selectedNode === 'view');
	const showPerformance = $derived(showAll || selectedNode === 'performance');

	function setCameraTarget(index: 0 | 1 | 2, value: number) {
		const next: [number, number, number] = [camera.target[0], camera.target[1], camera.target[2]];
		next[index] = value;
		camera.target = next;
	}
</script>

<aside class="side-panel left-panel">
	<div class="node-panel-heading">
		<span class="node-panel-kicker">{activeNode.lane} lane · affects {activeNode.affects}</span>
		<h2>{activeNode.label}</h2>
		<p>{activeNode.description}</p>
		{#if sourceMissing}
			<p class="note">Pick anchor A or B (or add a spline point) first — this stage has nothing to act on yet.</p>
		{/if}
	</div>

	{#if showGamut}
	<ControlGroup title="Gamut / encoding" helpId="pipelineGamut" bind:openHelp collapsible={showAll} defaultOpen={!showAll}>
		<label class="row" for="gamut-select"><span>Gamut (cube primaries)</span></label>
		<select id="gamut-select" bind:value={explorer.gamut}>
			{#each gamuts as gamut}
				<option value={gamut.value}>{gamut.label}</option>
			{/each}
		</select>
		<p class="note">
			Changing primaries reshapes the solid through the same <PipelinePopover cvd={explorer.cvd} cvdSev={explorer.cvdSev} />.
		</p>
	</ControlGroup>
	{/if}

	{#if showWorld}
	<ControlGroup title="World space" helpId="pipelineWorld" bind:openHelp collapsible={showAll} defaultOpen={!showAll}>
		<label class="row" for="space-select"><span>World space</span></label>
		<select id="space-select" bind:value={explorer.spaceMode}>
			{#each spaces as space}
				<option value={space.value}>{space.label}</option>
			{/each}
		</select>
		<p class="note">World space changes the 3D geometry, not the source RGB values or exported ramp tokens.</p>
	</ControlGroup>
	{/if}

	{#if showClipping}
	<ControlGroup title="Clipping" helpId="pipelineClip" bind:openHelp collapsible={showAll} defaultOpen={!showAll}>
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
	{/if}

	{#if showDisplay}
	<ControlGroup title="Display aids" helpId="pipelineDisplay" bind:openHelp collapsible={showAll} defaultOpen={!showAll}>
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
	</ControlGroup>
	{/if}

	{#if showVision}
	<ControlGroup title="Vision preview" helpId="pipelineVision" bind:openHelp collapsible={showAll} defaultOpen={!showAll}>
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
	{/if}

	{#if showAll || selectedNode === 'pick'}
	<ControlGroup title="Pick" helpId="pipelinePick" bind:openHelp collapsible={showAll} defaultOpen={!showAll}>
		<ThemeRamp state={explorer} {matrices} panel="pick" bind:touchTool />
	</ControlGroup>
	{/if}

	{#if showAll || selectedNode === 'points'}
	<ControlGroup title="Anchors / points" helpId="pipelinePoints" bind:openHelp collapsible={showAll} defaultOpen={!showAll}>
		<ThemeRamp state={explorer} {matrices} panel="points" />
	</ControlGroup>
	{/if}

	{#if showAll || selectedNode === 'interpolate'}
	<ControlGroup title="Interpolate" helpId="pipelineInterpolate" bind:openHelp collapsible={showAll} defaultOpen={!showAll}>
		<ThemeRamp state={explorer} {matrices} panel="interpolate" />
	</ControlGroup>
	{/if}

	{#if showAll || selectedNode === 'adjust'}
	<ControlGroup title="Adjust" helpId="pipelineAdjust" bind:openHelp collapsible={showAll} defaultOpen={!showAll}>
		<ThemeRamp state={explorer} {matrices} panel="adjust" />
	</ControlGroup>
	{/if}

	{#if showAll || selectedNode === 'gamut-map'}
	<ControlGroup title="Gamut map" helpId="pipelineGamutMap" bind:openHelp collapsible={showAll} defaultOpen={!showAll}>
		<ThemeRamp state={explorer} {matrices} panel="gamut-map" />
	</ControlGroup>
	{/if}

	{#if showAll || selectedNode === 'export'}
	<ControlGroup title="Export" helpId="pipelineExport" bind:openHelp collapsible={showAll} defaultOpen={!showAll}>
		<ThemeRamp state={explorer} {matrices} panel="export" />
	</ControlGroup>
	{/if}

	{#if showView}
	<ControlGroup title="View" helpId="pipelineView" bind:openHelp collapsible={showAll} defaultOpen={!showAll}>
		<button type="button" onclick={() => resetCamera(camera)}>Reset camera</button>
		<SliderRow
			label="Yaw"
			bind:value={camera.yaw}
			min={-Math.PI}
			max={Math.PI}
			step={0.01}
			format={(value) => `${((value * 180) / Math.PI).toFixed(0)} deg`}
		/>
		<SliderRow
			label="Pitch"
			bind:value={camera.pitch}
			min={-MAX_CAMERA_PITCH}
			max={MAX_CAMERA_PITCH}
			step={0.01}
			format={(value) => `${((value * 180) / Math.PI).toFixed(0)} deg`}
		/>
		<SliderRow
			label="Distance"
			bind:value={camera.dist}
			min={MIN_CAMERA_DIST}
			max={MAX_CAMERA_DIST}
			step={0.01}
			format={(value) => value.toFixed(2)}
		/>
		<SliderRow
			label="Field of view"
			bind:value={camera.fov}
			min={MIN_CAMERA_FOV}
			max={MAX_CAMERA_FOV}
			step={0.01}
			format={(value) => `${((value * 180) / Math.PI).toFixed(0)} deg`}
		/>
		<div class="separator">
			<div class="panel-label" style="margin-top: 0">Target</div>
			<label class="field-row">
				<span>X</span>
				<input
					type="number"
					value={camera.target[0]}
					step="0.01"
					oninput={(event) => setCameraTarget(0, Number((event.currentTarget as HTMLInputElement).value))}
				/>
			</label>
			<label class="field-row">
				<span>Y</span>
				<input
					type="number"
					value={camera.target[1]}
					step="0.01"
					oninput={(event) => setCameraTarget(1, Number((event.currentTarget as HTMLInputElement).value))}
				/>
			</label>
			<label class="field-row">
				<span>Z</span>
				<input
					type="number"
					value={camera.target[2]}
					step="0.01"
					oninput={(event) => setCameraTarget(2, Number((event.currentTarget as HTMLInputElement).value))}
				/>
			</label>
		</div>
		<p class="note">Gestures remain active in the viewport; these controls edit the same camera state directly. Touch tool lives in the Pick stage.</p>
	</ControlGroup>
	{/if}

	{#if showPerformance}
	<ControlGroup title="Performance" helpId="pipelinePerformance" bind:openHelp collapsible={showAll} defaultOpen={!showAll}>
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
	{/if}
</aside>
