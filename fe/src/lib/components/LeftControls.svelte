<script lang="ts">
	import ControlGroup from './ControlGroup.svelte';
	import PipelinePopover from './PipelinePopover.svelte';
	import SegmentedControl from './SegmentedControl.svelte';
	import SliderRow from './SliderRow.svelte';
	import ThemeRamp from './ThemeRamp.svelte';
	import ToggleRow from './ToggleRow.svelte';
	import PanelHelp from './PanelHelp.svelte';
	import PipelineRail from './PipelineRail.svelte';
	import { tick } from 'svelte';
	import { track } from '$lib/analytics/umami';
	import { getHistoryContext } from '$lib/history/context';
	import { MAX_CAMERA_DIST, MAX_CAMERA_FOV, MAX_CAMERA_PITCH, MIN_CAMERA_DIST, MIN_CAMERA_FOV, resetCamera } from '$lib/engine/camera';
	import { getPipelineNode, isNodeEnabled, type PipelineNodeId } from './pipeline-nodes';
	import { activePipeline } from '$lib/engine/theme';
	import { getObserverModel } from '$lib/color/fundamentals';
	import { diagramDisplayLabel, diagramInspectorNote } from '$lib/color/diagrams';

	import type { ExplorerState } from '$lib/engine/types';
	import type { Camera } from '$lib/engine/camera';
	import type { DerivedMatrices } from '$lib/renderer/uniforms';
	import type { TouchTool } from './Viewport.svelte';

	let {
		explorer = $bindable(),
		matrices,
		camera = $bindable(),
		touchTool = $bindable('auto')
	} = $props<{ explorer: ExplorerState; matrices: DerivedMatrices; camera: Camera; touchTool: TouchTool }>();
	let openHelp = $state<string | null>(null);
	const history = getHistoryContext();

	// Expanded steps are persisted UI state on the explorer (one source of truth).
	const isOpen = (id: string) => explorer.openSteps.includes(id);
	function toggleStep(id: string) {
		explorer.openSteps = isOpen(id) ? explorer.openSteps.filter((s: string) => s !== id) : [...explorer.openSteps, id];
	}

	// Pipeline rail: open the matching step (if collapsed) and scroll its controls
	// into view. The rail is navigation only — it owns no parameters.
	const RAMP_SUBSTEPS = new Set<PipelineNodeId>(['sources', 'interpolate', 'adjust', 'expand']);
	async function selectNode(id: PipelineNodeId) {
		// Substeps live inside the collapsible ramp-builder group — open it first.
		if (RAMP_SUBSTEPS.has(id) && !isOpen('ramp-builder')) toggleStep('ramp-builder');
		if (!isOpen(id)) toggleStep(id);
		await tick();
		const el =
			document.querySelector(`[data-tutorial="node-${id}"]`) ??
			document.getElementById(`ramp-substep-${id}`);
		el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		track('pipeline_node_select', { node: id });
	}

	async function handleObserverChange(key: string) {
		await getObserverModel(key);
		explorer.observerModel = key;
		track('observer_change', { observer: key });
	}

	// Per-step header metadata (status / affects / warn / enablement) sourced from pipeline-nodes.ts.
	const meta = (id: PipelineNodeId) => {
		const node = getPipelineNode(id);
		return {
			label: node.label,
			affects: node.affects,
			status: node.status(explorer),
			warn: node.warn?.(explorer) ?? null,
			disabled: !isNodeEnabled(node, explorer)
		};
	};
	const m = $derived({
		gamut: meta('gamut'),
		world: meta('world'),
		tessellation: meta('tessellation'),
		clip: meta('clip'),
		view: meta('view'),
		cvd: meta('cvd'),
		rampBuilder: meta('ramp-builder'),
		sources: meta('sources'),
		interpolate: meta('interpolate'),
		adjust: meta('adjust'),
		expand: meta('expand'),
		gamutMap: meta('gamut-map'),
		exportStep: meta('export')
	});

	const P = $derived(activePipeline(explorer.theme));

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

	const resolutions = [
		{ value: 64, label: '64 x 64 / face - mobile' },
		{ value: 128, label: '128 x 128 / face - balanced' },
		{ value: 192, label: '192 x 192 / face - detailed' },
		{ value: 256, label: '256 x 256 / face - desktop' },
		{ value: 512, label: '512 x 512 / face - high-end' }
	] as const;
	const minAverageFpsOptions = [15, 30, 60] as const;

	function setCameraTarget(index: 0 | 1 | 2, value: number) {
		const next: [number, number, number] = [camera.target[0], camera.target[1], camera.target[2]];
		next[index] = value;
		camera.target = next;
	}
</script>

<aside class="side-panel left-panel" aria-label="Controls" data-tutorial="sidebar">
	<div class="left-panel-scroll">
	<PipelineRail {explorer} openIds={explorer.openSteps} onSelect={selectNode} />
	<!-- EXPLORER lane: data -> geometry -> view -> eye -->
	<section class="lane-band" aria-label="Explorer pipeline">
		<div class="lane-band-title">
			<span class="lane-band-name">Explorer</span>
			<span class="lane-band-sub">what the 3D solid shows</span>
		</div>
		<div class="lane-steps">
			<ControlGroup index={1} title={m.gamut.label} helpId="pipelineGamut" status={m.gamut.status} affects={m.gamut.affects} open={isOpen('gamut')} onToggle={() => toggleStep('gamut')} bind:openHelp tutorialId="node-gamut">
				<label class="row" for="gamut-select"><span>Gamut (cube primaries)</span></label>
				<select id="gamut-select" bind:value={explorer.gamut} onchange={() => history?.hintLabel('Change gamut')}>
					{#each gamuts as gamut}
						<option value={gamut.value}>{gamut.label}</option>
					{/each}
				</select>
				<p class="note">
					Changing primaries reshapes the solid through the same <PipelinePopover cvd={explorer.cvd} cvdSev={explorer.cvdSev} />.
				</p>
				<div class="separator">
					<label class="row" for="observer-select"><span>Observer model</span></label>
					<select id="observer-select" value={explorer.observerModel} onchange={(e) => handleObserverChange(e.currentTarget.value)}>
						<option value="stockman-sharpe-2deg">Stockman & Sharpe (2000) 2°</option>
						<option value="stockman-sharpe-10deg">Stockman & Sharpe (2000) 10°</option>
						<option value="ciexyz31-2deg">CIE 1931 2° Standard Observer</option>
						<option value="ciexyz64-10deg">CIE 1964 10° Standard Observer</option>
						<option value="ciexyzj-5nm">Judd 1951 2° Modified</option>
						<option value="ciexyzjv-5nm">Judd-Vos 1978 2° Modified</option>
					</select>
					<p class="note">Visual observer model used for color calculations and CVD simulation.</p>
				</div>
				<div class="separator">
					<label class="row" for="shell-select"><span>Reference gamut shell</span></label>
					<select id="shell-select" bind:value={explorer.shell}>
						<option value="none">None</option>
						<option value="srgb">sRGB</option>
						<option value="p3">DCI-P3 D65</option>
						<option value="rec2020">Rec.2020</option>
						<option value="ntsc">NTSC 1953</option>
						<option value="cie">CIE 1931 RGB</option>
					</select>
					<p class="note">Overlays another gamut as a ghost shell for comparison.</p>
				</div>
				<div class="separator">
					<label class="row" for="chroma-overlay-select"><span>Chromaticity overlay</span></label>
					<select id="chroma-overlay-select" bind:value={explorer.chromaticityOverlay}>
						<option value="off">None</option>
						<option value="spectral-locus">Spectral locus rim</option>
						<option value="spectral-surface">Spectral locus surface</option>
					</select>
					<p class="note">Spectral locus at XYZ chromaticity (X+Y+Z=1). Surface sweeps from black to the rim by stimulus magnitude.</p>
				</div>
				<div class="separator">
					<label class="row" for="chroma-diagram-select"><span>Chromaticity / plane view</span></label>
					<select id="chroma-diagram-select" bind:value={explorer.chromaticityDiagram}>
						<option value="cie1931-xy">{diagramDisplayLabel('cie1931-xy', explorer.observerModel)}</option>
						<option value="cie1976-upvp">{diagramDisplayLabel('cie1976-upvp', explorer.observerModel)}</option>
						<option value="cie1960-uv">{diagramDisplayLabel('cie1960-uv', explorer.observerModel)}</option>
						<option value="macleod-boynton">{diagramDisplayLabel('macleod-boynton', explorer.observerModel)}</option>
						<option value="oklab-ab">{diagramDisplayLabel('oklab-ab', explorer.observerModel)}</option>
						<option value="cielab-ab">{diagramDisplayLabel('cielab-ab', explorer.observerModel)}</option>
					</select>
					<p class="note">{diagramInspectorNote(explorer.chromaticityDiagram)}</p>
				</div>
				<div class="separator">
					<SliderRow label="Solid opacity" bind:value={explorer.solidAlpha} min={0.05} max={1} step={0.05} format={(value) => value.toFixed(2)} />
					<p class="note">Lower it to see ramp points, curves, and stops through the solid.</p>
				</div>
			</ControlGroup>

			<ControlGroup index={2} title={m.world.label} helpId="pipelineWorld" status={m.world.status} affects={m.world.affects} open={isOpen('world')} onToggle={() => toggleStep('world')} bind:openHelp tutorialId="node-world">
				<label class="row" for="space-select"><span>World space</span></label>
				<select id="space-select" bind:value={explorer.spaceMode} onchange={() => history?.hintLabel('Change world space')}>
					{#each spaces as space}
						<option value={space.value}>{space.label}</option>
					{/each}
				</select>
				<p class="note">World space changes the 3D geometry, not the source RGB values or exported ramp tokens.</p>
			</ControlGroup>

			<ControlGroup index={3} title={m.tessellation.label} helpId="pipelineTessellation" status={m.tessellation.status} affects={m.tessellation.affects} open={isOpen('tessellation')} onToggle={() => toggleStep('tessellation')} bind:openHelp tutorialId="node-tessellation">
				<label class="row" for="resolution-select"><span>Tessellation</span></label>
				<select id="resolution-select" bind:value={explorer.N}>
					{#each resolutions as resolution}
						<option value={resolution.value}>{resolution.label}</option>
					{/each}
				</select>
				<p class="note">
					{(6 * explorer.N * explorer.N).toLocaleString()} instances - 1 quad in memory. Higher N sharpens clipped
					cross-sections and outlines, but 512 is intended for high-end GPUs.
				</p>
				<ToggleRow label="Surface grid lines" bind:checked={explorer.lines} />
			</ControlGroup>

			<ControlGroup index={4} title={m.clip.label} helpId="pipelineClip" status={m.clip.status} affects={m.clip.affects} open={isOpen('clip')} onToggle={() => toggleStep('clip')} bind:openHelp tutorialId="node-clip">
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
				<SliderRow label="Offset" bind:value={explorer.off} min={0} max={1} step={0.005} format={(value) => value.toFixed(2)} />
				<SliderRow label="Hue / azimuth" bind:value={explorer.az} min={0} max={360} step={1} format={(value) => `${value.toFixed(0)} deg`} />
				<SliderRow label="Elevation (custom)" bind:value={explorer.el} min={0} max={90} step={1} format={(value) => `${value.toFixed(0)} deg`} />
				<SliderRow label="Slab half-width eps" bind:value={explorer.eps} min={0.001} max={0.08} step={0.001} format={(value) => value.toFixed(3)} />
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
				<div class="separator">
					<div class="panel-label" style="margin-top: 0">Cut display</div>
					<ToggleRow label="Plane outline" bind:checked={explorer.planeOutline} />
					<ToggleRow label="Cylinder outline" bind:checked={explorer.cylinderOutline} />
					<ToggleRow label="Depth-test outlines" bind:checked={explorer.outlineDepthTest} />
					<SliderRow label="Clipped grid alpha" bind:value={explorer.surfaceGridAlpha} min={0} max={1} step={0.05} format={(value) => value.toFixed(2)} />
				</div>
			</ControlGroup>

			<ControlGroup index={5} title={m.view.label} helpId="pipelineView" status={m.view.status} affects={m.view.affects} open={isOpen('view')} onToggle={() => toggleStep('view')} bind:openHelp tutorialId="node-view">
				<button type="button" onclick={() => resetCamera(camera)}>Reset camera</button>
				<SliderRow label="Yaw" bind:value={camera.yaw} min={-Math.PI} max={Math.PI} step={0.01} format={(value) => `${((value * 180) / Math.PI).toFixed(0)} deg`} />
				<SliderRow label="Pitch" bind:value={camera.pitch} min={-MAX_CAMERA_PITCH} max={MAX_CAMERA_PITCH} step={0.01} format={(value) => `${((value * 180) / Math.PI).toFixed(0)} deg`} />
				<SliderRow label="Distance" bind:value={camera.dist} min={MIN_CAMERA_DIST} max={MAX_CAMERA_DIST} step={0.01} format={(value) => value.toFixed(2)} />
				<SliderRow label="Field of view" bind:value={camera.fov} min={MIN_CAMERA_FOV} max={MAX_CAMERA_FOV} step={0.01} format={(value) => `${((value * 180) / Math.PI).toFixed(0)} deg`} />
				<div class="separator">
					<div class="panel-label" style="margin-top: 0">Target</div>
					<label class="field-row">
						<span>X</span>
						<input type="number" value={camera.target[0]} step="0.01" oninput={(event) => setCameraTarget(0, Number((event.currentTarget as HTMLInputElement).value))} />
					</label>
					<label class="field-row">
						<span>Y</span>
						<input type="number" value={camera.target[1]} step="0.01" oninput={(event) => setCameraTarget(1, Number((event.currentTarget as HTMLInputElement).value))} />
					</label>
					<label class="field-row">
						<span>Z</span>
						<input type="number" value={camera.target[2]} step="0.01" oninput={(event) => setCameraTarget(2, Number((event.currentTarget as HTMLInputElement).value))} />
					</label>
				</div>
				<p class="note">Gestures remain active in the viewport; these controls edit the same camera state directly. Touch tool lives in the Pick stage. Floor grid is in the sidebar footer.</p>
			</ControlGroup>

			<ControlGroup index={6} title={m.cvd.label} helpId="pipelineVision" status={m.cvd.status} affects={m.cvd.affects} open={isOpen('cvd')} onToggle={() => toggleStep('cvd')} bind:openHelp tutorialId="node-cvd">
				<label class="row" for="cvd-select"><span>Color vision</span></label>
				<select id="cvd-select" bind:value={explorer.cvd}>
					<option value="none">Normal trichromat</option>
					<option value="protan">Protan (L-cone)</option>
					<option value="deutan">Deutan (M-cone)</option>
					<option value="tritan">Tritan (S-cone)</option>
				</select>
				<SliderRow label="Severity" bind:value={explorer.cvdSev} min={0} max={1} step={0.05} format={(value) => value.toFixed(2)} />
				<p class="note">
					Terminal preview: simulates how a color-deficient eye sees the displayed image (assumes an sRGB-compliant monitor). It does not change stored or exported colors.
				</p>
			</ControlGroup>
		</div>
	</section>

	<!-- RAMP lane: selected-list builder -> shared terminal map -> export -->
	<section class="lane-band" aria-label="Ramp pipeline">
		<div class="lane-band-title">
			<span class="lane-band-name">Ramp</span>
			<span class="lane-band-sub">how export tokens are generated</span>
		</div>
		<div class="lane-steps">
			<ControlGroup index={1} title={m.rampBuilder.label} helpId="pipelineRampBuilder" status={m.rampBuilder.status} affects={m.rampBuilder.affects} open={isOpen('ramp-builder')} onToggle={() => toggleStep('ramp-builder')} bind:openHelp tutorialId="node-sources">
				<div class="ramp-builder-manager">
					<ThemeRamp state={explorer} {matrices} panel="list-manager" bind:touchTool />
				</div>
				<div class="ramp-substeps" aria-label="Selected list ramp builder steps">
					<section class="ramp-substep" class:disabled={m.sources.disabled}>
						<div class="ramp-substep-header">
							<span class="ramp-substep-index">1.1</span>
							<span class="ramp-substep-enable-spacer" aria-hidden="true"></span>
							<button type="button" class="ramp-substep-toggle" aria-expanded={isOpen('sources')} onclick={() => toggleStep('sources')}>
								<span>{m.sources.label}</span>
								<span class="ramp-substep-meta">
									{#if m.sources.warn}<span class="group-warn" title="Out of gamut">{m.sources.warn}</span>{/if}
									<span class="group-affects">{m.sources.affects}</span>
									<span class="group-status">{m.sources.status}</span>
									<span class="group-chevron" aria-hidden="true">▾</span>
								</span>
							</button>
							<PanelHelp helpId="pipelineSources" instanceId="ramp-substep-sources" bind:openHelp />
						</div>
						{#if isOpen('sources')}
							<div id="ramp-substep-sources" class="ramp-substep-body">
								<ThemeRamp state={explorer} {matrices} panel="sources" bind:touchTool />
							</div>
						{/if}
					</section>
					<section class="ramp-substep" class:disabled={m.interpolate.disabled} class:step-off={!P.interpolateOn}>
						<div class="ramp-substep-header">
							<span class="ramp-substep-index">1.2</span>
							<label class="ramp-substep-enable">
								<input
									type="checkbox"
									bind:checked={P.interpolateOn}
									disabled={m.interpolate.disabled}
									aria-label="Enable interpolation"
								/>
							</label>
							<button type="button" class="ramp-substep-toggle" aria-expanded={isOpen('interpolate')} onclick={() => toggleStep('interpolate')}>
								<span>{m.interpolate.label}</span>
								<span class="ramp-substep-meta">
									{#if m.interpolate.warn}<span class="group-warn" title="Out of gamut">{m.interpolate.warn}</span>{/if}
									<span class="group-affects">{m.interpolate.affects}</span>
									<span class="group-status">{m.interpolate.status}</span>
									<span class="group-chevron" aria-hidden="true">▾</span>
								</span>
							</button>
							<PanelHelp helpId="pipelineInterpolate" instanceId="ramp-substep-interpolate" bind:openHelp />
						</div>
						{#if isOpen('interpolate')}
							<div id="ramp-substep-interpolate" class="ramp-substep-body">
								<ThemeRamp state={explorer} {matrices} panel="interpolate" />
							</div>
						{/if}
					</section>
					<section class="ramp-substep" class:disabled={m.adjust.disabled} class:step-off={!P.interpolateOn || !P.placeOn}>
						<div class="ramp-substep-header">
							<span class="ramp-substep-index">1.3</span>
							<label class="ramp-substep-enable">
								<input
									type="checkbox"
									bind:checked={P.placeOn}
									disabled={m.adjust.disabled || !P.interpolateOn}
									aria-label="Enable placement"
								/>
							</label>
							<button type="button" class="ramp-substep-toggle" aria-expanded={isOpen('adjust')} onclick={() => toggleStep('adjust')}>
								<span>{m.adjust.label}</span>
								<span class="ramp-substep-meta">
									{#if m.adjust.warn}<span class="group-warn" title="Out of gamut">{m.adjust.warn}</span>{/if}
									<span class="group-affects">{m.adjust.affects}</span>
									<span class="group-status">{m.adjust.status}</span>
									<span class="group-chevron" aria-hidden="true">▾</span>
								</span>
							</button>
							<PanelHelp helpId="pipelineAdjust" instanceId="ramp-substep-adjust" bind:openHelp />
						</div>
						{#if isOpen('adjust')}
							<div id="ramp-substep-adjust" class="ramp-substep-body">
								<ThemeRamp state={explorer} {matrices} panel="adjust" />
							</div>
						{/if}
					</section>
					<section class="ramp-substep" class:disabled={m.expand.disabled} class:step-off={!P.expandOn}>
						<div class="ramp-substep-header">
							<span class="ramp-substep-index">1.4</span>
							<label class="ramp-substep-enable">
								<input
									type="checkbox"
									bind:checked={P.expandOn}
									disabled={m.expand.disabled}
									aria-label="Enable expand"
								/>
							</label>
							<button type="button" class="ramp-substep-toggle" aria-expanded={isOpen('expand')} onclick={() => toggleStep('expand')}>
								<span>{m.expand.label}</span>
								<span class="ramp-substep-meta">
									{#if m.expand.warn}<span class="group-warn" title="Out of gamut">{m.expand.warn}</span>{/if}
									<span class="group-affects">{m.expand.affects}</span>
									<span class="group-status">{m.expand.status}</span>
									<span class="group-chevron" aria-hidden="true">▾</span>
								</span>
							</button>
							<PanelHelp helpId="pipelineExpand" instanceId="ramp-substep-expand" bind:openHelp />
						</div>
						{#if isOpen('expand')}
							<div id="ramp-substep-expand" class="ramp-substep-body">
								<ThemeRamp state={explorer} {matrices} panel="expand" />
							</div>
						{/if}
					</section>
				</div>
			</ControlGroup>

			<ControlGroup index={2} title={m.gamutMap.label} helpId="pipelineGamutMap" status={m.gamutMap.status} affects={m.gamutMap.affects} warn={m.gamutMap.warn} disabled={m.gamutMap.disabled} open={isOpen('gamut-map')} onToggle={() => toggleStep('gamut-map')} bind:openHelp tutorialId="node-gamut-map">
				<ThemeRamp state={explorer} {matrices} panel="gamut-map" />
			</ControlGroup>

			<ControlGroup index={3} title={m.exportStep.label} helpId="pipelineExport" status={m.exportStep.status} affects={m.exportStep.affects} disabled={m.exportStep.disabled} open={isOpen('export')} onToggle={() => toggleStep('export')} bind:openHelp tutorialId="node-export">
				<ThemeRamp state={explorer} {matrices} panel="export" />
			</ControlGroup>
		</div>
	</section>
	</div>

	<!-- Renderer settings: policies/preferences, not pipeline stages -->
	<footer class="sidebar-footer" aria-label="Viewport preferences">
		<div class="sidebar-footer-columns">
			<section class="sidebar-footer-group" aria-label="View aids">
				<div class="sidebar-footer-title">View aids</div>
				<div class="sidebar-footer-grid sidebar-footer-grid-aids">
					<label class="sidebar-footer-check" data-tutorial="floor-grid">
						<input type="checkbox" bind:checked={explorer.floor} />
						<span>Floor grid</span>
					</label>
					<label class="sidebar-footer-check" data-tutorial="hide-aids">
						<input type="checkbox" bind:checked={explorer.hideAids} />
						<span>Hide aids</span>
					</label>
					<label class="sidebar-footer-check" data-tutorial="auto-rotate">
						<input type="checkbox" bind:checked={explorer.autoRotate} />
						<span>Auto-rotate</span>
					</label>
					<label
						class="sidebar-footer-check"
						data-tutorial="neutral-backdrop"
						title="Oklab L = 0.5 neutral surround for the 3D viewport"
					>
						<input type="checkbox" bind:checked={explorer.neutralBackdrop} />
						<span>Neutral backdrop</span>
					</label>
				</div>
			</section>
			<section class="sidebar-footer-group" aria-label="Performance">
				<div class="sidebar-footer-title">Performance</div>
				<div class="sidebar-footer-grid sidebar-footer-grid-performance">
					<label class="sidebar-footer-check">
						<input type="checkbox" bind:checked={explorer.autoPerformance} />
						<span>Auto-reduce</span>
					</label>
					<label class="sidebar-footer-fps" for="min-average-fps-select">
						<span>Min FPS</span>
						<select
							id="min-average-fps-select"
							bind:value={explorer.minAverageFps}
							disabled={!explorer.autoPerformance}
						>
							{#each minAverageFpsOptions as fps}
								<option value={fps}>{fps}</option>
							{/each}
						</select>
					</label>
				</div>
			</section>
		</div>
	</footer>
</aside>

<style>
	.ramp-builder-manager {
		margin-bottom: 8px;
		border-bottom: 1px solid var(--border);
		padding-bottom: 8px;
	}
	.ramp-substeps {
		display: grid;
		gap: 6px;
	}
	.ramp-substep {
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface-inset);
	}
	.ramp-substep.disabled {
		opacity: 0.58;
	}
	.ramp-substep-header {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 6px;
		padding: 4px 5px;
	}
	.ramp-substep-enable {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.ramp-substep-enable input {
		margin: 0;
		cursor: pointer;
	}
	.ramp-substep-enable-spacer {
		width: 13px;
	}
	.ramp-substep.step-off .ramp-substep-body {
		opacity: 0.72;
	}
	.ramp-substep-index {
		color: var(--accent, #d7b33f);
		font-size: 0.769rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.ramp-substep-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		width: 100%;
		min-width: 0;
		border: 0;
		background: transparent;
		padding: 2px 0;
		text-align: left;
	}
	.ramp-substep-meta {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		color: var(--muted);
		font-size: 0.769rem;
	}
	.group-warn,
	.group-affects,
	.group-status {
		border: 1px solid var(--border);
		border-radius: 999px;
		background: color-mix(in srgb, var(--panel) 80%, transparent);
		padding: 1px 5px;
		white-space: nowrap;
	}
	.group-warn {
		border-color: color-mix(in srgb, var(--warn, #d7b33f) 65%, var(--border));
		color: var(--warn, #d7b33f);
	}
	.group-status {
		max-width: 86px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.group-chevron {
		color: var(--muted);
	}
	.ramp-substep-body {
		border-top: 1px solid var(--border);
		padding: 8px 7px;
	}
</style>
