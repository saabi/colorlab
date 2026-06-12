<script lang="ts">
	import ControlGroup from './ControlGroup.svelte';
	import PipelinePopover from './PipelinePopover.svelte';
	import SegmentedControl from './SegmentedControl.svelte';
	import SliderRow from './SliderRow.svelte';
	import ThemeRamp from './ThemeRamp.svelte';
	import ToggleRow from './ToggleRow.svelte';
	import { MAX_CAMERA_DIST, MAX_CAMERA_FOV, MAX_CAMERA_PITCH, MIN_CAMERA_DIST, MIN_CAMERA_FOV, resetCamera } from '$lib/engine/camera';
	import { getPipelineNode, isNodeEnabled, type PipelineNodeId } from './pipeline-nodes';

	import type { ExplorerState } from '$lib/engine/types';
	import type { Camera } from '$lib/engine/camera';
	import type { DerivedMatrices } from '$lib/renderer/uniforms';
	import type { TouchTool } from './Viewport.svelte';

	let {
		explorer,
		matrices,
		camera,
		touchTool = $bindable('auto')
	} = $props<{ explorer: ExplorerState; matrices: DerivedMatrices; camera: Camera; touchTool: TouchTool }>();
	let openHelp = $state<string | null>(null);

	// Expanded steps are persisted UI state on the explorer (one source of truth).
	const isOpen = (id: string) => explorer.openSteps.includes(id);
	function toggleStep(id: string) {
		explorer.openSteps = isOpen(id) ? explorer.openSteps.filter((s: string) => s !== id) : [...explorer.openSteps, id];
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
		sources: meta('sources'),
		interpolate: meta('interpolate'),
		adjust: meta('adjust'),
		expand: meta('expand'),
		gamutMap: meta('gamut-map'),
		exportStep: meta('export')
	});

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

	function setCameraTarget(index: 0 | 1 | 2, value: number) {
		const next: [number, number, number] = [camera.target[0], camera.target[1], camera.target[2]];
		next[index] = value;
		camera.target = next;
	}
</script>

<aside class="side-panel left-panel" aria-label="Controls" data-tutorial="sidebar">
	<div class="left-panel-scroll">
	<!-- EXPLORER lane: data -> geometry -> view -> eye -->
	<section class="lane-band" aria-label="Explorer pipeline">
		<div class="lane-band-title">
			<span class="lane-band-name">Explorer</span>
			<span class="lane-band-sub">what the 3D solid shows</span>
		</div>
		<div class="lane-steps">
			<ControlGroup index={1} title={m.gamut.label} helpId="pipelineGamut" status={m.gamut.status} affects={m.gamut.affects} open={isOpen('gamut')} onToggle={() => toggleStep('gamut')} bind:openHelp tutorialId="node-gamut">
				<label class="row" for="gamut-select"><span>Gamut (cube primaries)</span></label>
				<select id="gamut-select" bind:value={explorer.gamut}>
					{#each gamuts as gamut}
						<option value={gamut.value}>{gamut.label}</option>
					{/each}
				</select>
				<p class="note">
					Changing primaries reshapes the solid through the same <PipelinePopover cvd={explorer.cvd} cvdSev={explorer.cvdSev} />.
				</p>
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
					<SliderRow label="Solid opacity" bind:value={explorer.solidAlpha} min={0.05} max={1} step={0.05} format={(value) => value.toFixed(2)} />
					<p class="note">Lower it to see ramp points, curves, and stops through the solid.</p>
				</div>
			</ControlGroup>

			<ControlGroup index={2} title={m.world.label} helpId="pipelineWorld" status={m.world.status} affects={m.world.affects} open={isOpen('world')} onToggle={() => toggleStep('world')} bind:openHelp tutorialId="node-world">
				<label class="row" for="space-select"><span>World space</span></label>
				<select id="space-select" bind:value={explorer.spaceMode}>
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
						<option value={resolution}>{resolution} x {resolution} / face</option>
					{/each}
				</select>
				<p class="note">{(6 * explorer.N * explorer.N).toLocaleString()} instances - 1 quad in memory. Higher N sharpens the clipped cross-section.</p>
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

	<!-- RAMP lane: how export tokens are generated -->
	<section class="lane-band" aria-label="Ramp pipeline">
		<div class="lane-band-title">
			<span class="lane-band-name">Ramp</span>
			<span class="lane-band-sub">how export tokens are generated</span>
		</div>
		<div class="lane-steps">
			<ControlGroup index={1} title={m.sources.label} helpId="pipelineSources" status={m.sources.status} affects={m.sources.affects} open={isOpen('sources')} onToggle={() => toggleStep('sources')} bind:openHelp tutorialId="node-sources">
				<ThemeRamp state={explorer} {matrices} panel="sources" bind:touchTool />
			</ControlGroup>

			<ControlGroup index={2} title={m.interpolate.label} helpId="pipelineInterpolate" status={m.interpolate.status} affects={m.interpolate.affects} warn={m.interpolate.warn} disabled={m.interpolate.disabled} open={isOpen('interpolate')} onToggle={() => toggleStep('interpolate')} bind:openHelp tutorialId="node-interpolate">
				<ThemeRamp state={explorer} {matrices} panel="interpolate" />
			</ControlGroup>

			<ControlGroup index={3} title={m.adjust.label} helpId="pipelineAdjust" status={m.adjust.status} affects={m.adjust.affects} disabled={m.adjust.disabled} open={isOpen('adjust')} onToggle={() => toggleStep('adjust')} bind:openHelp tutorialId="node-adjust">
				<ThemeRamp state={explorer} {matrices} panel="adjust" />
			</ControlGroup>

			<ControlGroup index={4} title={m.expand.label} helpId="pipelineExpand" status={m.expand.status} affects={m.expand.affects} disabled={m.expand.disabled} open={isOpen('expand')} onToggle={() => toggleStep('expand')} bind:openHelp tutorialId="node-expand">
				<ThemeRamp state={explorer} {matrices} panel="expand" />
			</ControlGroup>

			<ControlGroup index={5} title={m.gamutMap.label} helpId="pipelineGamutMap" status={m.gamutMap.status} affects={m.gamutMap.affects} warn={m.gamutMap.warn} disabled={m.gamutMap.disabled} open={isOpen('gamut-map')} onToggle={() => toggleStep('gamut-map')} bind:openHelp tutorialId="node-gamut-map">
				<ThemeRamp state={explorer} {matrices} panel="gamut-map" />
			</ControlGroup>

			<ControlGroup index={6} title={m.exportStep.label} helpId="pipelineExport" status={m.exportStep.status} affects={m.exportStep.affects} disabled={m.exportStep.disabled} open={isOpen('export')} onToggle={() => toggleStep('export')} bind:openHelp tutorialId="node-export">
				<ThemeRamp state={explorer} {matrices} panel="export" />
			</ControlGroup>
		</div>
	</section>
	</div>

	<!-- Renderer settings: policies/preferences, not pipeline stages -->
	<footer class="sidebar-footer" aria-label="Viewport preferences">
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
	</footer>
</aside>
