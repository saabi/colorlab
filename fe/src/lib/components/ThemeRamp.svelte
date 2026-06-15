<script lang="ts">
	import SegmentedControl from './SegmentedControl.svelte';
	import SliderRow from './SliderRow.svelte';
	import ToggleRow from './ToggleRow.svelte';
	import PaletteStrip from './PaletteStrip.svelte';
	import ColorPicker from './ColorPicker.svelte';
	import { track } from '$lib/analytics/umami';
	import { simulateCvdSrgb } from '$lib/color/cvd';
	import { INTERP_SPACES, INTERP_SPACE_KEYS } from '$lib/color/interp';
	import { activePipeline, buildRamp, exportDTCG, exportDTCGGrid, exportTokens, exportTokensGrid, srgbHex } from '$lib/engine/theme';

	import type { AxisSpreadConfig, ExplorerState, ListPipeline, PlacePolicy, RampList, SpreadDir, SplineConstraint, ThemeAnchor } from '$lib/engine/types';
	import type { SurfaceProjectionMethod } from '$lib/color/boundary-project';
	import { MAX_RAMP_STOPS } from '$lib/engine/types';
	import type { DerivedMatrices } from '$lib/renderer/uniforms';
	import type { TouchTool } from './Viewport.svelte';

	type RampPanel = 'all' | 'list-manager' | 'sources' | 'interpolate' | 'adjust' | 'expand' | 'gamut-map' | 'export';

	let {
		state: explorer = $bindable(),
		matrices,
		touchTool = $bindable('auto'),
		panel = 'all'
	} = $props<{ state: ExplorerState; matrices: DerivedMatrices; touchTool?: TouchTool; panel?: RampPanel }>();
	let exportText = $state('');
	let pickerOpen = $state(false);
	let stagedPickerColor = $state<[number, number, number]>([0.5, 0.5, 0.5]);

	// All point edits/selection target the active source list and its pipeline.
	const points = $derived(explorer.theme.lists[explorer.theme.activeList]?.anchors ?? []) as ThemeAnchor[];
	const P = $derived(activePipeline(explorer.theme));
	const activePipelineJson = $derived(JSON.stringify(P));
	const pipelinesDiffer = $derived(
		explorer.theme.lists.length > 1 &&
			explorer.theme.lists.some((list: RampList, i: number) => i !== explorer.theme.activeList && JSON.stringify(list.pipeline) !== activePipelineJson)
	);
	function setPoints(next: ThemeAnchor[]) {
		explorer.theme.lists[explorer.theme.activeList].anchors = next;
	}

	const showAll = $derived(panel === 'all');
	const showListManager = $derived(showAll || panel === 'list-manager');
	const showSources = $derived(showAll || panel === 'sources');
	const showInterpolate = $derived(showAll || panel === 'interpolate');
	const showAdjust = $derived(showAll || panel === 'adjust');
	const showExpand = $derived(showAll || panel === 'expand');
	const showGamutMap = $derived(showAll || panel === 'gamut-map');
	const showExport = $derived(showAll || panel === 'export');
	const touchToolOptions: Array<{ value: TouchTool; label: string }> = [
		{ value: 'auto', label: 'Auto inspect' },
		{ value: 'slice', label: 'Slice offset' },
		{ value: 'cylinder', label: 'Cylinder radius' },
		{ value: 'add', label: 'Add point' }
	];

	// Spline curve geometry constraint (separate from gamut handling).
	const SPLINE_CONSTRAINT_OPTIONS: Array<{ value: SplineConstraint; label: string }> = [
		{ value: 'free', label: 'Free' },
		{ value: 'surface-radial', label: 'Surface: radial shell' },
		{ value: 'surface-oklab-chroma', label: 'Surface: Oklab chroma' },
		{ value: 'surface-oklab-project', label: 'Surface: Oklab projection' }
	];

	const SURFACE_PROJECTION_OPTIONS: Array<{ value: SurfaceProjectionMethod; label: string }> = [
		{ value: 'preserve-chroma', label: 'Preserve lightness' },
		{ value: 'project-0.5', label: 'Project to focus' },
		{ value: 'project-cusp', label: 'Project to hue cusp' },
		{ value: 'adaptive-0.5', label: 'Adaptive focus' },
		{ value: 'adaptive-cusp', label: 'Adaptive cusp' }
	];
	const SURFACE_ALPHA_PRESETS = [0.05, 0.5, 5] as const;
	const GAMUT_MAP_TARGET = 'sRGB';
	const projectionUsesFocus = $derived(P.main.projection === 'project-0.5' || P.main.projection === 'adaptive-0.5');
	const projectionUsesAlpha = $derived(P.main.projection.startsWith('adaptive-'));
	const extensionUsesFocus = $derived(P.extension.projection === 'project-0.5' || P.extension.projection === 'adaptive-0.5');
	const extensionUsesAlpha = $derived(P.extension.projection.startsWith('adaptive-'));
	const projectionAlphaStatus = $derived.by(() => {
		const alpha = P.main.projectionParams.alpha;
		if (alpha <= 0.12) return 'Lightness-preserving';
		if (alpha < 1.5) return 'Balanced';
		return 'More compression';
	});
	const extensionAlphaStatus = $derived.by(() => {
		const alpha = P.extension.projectionParams.alpha;
		if (alpha <= 0.12) return 'Lightness-preserving';
		if (alpha < 1.5) return 'Balanced';
		return 'More compression';
	});
	const gamutMapUsesAlpha = $derived(explorer.theme.gamutMap.startsWith('adaptive-'));
	const gamutMapUsesFocus = $derived(explorer.theme.gamutMap === 'project-0.5' || explorer.theme.gamutMap === 'adaptive-0.5');
	const gamutMapAlphaStatus = $derived.by(() => {
		const alpha = explorer.theme.gamutMapParams.alpha;
		if (alpha <= 0.12) return 'Lightness-preserving';
		if (alpha < 1.5) return 'Balanced';
		return 'More compression';
	});
	const constraintScopeNote = $derived.by(() => {
		switch (P.main.constraint) {
			case 'free':
				return 'Path can pass through or outside the visible solid; final output can still be gamut-mapped later.';
			case 'surface-radial':
				return 'Constrains the path toward the active clipped surface by radial shell projection.';
			case 'surface-oklab-chroma':
				return 'Constrains the path to the active clipped surface by reducing Oklab chroma.';
			case 'surface-oklab-project':
				return 'Constrains the path to the active clipped surface using the selected Oklab projection method.';
		}
	});
	const extensionConstraintNote = $derived.by(() => {
		switch (P.extension.constraint) {
			case 'free':
				return 'Generated palette variants are not surface-constrained before the terminal gamut-map step.';
			case 'surface-radial':
				return 'Generated palette variants are projected toward the active clipped surface by radial shell projection.';
			case 'surface-oklab-chroma':
				return 'Generated palette variants are projected to the active clipped surface by reducing Oklab chroma.';
			case 'surface-oklab-project':
				return 'Generated palette variants are projected to the active clipped surface using the selected Oklab projection method.';
		}
	});

	// Global out-of-gamut policy (applies to every theme mode + export).
	const GAMUT_MAP_OPTIONS: Array<{ value: ExplorerState['theme']['gamutMap']; label: string }> = [
		{ value: 'none', label: 'None (show OOG)' },
		{ value: 'clip', label: 'Clip (clamp)' },
		{ value: 'preserve-chroma', label: 'Preserve chroma' },
		{ value: 'project-0.5', label: 'Project to focus' },
		{ value: 'project-cusp', label: 'Project to cusp' },
		{ value: 'adaptive-0.5', label: 'Adaptive focus' },
		{ value: 'adaptive-cusp', label: 'Adaptive (cusp)' }
	];

	function setGamutMap(method: ExplorerState['theme']['gamutMap']) {
		explorer.theme.gamutMap = method;
		buildRamp(explorer, matrices);
		track('theme_gamut_map', { method });
	}

	function setSurfaceProjection(method: SurfaceProjectionMethod) {
		P.main.projection = method;
		P.main.projectionParams.method = method;
	}

	function setExtensionProjection(method: SurfaceProjectionMethod) {
		P.extension.projection = method;
		P.extension.projectionParams.method = method;
	}

	function setSurfaceProjectionAlpha(alpha: number) {
		P.main.projectionParams.alpha = alpha;
	}

	function setExtensionProjectionAlpha(alpha: number) {
		P.extension.projectionParams.alpha = alpha;
	}

	function setGamutMapAlpha(alpha: number) {
		explorer.theme.gamutMapParams.alpha = alpha;
	}

	const oogBefore = $derived(explorer.theme.rawStops.reduce((n: number, s: { inG: boolean }) => (s.inG ? n : n + 1), 0));
	const oogAfter = $derived(explorer.theme.stops.reduce((n: number, s: { inG: boolean }) => (s.inG ? n : n + 1), 0));

	// 2-D output: Expand produced a grid, or multiple lists each contributed a ramp.
	const isPalette = $derived(explorer.theme.grid.length > 0);

	function showExportText(kind: 'css' | 'json') {
		if (isPalette) {
			exportText = kind === 'css' ? exportTokensGrid(explorer.theme.grid) : exportDTCGGrid(explorer.theme.grid);
		} else {
			exportText = kind === 'css' ? exportTokens(explorer.theme.stops) : exportDTCG(explorer.theme.stops);
		}
		navigator.clipboard?.writeText(exportText).catch(() => {});
		track('theme_export', { format: kind === 'css' ? 'css' : 'dtcg' });
	}

	// Generalized Spread: presets only set the row/column generator parameters.
	const SPREAD_DIR_OPTIONS: Array<{ value: SpreadDir; label: string }> = [
		{ value: 'off', label: 'Off' },
		{ value: 'ramp', label: 'Ramp (0 → δ)' },
		{ value: 'sym', label: 'Symmetric (−δ → +δ)' },
		{ value: 'edges', label: 'Edges (0 → δ at ends)' }
	];

	const off = () => ({ delta: 0, dir: 'off' as const });
	const EXPAND_PRESETS: Array<{ label: string; apply: () => void }> = [
		{
			label: 'Complementary',
			apply: () => setSpread({ count: 2, hue: { delta: 180, dir: 'ramp' }, chroma: off(), light: off() }, null)
		},
		{
			label: 'Triadic',
			apply: () => setSpread({ count: 3, hue: { delta: 240, dir: 'ramp' }, chroma: off(), light: off() }, null)
		},
		{
			label: 'Analogous',
			apply: () => setSpread({ count: 3, hue: { delta: 30, dir: 'sym' }, chroma: off(), light: off() }, null)
		},
		{
			label: 'Tetradic',
			apply: () => setSpread({ count: 4, hue: { delta: 270, dir: 'ramp' }, chroma: off(), light: off() }, null)
		},
		{
			label: 'Tints & shades',
			apply: () => setSpread(null, { count: 5, hue: off(), chroma: off(), light: { delta: -0.32, dir: 'sym' } })
		},
		{
			label: 'Hue fan',
			apply: () => setSpread(null, { count: 5, hue: { delta: 40, dir: 'sym' }, chroma: off(), light: off() })
		}
	];

	function setSpread(rows: AxisSpreadConfig | null, cols: AxisSpreadConfig | null) {
		P.expandOn = true;
		P.expandRows = rows ?? { count: 1, hue: off(), chroma: off(), light: off() };
		P.expandCols = cols ?? { count: 1, hue: off(), chroma: off(), light: off() };
		track('theme_expand_preset');
	}

	function setThemeMode(mode: typeof P.mode) {
		P.mode = mode;
		track('theme_mode_change', { mode });
	}

	function clonePipeline(pipeline: ListPipeline): ListPipeline {
		return JSON.parse(JSON.stringify(pipeline)) as ListPipeline;
	}

	function toggleAddPoint() {
		explorer.theme.arm = explorer.theme.arm === 'add' ? null : 'add';
	}

	const pickerValue = $derived(
		explorer.theme.selectedPoint !== null && points[explorer.theme.selectedPoint]
			? points[explorer.theme.selectedPoint].srgbLin
			: stagedPickerColor
	);

	// Long-hue only matters for cyclic (cylindrical) interpolation spaces.
	const spaceIsCyclic = $derived(
		P.splineSpace !== 'world' &&
			INTERP_SPACES[P.splineSpace as keyof typeof INTERP_SPACES]?.cyclic !== null
	);

	// Presets are just (path type + space) shortcuts over the single interpolator.
	function applyPreset(kind: 'segment' | 'arc' | 'spline') {
		if (kind === 'segment') {
			P.mode = 'linear';
			P.splineSpace = 'world';
		} else if (kind === 'arc') {
			P.mode = 'linear';
			P.splineSpace = 'oklch';
		} else {
			P.mode = 'spline';
			if (P.splineSpace === 'world') P.splineSpace = 'oklch';
		}
		track('theme_mode_change', { mode: P.mode });
	}

	// Source-list management: each list is one ramp; edits target the active list.
	function selectList(index: number) {
		if (index === explorer.theme.activeList) return;
		explorer.theme.activeList = index;
		explorer.theme.selectedPoint = null;
		buildRamp(explorer, matrices);
		track('theme_source_list', { action: 'select' });
	}

	function addList() {
		// New lists inherit the active list's pipeline (deep-cloned).
		const pipeline = clonePipeline(P);
		explorer.theme.lists = [...explorer.theme.lists, { anchors: [], pipeline }];
		explorer.theme.activeList = explorer.theme.lists.length - 1;
		explorer.theme.selectedPoint = null;
		buildRamp(explorer, matrices);
		track('theme_source_list', { action: 'add' });
	}

	function applyActivePipelineToAll() {
		const pipeline = clonePipeline(P);
		explorer.theme.lists = explorer.theme.lists.map((list: RampList) => ({
			anchors: list.anchors,
			pipeline: clonePipeline(pipeline)
		}));
		buildRamp(explorer, matrices);
		track('theme_source_list', { action: 'apply_pipeline_all' });
	}

	function removeActiveList() {
		if (explorer.theme.lists.length <= 1) return;
		const index = explorer.theme.activeList;
		explorer.theme.lists = explorer.theme.lists.filter((_: RampList, i: number) => i !== index);
		explorer.theme.activeList = Math.min(index, explorer.theme.lists.length - 1);
		explorer.theme.selectedPoint = null;
		buildRamp(explorer, matrices);
		track('theme_source_list', { action: 'remove' });
	}

	function removeControlPoint(index: number) {
		const next = points.filter((_: ThemeAnchor, i: number) => i !== index);
		setPoints(next);
		if (explorer.theme.selectedPoint !== null) {
			explorer.theme.selectedPoint = next.length ? Math.min(explorer.theme.selectedPoint, next.length - 1) : null;
		}
		buildRamp(explorer, matrices);
		track('theme_spline_point', { action: 'remove_panel' });
	}

	function selectControlPoint(index: number) {
		explorer.theme.selectedPoint = index;
		pickerOpen = true;
		track('theme_spline_point', { action: 'select_panel' });
	}

	function clampColor(color: [number, number, number] | number[]) {
		return color.map((v) => Math.min(Math.max(v, 0), 1)) as [number, number, number];
	}

	function setPickerColor(color: [number, number, number] | number[]) {
		const srgbLin = clampColor(color);
		const index = explorer.theme.selectedPoint;
		if (index !== null && points[index]) {
			setPoints(points.map((point: ThemeAnchor, i: number) => (i === index ? { srgbLin } : point)));
			buildRamp(explorer, matrices);
		} else {
			stagedPickerColor = srgbLin;
		}
	}

	// "+ Color picker": open the picker staging a new point; clicking it again
	// while staging closes it. From edit mode it switches to staging instead.
	function togglePickerForNewPoint() {
		if (pickerOpen && explorer.theme.selectedPoint === null) {
			pickerOpen = false;
			return;
		}
		explorer.theme.selectedPoint = null;
		explorer.theme.arm = null;
		pickerOpen = true;
	}

	function addStagedPickerPoint() {
		const next = [...points, { srgbLin: stagedPickerColor }];
		setPoints(next);
		explorer.theme.selectedPoint = next.length - 1;
		pickerOpen = true;
		buildRamp(explorer, matrices);
		track('theme_spline_point', { action: 'add_picker' });
	}

	function duplicateControlPoint(index: number) {
		const cp = points[index];
		if (!cp) return;
		const next = [...points];
		next.splice(index + 1, 0, { srgbLin: [...cp.srgbLin] as [number, number, number] });
		setPoints(next);
		explorer.theme.selectedPoint = index + 1;
		buildRamp(explorer, matrices);
		track('theme_spline_point', { action: 'duplicate_panel' });
	}

	function moveControlPoint(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= points.length) return;
		const next = [...points];
		[next[index], next[target]] = [next[target], next[index]];
		setPoints(next);
		explorer.theme.selectedPoint = target;
		buildRamp(explorer, matrices);
		track('theme_spline_point', { action: 'reorder_panel' });
	}

	const PLACE_OPTIONS: Array<{ value: PlacePolicy; label: string }> = [
		{ value: 'even', label: 'Even (perceptual ΔE)' },
		{ value: 'uniform', label: 'Uniform (curve parameter)' },
		{ value: 'tones', label: 'Lightness tones' },
		{ value: 'contrast', label: 'Contrast ladder' }
	];

	function rampChipStyle(stop: { srgbLin: [number, number, number]; inG: boolean }) {
		const simulated = simulateCvdSrgb(stop.srgbLin, explorer.cvd, explorer.cvdSev);
		const rgb = simulated.map((v) => {
			const c = Math.min(Math.max(v, 0), 1);
			const encoded = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
			return Math.round(encoded * 255);
		});
		return `background: rgb(${rgb.join(',')}); ${stop.inG ? '' : 'outline: 1px dashed var(--warn); outline-offset: -2px;'}`;
	}

</script>

{#if showListManager}
	<!-- Order follows the edit flow: choose list -> see its points -> add/edit -> aux. -->
	<div class="panel-label">Lists</div>
	<div class="list-chips" role="tablist" aria-label="Source lists">
		{#each explorer.theme.lists as list, i}
			<button
				type="button"
				class="list-chip"
				class:active={i === explorer.theme.activeList}
				role="tab"
				aria-selected={i === explorer.theme.activeList}
				title={`List ${i + 1} — ${list.anchors.length} pt${list.anchors.length === 1 ? '' : 's'}`}
				onclick={() => selectList(i)}
			>
				{i + 1}
			</button>
		{/each}
		<button type="button" class="list-chip list-add" title="Add a new source list" onclick={addList}>+</button>
		{#if explorer.theme.lists.length > 1}
			<button type="button" class="list-chip list-del" title="Remove the active list" onclick={removeActiveList}>×</button>
		{/if}
	</div>
	{#if explorer.theme.lists.length > 1}
		<div class="list-meta">
			<p class="note">Each list is its own ramp. Picking, dragging, and the rows below edit list {explorer.theme.activeList + 1}.</p>
			<button type="button" class="compact-action" disabled={!pipelinesDiffer} onclick={applyActivePipelineToAll}>
				Apply pipeline to all
			</button>
		</div>
		{#if pipelinesDiffer}
			<p class="note">Some lists use different pipeline settings.</p>
		{/if}
	{/if}
{/if}

{#if showSources}
	<div class="panel-label" style="margin-top: 8px">
		Points{explorer.theme.lists.length > 1 ? ` — list ${explorer.theme.activeList + 1}` : ''}
	</div>
	{#if points.length}
		<div class="cp-list">
			{#each points as cp, i}
				<div class="cp-row" class:active={explorer.theme.selectedPoint === i}>
					<button type="button" class="cp-select" onclick={() => selectControlPoint(i)}>
						<span class="anchor-label">{i + 1}</span>
						<span class="cp-chip" style={rampChipStyle({ srgbLin: cp.srgbLin, inG: true })}></span>
						<span class="cp-hex">{srgbHex(cp.srgbLin)}</span>
					</button>
					<button type="button" class="cp-action" title="Move point earlier" disabled={i === 0} onclick={() => moveControlPoint(i, -1)}>
						Up
					</button>
					<button
						type="button"
						class="cp-action"
						title="Move point later"
						disabled={i === points.length - 1}
						onclick={() => moveControlPoint(i, 1)}
					>
						Down
					</button>
					<button type="button" class="cp-action" title="Duplicate point" onclick={() => duplicateControlPoint(i)}>
						Copy
					</button>
					<button type="button" class="cp-del" title="Remove point" onclick={() => removeControlPoint(i)}>
						×
					</button>
				</div>
			{/each}
		</div>
	{:else}
		<p class="note">No points yet — add below, or hold A and click the solid.</p>
	{/if}
	<!-- Add actions are the footer of the points list: two sibling ways to append. -->
	<div class="add-actions">
		<button type="button" class:active={explorer.theme.arm === 'add'} onclick={toggleAddPoint}>
			{explorer.theme.arm === 'add' ? 'Adding… click the solid' : '+ Pick on solid'}
		</button>
		<button
			type="button"
			class:active={pickerOpen && explorer.theme.selectedPoint === null}
			onclick={togglePickerForNewPoint}
		>
			{pickerOpen && explorer.theme.selectedPoint === null ? 'Staging new point' : '+ Color picker'}
		</button>
	</div>
	{#if pickerOpen}
		<div class="source-picker">
			<div class="picker-heading">
				<span>
					{explorer.theme.selectedPoint !== null && points[explorer.theme.selectedPoint]
						? `Editing point ${explorer.theme.selectedPoint + 1}`
						: 'New source point'}
				</span>
				<span class="picker-actions">
					{#if explorer.theme.selectedPoint === null}
						<button type="button" class="cp-action" onclick={addStagedPickerPoint}>Add as new point</button>
					{/if}
					<button type="button" class="cp-action" onclick={() => (pickerOpen = false)}>Close</button>
				</span>
			</div>
			<ColorPicker value={pickerValue} onchange={setPickerColor} />
		</div>
	{/if}

	<ToggleRow label="Show points in 3D" bind:checked={explorer.theme.showPoints} />
	<label class="field-row">
		<span>Touch tool</span>
		<select bind:value={touchTool}>
			{#each touchToolOptions as tool}
				<option value={tool.value}>{tool.label}</option>
			{/each}
		</select>
	</label>
	<p class="note">Drag a point in 3D to move it · click selects · Delete removes · A + click adds.</p>
{/if}

{#if showInterpolate}
	<ToggleRow label="Enable interpolation" bind:checked={P.interpolateOn} />
	{#if !P.interpolateOn}
		<p class="note">Off: the picked source colors pass through as the stops (no curve).</p>
	{:else}
	<!-- Presets: quick (path type + space) combinations over the one interpolator. -->
	<div class="segmented" style="--segments: 3">
		<button type="button" onclick={() => applyPreset('segment')}>Segment</button>
		<button type="button" onclick={() => applyPreset('arc')}>Hue arc</button>
		<button type="button" onclick={() => applyPreset('spline')}>Spline</button>
	</div>
	<SegmentedControl
		bind:value={P.mode}
		onchange={setThemeMode}
		columns={2}
		options={[
			{ value: 'linear', label: 'Linear' },
			{ value: 'spline', label: 'Spline' }
		]}
	/>

	<SliderRow
		label="Steps"
		bind:value={P.steps}
		min={2}
		max={MAX_RAMP_STOPS}
		step={1}
		format={(value) => value.toFixed(0)}
	/>

	<label class="field-row">
		<span>Interpolate in</span>
		<select bind:value={P.splineSpace}>
			<option value="world">World (as shown)</option>
			{#each INTERP_SPACE_KEYS as key}
				<option value={key}>{INTERP_SPACES[key].label}</option>
			{/each}
		</select>
	</label>
	{#if spaceIsCyclic}
		<ToggleRow label="Long hue (other side)" bind:checked={P.arcLong} />
	{/if}
	<label class="field-row">
		<span>Curve constraint</span>
		<select bind:value={P.main.constraint}>
			{#each SPLINE_CONSTRAINT_OPTIONS as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</label>
	<p class="note stage-note">{constraintScopeNote}</p>
	{#if P.main.constraint === 'surface-oklab-project'}
		<label class="field-row">
			<span>Projection method</span>
			<select value={P.main.projection} onchange={(event) => setSurfaceProjection(event.currentTarget.value as SurfaceProjectionMethod)}>
				{#each SURFACE_PROJECTION_OPTIONS as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</label>
		{#if projectionUsesAlpha || projectionUsesFocus}
			<details class="advanced">
				<summary>Advanced projection</summary>
				{#if projectionUsesFocus}
					<SliderRow
						label="Focus L"
						bind:value={P.main.projectionParams.focusL}
						min={0}
						max={1}
						step={0.01}
						format={(value) => value.toFixed(2)}
					/>
					<p class="note">Focus L is the neutral-axis lightness that this projection pulls toward. The default 0.50 preserves the previous middle-focus behavior.</p>
				{/if}
				{#if projectionUsesAlpha}
					<SliderRow
						label="Adaptive alpha"
						bind:value={P.main.projectionParams.alpha}
						min={0}
						max={5}
						step={0.01}
						format={(value) => value.toFixed(2)}
					/>
					<div class="preset-row" aria-label="Adaptive alpha presets">
						{#each SURFACE_ALPHA_PRESETS as alpha}
							<button
								type="button"
								class:preset-active={Math.abs(P.main.projectionParams.alpha - alpha) < 0.001}
								onclick={() => setSurfaceProjectionAlpha(alpha)}
							>
								{alpha.toFixed(alpha < 0.1 ? 2 : 1)}
							</button>
						{/each}
						<span>{projectionAlphaStatus}</span>
					</div>
					<p class="note">Alpha changes how the path is projected onto the active clipped surface. Lower values preserve lightness more strongly; higher values compress more toward the projection focus.</p>
				{/if}
			</details>
		{/if}
	{/if}

	<p class="note">
		Builds the ramp path from the source points. Curve constraints shape this path before stops are placed; Gamut Map handles final generated out-of-gamut colors later.
	</p>
	<ToggleRow label="Show curve in 3D" bind:checked={explorer.theme.showCurve} />
	{/if}
{/if}

{#if showAdjust}
	<div class:separator={!showAll}>
		<div class="panel-label" style="margin-top: 0">Place / sampling</div>
		{#if !P.interpolateOn}
			<p class="note" style="margin-top: 0">Requires interpolation — the picked colors pass through unchanged.</p>
		{:else}
		<p class="note" style="margin-top: 0">Where the stops land on the interpolated curve. Runs after interpolation, before gamut mapping.</p>
		<ToggleRow label="Enable placement" bind:checked={P.placeOn} />
		{#if P.placeOn}
		<label class="field-row">
			<span>Sampling</span>
			<select bind:value={P.place}>
				{#each PLACE_OPTIONS as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</label>
		{#if P.place === 'contrast'}
			<div class="segmented" style="--segments: 2">
				<button type="button" class:active={P.wcagBg === 'white'} onclick={() => (P.wcagBg = 'white')}>
					vs White
				</button>
				<button type="button" class:active={P.wcagBg === 'black'} onclick={() => (P.wcagBg = 'black')}>
					vs Black
				</button>
			</div>
			<SliderRow label="Min contrast" bind:value={P.contrastMin} min={1} max={21} step={0.5} format={(value) => `${value.toFixed(1)}:1`} />
			<SliderRow label="Max contrast" bind:value={P.contrastMax} min={1} max={21} step={0.5} format={(value) => `${value.toFixed(1)}:1`} />
		{/if}
		{/if}
		{/if}
		<ToggleRow label="Show stops in 3D" bind:checked={explorer.theme.showStops} />
	</div>
{/if}

{#if showExpand}
	<div class:separator={!showAll}>
		<div class="panel-label" style="margin-top: 0">Expand to palette (Spread)</div>
		<p class="note" style="margin-top: 0">
			One generalized Spread: rows make related ramps; columns expand each stop into variants. Presets just set the parameters.
		</p>
		<ToggleRow label="Enable expand" bind:checked={P.expandOn} />
		{#if P.expandOn}
			<ToggleRow label="Show palette in 3D" bind:checked={explorer.theme.showPalette} />
			<label class="field-row">
				<span>Extension constraint</span>
				<select bind:value={P.extension.constraint}>
					{#each SPLINE_CONSTRAINT_OPTIONS as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</label>
			<p class="note stage-note">{extensionConstraintNote}</p>
			{#if P.extension.constraint === 'surface-oklab-project'}
				<label class="field-row">
					<span>Projection method</span>
					<select value={P.extension.projection} onchange={(event) => setExtensionProjection(event.currentTarget.value as SurfaceProjectionMethod)}>
						{#each SURFACE_PROJECTION_OPTIONS as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</label>
				{#if extensionUsesAlpha || extensionUsesFocus}
					<details class="advanced">
						<summary>Advanced extension projection</summary>
						{#if extensionUsesFocus}
							<SliderRow
								label="Focus L"
								bind:value={P.extension.projectionParams.focusL}
								min={0}
								max={1}
								step={0.01}
								format={(value) => value.toFixed(2)}
							/>
							<p class="note">Focus L is the neutral-axis lightness that generated palette variants project toward.</p>
						{/if}
						{#if extensionUsesAlpha}
							<SliderRow
								label="Adaptive alpha"
								bind:value={P.extension.projectionParams.alpha}
								min={0}
								max={5}
								step={0.01}
								format={(value) => value.toFixed(2)}
							/>
							<div class="preset-row" aria-label="Extension adaptive alpha presets">
								{#each SURFACE_ALPHA_PRESETS as alpha}
									<button
										type="button"
										class:preset-active={Math.abs(P.extension.projectionParams.alpha - alpha) < 0.001}
										onclick={() => setExtensionProjectionAlpha(alpha)}
									>
										{alpha.toFixed(alpha < 0.1 ? 2 : 1)}
									</button>
								{/each}
								<span>{extensionAlphaStatus}</span>
							</div>
							<p class="note">Alpha controls how strongly generated palette variants compress toward the projection focus before terminal gamut mapping.</p>
						{/if}
					</details>
				{/if}
			{/if}
			<div class="segmented" style="--segments: 3">
				{#each EXPAND_PRESETS.slice(0, 3) as preset}
					<button type="button" onclick={preset.apply}>{preset.label}</button>
				{/each}
			</div>
			<div class="segmented" style="--segments: 3">
				{#each EXPAND_PRESETS.slice(3) as preset}
					<button type="button" onclick={preset.apply}>{preset.label}</button>
				{/each}
			</div>

			{#each [
				{ label: 'Related ramps (rows)', g: P.expandRows },
				{ label: 'Per-stop variants (columns)', g: P.expandCols }
			] as section}
				<div class="panel-label" style="margin-top: 8px">{section.label}</div>
				<SliderRow label="Count" bind:value={section.g.count} min={1} max={12} step={1} format={(value) => value.toFixed(0)} />
				<label class="field-row">
					<span>Hue</span>
					<select bind:value={section.g.hue.dir}>
						{#each SPREAD_DIR_OPTIONS as opt}<option value={opt.value}>{opt.label}</option>{/each}
					</select>
				</label>
				{#if section.g.hue.dir !== 'off'}
					<SliderRow label="Δ hue" bind:value={section.g.hue.delta} min={-360} max={360} step={5} format={(value) => `${value.toFixed(0)} deg`} />
				{/if}
				<label class="field-row">
					<span>Chroma</span>
					<select bind:value={section.g.chroma.dir}>
						{#each SPREAD_DIR_OPTIONS as opt}<option value={opt.value}>{opt.label}</option>{/each}
					</select>
				</label>
				{#if section.g.chroma.dir !== 'off'}
					<SliderRow label="Δ chroma" bind:value={section.g.chroma.delta} min={-0.4} max={0.4} step={0.005} format={(value) => value.toFixed(3)} />
				{/if}
				<label class="field-row">
					<span>Lightness</span>
					<select bind:value={section.g.light.dir}>
						{#each SPREAD_DIR_OPTIONS as opt}<option value={opt.value}>{opt.label}</option>{/each}
					</select>
				</label>
				{#if section.g.light.dir !== 'off'}
					<SliderRow label="Δ lightness" bind:value={section.g.light.delta} min={-1} max={1} step={0.01} format={(value) => value.toFixed(2)} />
				{/if}
			{/each}

			{#if isPalette}
				<div style="margin-top: 6px">
					<PaletteStrip layout="fluid" rows={explorer.theme.grid} cvd={explorer.cvd} cvdSev={explorer.cvdSev} ariaLabel="Expanded palette preview" />
				</div>
			{/if}
		{/if}
	</div>
{/if}

{#if showGamutMap}
	<div class="target-row" aria-label="Gamut map target">
		<span>Target gamut</span>
		<strong>{GAMUT_MAP_TARGET}</strong>
	</div>
	<label class="field-row">
		<span>Gamut mapping</span>
		<select
			value={explorer.theme.gamutMap}
			onchange={(e) => setGamutMap((e.currentTarget as HTMLSelectElement).value as ExplorerState['theme']['gamutMap'])}
		>
			{#each GAMUT_MAP_OPTIONS as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</label>
	<p class="note">
		This terminal ramp policy reconciles generated stops with the sRGB export target. It is independent of the Explorer gamut and does not reshape the 3D solid.
	</p>
	{#if gamutMapUsesAlpha || gamutMapUsesFocus}
		<details class="advanced">
			<summary>Advanced gamut mapping</summary>
			{#if gamutMapUsesFocus}
				<SliderRow
					label="Focus L"
					bind:value={explorer.theme.gamutMapParams.focusL}
					min={0}
					max={1}
					step={0.01}
					format={(value) => value.toFixed(2)}
				/>
				<p class="note">Focus L is the neutral-axis lightness that generated colors project toward before intersecting the sRGB target gamut.</p>
			{/if}
			{#if gamutMapUsesAlpha}
				<SliderRow
					label="Adaptive alpha"
					bind:value={explorer.theme.gamutMapParams.alpha}
					min={0}
					max={5}
					step={0.01}
					format={(value) => value.toFixed(2)}
				/>
				<div class="preset-row" aria-label="Gamut map adaptive alpha presets">
					{#each SURFACE_ALPHA_PRESETS as alpha}
						<button
							type="button"
							class:preset-active={Math.abs(explorer.theme.gamutMapParams.alpha - alpha) < 0.001}
							onclick={() => setGamutMapAlpha(alpha)}
						>
							{alpha.toFixed(alpha < 0.1 ? 2 : 1)}
						</button>
					{/each}
					<span>{gamutMapAlphaStatus}</span>
				</div>
				<p class="note">Alpha changes how adaptive methods project generated ramp stops into the export gamut. It is independent of the Interpolate curve constraint alpha.</p>
			{/if}
		</details>
	{/if}
	{#if explorer.theme.stops.length}
		<p class="note" style="margin-top: 0">
			{oogBefore} out of gamut{explorer.theme.gamutMap === 'none' ? '' : ` → ${oogAfter} after mapping`}
		</p>
		{#if explorer.theme.gamutMap !== 'none'}
			<div class="raw-final">
				<span class="rf-label">Raw</span>
				<PaletteStrip layout="fluid" rows={[explorer.theme.rawStops]} cvd={explorer.cvd} cvdSev={explorer.cvdSev} ariaLabel="Raw ramp before gamut mapping" />
				<span class="rf-label">Final</span>
				<PaletteStrip layout="fluid" rows={[explorer.theme.stops]} cvd={explorer.cvd} cvdSev={explorer.cvdSev} ariaLabel="Final ramp after gamut mapping" />
			</div>
		{/if}
	{/if}
{/if}

{#if showExport}
	{#if explorer.theme.stops.length}
		<PaletteStrip
			layout="fluid"
			rows={isPalette ? explorer.theme.grid : [explorer.theme.stops]}
			cvd={explorer.cvd}
			cvdSev={explorer.cvdSev}
			ariaLabel="Exported palette preview"
		/>
	{:else}
		<div class="ramp" aria-label="Theme ramp preview">
			{#each Array.from({ length: P.steps }) as _}
				<div class="ramp-chip"></div>
			{/each}
		</div>
	{/if}

	<button type="button" onclick={() => showExportText('css')}>Export CSS tokens (oklch)</button>
	<button type="button" style="margin-top: 4px" onclick={() => showExportText('json')}>Export DTCG JSON</button>
	<textarea class="export-box" class:visible={!!exportText} readonly spellcheck="false" bind:value={exportText}></textarea>
	<p class="note">Exports serialize final stops after adjustment and sRGB-target gamut mapping.</p>
{/if}

<style>
	.field-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin: 6px 0;
		font-size: 0.923rem;
	}
	.field-row select {
		flex: 1;
		max-width: 60%;
	}
	.target-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin: 0 0 6px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: color-mix(in srgb, var(--panel2) 70%, transparent);
		padding: 5px 7px;
		color: var(--muted);
		font-size: 0.846rem;
	}
	.target-row strong {
		color: var(--text);
		font-size: 0.846rem;
		font-weight: 700;
	}
	.advanced {
		margin: 6px 0;
		border-top: 1px solid var(--border);
		padding-top: 6px;
	}
	.advanced summary {
		cursor: pointer;
		color: var(--muted);
		font-size: 0.846rem;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.preset-row {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		align-items: center;
		gap: 4px;
		margin: 4px 0 2px;
		color: var(--muted);
		font-size: 0.846rem;
	}
	.preset-row button {
		width: auto;
		min-width: 0;
		padding: 3px 6px;
		font-size: 0.846rem;
	}
	.preset-row .preset-active {
		border-color: var(--accent, #d7b33f);
		color: var(--text);
	}
	.preset-row span {
		grid-column: 1 / -1;
		justify-self: end;
		font-weight: 650;
	}
	.anchor-label {
		color: var(--muted);
		font-weight: 600;
		min-width: 12px;
	}
	.list-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 6px;
	}
	.list-chip {
		flex: none;
		width: 28px;
		padding: 3px 0;
		font-size: 0.846rem;
		font-variant-numeric: tabular-nums;
		border: 1px solid transparent;
		border-radius: 4px;
	}
	.list-chip.active {
		border-color: var(--accent, #5ab);
	}
	.list-del {
		font-size: 1.077rem;
		line-height: 1;
	}
	.list-meta {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 8px;
		align-items: center;
		margin: 4px 0 6px;
	}
	.compact-action {
		width: auto;
		white-space: nowrap;
		padding: 5px 8px;
		font-size: 0.846rem;
	}
	.cp-list {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-bottom: 6px;
	}
	.cp-row {
		display: flex;
		align-items: center;
		gap: 4px;
		border: 1px solid transparent;
		border-radius: 4px;
		padding: 1px;
	}
	.cp-row.active {
		border-color: var(--accent, #5ab);
	}
	.cp-select {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		text-align: left;
		margin: 0;
	}
	.cp-chip {
		width: 16px;
		height: 16px;
		border-radius: 3px;
		flex: none;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
	}
	.cp-hex {
		font-variant-numeric: tabular-nums;
		text-transform: uppercase;
		font-size: 0.846rem;
	}
	.cp-action {
		flex: none;
		width: auto;
		padding: 3px 6px;
		font-size: 0.769rem;
	}
	.cp-action:disabled {
		cursor: default;
		opacity: 0.35;
	}
	.cp-del {
		flex: none;
		width: 24px;
		padding: 0;
		line-height: 1;
		font-size: 1.231rem;
	}
	.add-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		margin-top: 6px;
	}
	.picker-actions {
		display: flex;
		gap: 4px;
		flex: none;
	}
	.source-picker {
		display: grid;
		gap: 6px;
		margin-top: 6px;
	}
	.picker-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		color: var(--muted);
		font-size: 0.846rem;
	}
	.raw-final {
		display: grid;
		gap: 3px;
		margin-top: 4px;
	}
	.rf-label {
		color: var(--dim);
		font-size: 0.692rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
</style>
