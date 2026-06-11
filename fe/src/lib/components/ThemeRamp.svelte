<script lang="ts">
	import SegmentedControl from './SegmentedControl.svelte';
	import SliderRow from './SliderRow.svelte';
	import ToggleRow from './ToggleRow.svelte';
	import { track } from '$lib/analytics/umami';
	import { simulateCvdSrgb } from '$lib/color/cvd';
	import { INTERP_SPACES, INTERP_SPACE_KEYS } from '$lib/color/interp';
	import { buildRamp, exportDTCG, exportDTCGGrid, exportTokens, exportTokensGrid, srgbHex } from '$lib/engine/theme';

	import type { ExplorerState, ThemeAnchor } from '$lib/engine/types';
	import type { DerivedMatrices } from '$lib/renderer/uniforms';
	import type { TouchTool } from './Viewport.svelte';

	type RampPanel = 'all' | 'sources' | 'interpolate' | 'adjust' | 'expand' | 'gamut-map' | 'export';

	let {
		state: explorer = $bindable(),
		matrices,
		touchTool = $bindable('auto'),
		panel = 'all'
	} = $props<{ state: ExplorerState; matrices: DerivedMatrices; touchTool?: TouchTool; panel?: RampPanel }>();
	let exportText = $state('');

	const showAll = $derived(panel === 'all');
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
		{ value: 'pickA', label: 'Pick A' },
		{ value: 'pickB', label: 'Pick B' }
	];

	// Spline curve geometry constraint (separate from gamut handling).
	const SPLINE_CONSTRAINT_OPTIONS: Array<{ value: ExplorerState['theme']['splineConstraint']; label: string }> = [
		{ value: 'free', label: 'Free' },
		{ value: 'surface', label: 'Surface (radial shell)' }
	];

	// Global out-of-gamut policy (applies to every theme mode + export).
	const GAMUT_MAP_OPTIONS: Array<{ value: ExplorerState['theme']['gamutMap']; label: string }> = [
		{ value: 'none', label: 'None (show OOG)' },
		{ value: 'clip', label: 'Clip (clamp)' },
		{ value: 'preserve-chroma', label: 'Preserve chroma' },
		{ value: 'project-0.5', label: 'Project to L 0.5' },
		{ value: 'project-cusp', label: 'Project to cusp' },
		{ value: 'adaptive-0.5', label: 'Adaptive (0.5)' },
		{ value: 'adaptive-cusp', label: 'Adaptive (cusp)' }
	];

	function setGamutMap(method: ExplorerState['theme']['gamutMap']) {
		explorer.theme.gamutMap = method;
		buildRamp(explorer, matrices);
		track('theme_gamut_map', { method });
	}

	const oogBefore = $derived(explorer.theme.rawStops.reduce((n: number, s: { inG: boolean }) => (s.inG ? n : n + 1), 0));
	const oogAfter = $derived(explorer.theme.stops.reduce((n: number, s: { inG: boolean }) => (s.inG ? n : n + 1), 0));

	const isPalette = $derived(explorer.theme.expand !== 'none' && explorer.theme.grid.length > 0);

	function showExportText(kind: 'css' | 'json') {
		if (isPalette) {
			exportText = kind === 'css' ? exportTokensGrid(explorer.theme.grid) : exportDTCGGrid(explorer.theme.grid);
		} else {
			exportText = kind === 'css' ? exportTokens(explorer.theme.stops) : exportDTCG(explorer.theme.stops);
		}
		navigator.clipboard?.writeText(exportText).catch(() => {});
		track('theme_export', { format: kind === 'css' ? 'css' : 'dtcg' });
	}

	const EXPAND_OPTIONS: Array<{ value: ExplorerState['theme']['expand']; label: string }> = [
		{ value: 'none', label: 'None (single ramp)' },
		{ value: 'tints-shades', label: 'Tints & shades' },
		{ value: 'spread', label: 'Spread (hue / chroma fan)' }
	];

	function setThemeMode(mode: typeof explorer.theme.mode) {
		explorer.theme.mode = mode;
		track('theme_mode_change', { mode });
	}

	function toggleAddPoint() {
		explorer.theme.arm = explorer.theme.arm === 'add' ? null : 'add';
	}

	// Long-hue only matters for cyclic (cylindrical) interpolation spaces.
	const spaceIsCyclic = $derived(
		explorer.theme.splineSpace !== 'world' &&
			INTERP_SPACES[explorer.theme.splineSpace as keyof typeof INTERP_SPACES]?.cyclic !== null
	);

	// Presets are just (path type + space) shortcuts over the single interpolator.
	function applyPreset(kind: 'segment' | 'arc' | 'spline') {
		if (kind === 'segment') {
			explorer.theme.mode = 'linear';
			explorer.theme.splineSpace = 'world';
		} else if (kind === 'arc') {
			explorer.theme.mode = 'linear';
			explorer.theme.splineSpace = 'oklch';
		} else {
			explorer.theme.mode = 'spline';
			if (explorer.theme.splineSpace === 'world') explorer.theme.splineSpace = 'oklch';
		}
		track('theme_mode_change', { mode: explorer.theme.mode });
	}

	function removeControlPoint(index: number) {
		explorer.theme.points = explorer.theme.points.filter((_: ThemeAnchor, i: number) => i !== index);
		const len = explorer.theme.points.length;
		if (explorer.theme.selectedPoint !== null) {
			explorer.theme.selectedPoint = len ? Math.min(explorer.theme.selectedPoint, len - 1) : null;
		}
		buildRamp(explorer, matrices);
		track('theme_spline_point', { action: 'remove_panel' });
	}

	function selectControlPoint(index: number) {
		explorer.theme.selectedPoint = index;
		track('theme_spline_point', { action: 'select_panel' });
	}

	function duplicateControlPoint(index: number) {
		const cp = explorer.theme.points[index];
		if (!cp) return;
		const next = [...explorer.theme.points];
		next.splice(index + 1, 0, { srgbLin: [...cp.srgbLin] as [number, number, number] });
		explorer.theme.points = next;
		explorer.theme.selectedPoint = index + 1;
		buildRamp(explorer, matrices);
		track('theme_spline_point', { action: 'duplicate_panel' });
	}

	function moveControlPoint(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= explorer.theme.points.length) return;
		const next = [...explorer.theme.points];
		[next[index], next[target]] = [next[target], next[index]];
		explorer.theme.points = next;
		explorer.theme.selectedPoint = target;
		buildRamp(explorer, matrices);
		track('theme_spline_point', { action: 'reorder_panel' });
	}

	const PLACE_OPTIONS: Array<{ value: ExplorerState['theme']['place']; label: string }> = [
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

{#if showSources}
	<div class="panel-label">Pick source colors</div>
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
	<button type="button" class:active={explorer.theme.arm === 'add'} onclick={toggleAddPoint}>
		{explorer.theme.arm === 'add' ? 'Adding… click the solid' : '+ Add point'}
	</button>
	<label class="field-row">
		<span>Touch tool</span>
		<select bind:value={touchTool}>
			{#each touchToolOptions as tool}
				<option value={tool.value}>{tool.label}</option>
			{/each}
		</select>
	</label>
	<p class="note">
		Arm a target, then click the solid or slice cap. Drag a point to move it; click it to select, Delete to remove. Segment/arc use the first two (A, B); spline uses all.
	</p>

	{#if explorer.theme.points.length}
		<div class="panel-label" style="margin-top: 8px">Points</div>
		<div class="cp-list">
			{#each explorer.theme.points as cp, i}
				<div class="cp-row" class:active={explorer.theme.selectedPoint === i}>
					<button type="button" class="cp-select" onclick={() => selectControlPoint(i)}>
						<span class="anchor-label">{explorer.theme.mode !== 'spline' && i < 2 ? (i === 0 ? 'A' : 'B') : i + 1}</span>
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
						disabled={i === explorer.theme.points.length - 1}
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
		<p class="note">No source points yet — pick from the solid to add them.</p>
	{/if}
{/if}

{#if showInterpolate}
	<!-- Presets: quick (path type + space) combinations over the one interpolator. -->
	<div class="segmented" style="--segments: 3">
		<button type="button" onclick={() => applyPreset('segment')}>Segment</button>
		<button type="button" onclick={() => applyPreset('arc')}>Hue arc</button>
		<button type="button" onclick={() => applyPreset('spline')}>Spline</button>
	</div>
	<SegmentedControl
		bind:value={explorer.theme.mode}
		onchange={setThemeMode}
		columns={2}
		options={[
			{ value: 'linear', label: 'Linear' },
			{ value: 'spline', label: 'Spline' }
		]}
	/>

	<SliderRow
		label="Steps"
		bind:value={explorer.theme.steps}
		min={2}
		max={27}
		step={1}
		format={(value) => value.toFixed(0)}
	/>

	<label class="field-row">
		<span>Interpolate in</span>
		<select bind:value={explorer.theme.splineSpace}>
			<option value="world">World (as shown)</option>
			{#each INTERP_SPACE_KEYS as key}
				<option value={key}>{INTERP_SPACES[key].label}</option>
			{/each}
		</select>
	</label>
	{#if spaceIsCyclic}
		<ToggleRow label="Long hue (other side)" bind:checked={explorer.theme.arcLong} />
	{/if}
	<label class="field-row">
		<span>Curve constraint</span>
		<select bind:value={explorer.theme.splineConstraint}>
			{#each SPLINE_CONSTRAINT_OPTIONS as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</label>

	<p class="note">
		Builds the ramp path from the source points. A single point yields one seed stop — useful with the spread expander.
	</p>
{/if}

{#if showAdjust}
	<div class:separator={!showAll}>
		<div class="panel-label" style="margin-top: 0">Place / sampling</div>
		<p class="note" style="margin-top: 0">Where the stops land on the interpolated curve. Runs after interpolation, before gamut mapping.</p>
		<label class="field-row">
			<span>Sampling</span>
			<select bind:value={explorer.theme.place}>
				{#each PLACE_OPTIONS as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</label>
		{#if explorer.theme.place === 'contrast'}
			<div class="segmented" style="--segments: 2">
				<button type="button" class:active={explorer.theme.wcagBg === 'white'} onclick={() => (explorer.theme.wcagBg = 'white')}>
					vs White
				</button>
				<button type="button" class:active={explorer.theme.wcagBg === 'black'} onclick={() => (explorer.theme.wcagBg = 'black')}>
					vs Black
				</button>
			</div>
		{/if}
	</div>
{/if}

{#if showExpand}
	<div class:separator={!showAll}>
		<div class="panel-label" style="margin-top: 0">Expand to palette</div>
		<p class="note" style="margin-top: 0">Generate a 2-D palette by expanding each stop into a row of variants.</p>
		<label class="field-row">
			<span>Generator</span>
			<select bind:value={explorer.theme.expand}>
				{#each EXPAND_OPTIONS as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</label>
		{#if explorer.theme.expand !== 'none'}
			<SliderRow label="Columns" bind:value={explorer.theme.expandSteps} min={2} max={12} step={1} format={(value) => value.toFixed(0)} />
			{#if explorer.theme.expand === 'spread'}
				<SliderRow label="Delta hue" bind:value={explorer.theme.dh} min={0} max={180} step={1} format={(value) => `${value.toFixed(0)} deg`} />
				<SliderRow label="Delta chroma" bind:value={explorer.theme.dc} min={0} max={0.4} step={0.005} format={(value) => value.toFixed(2)} />
				<div class="segmented" style="--segments: 2">
					<button type="button" class:active={explorer.theme.cprof === 'linear'} onclick={() => (explorer.theme.cprof = 'linear')}>Linear dc</button>
					<button type="button" class:active={explorer.theme.cprof === 'mirror'} onclick={() => (explorer.theme.cprof = 'mirror')}>Mirror dc</button>
				</div>
			{/if}
			{#if isPalette}
				<div class="palette-grid">
					{#each explorer.theme.grid as row}
						<div class="ramp">
							{#each row as cell}
								<div class="ramp-chip" title={cell.hex} style={rampChipStyle(cell)}></div>
							{/each}
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
{/if}

{#if showGamutMap}
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
		This terminal ramp policy reconciles generated stops with sRGB export. It does not reshape the 3D solid.
	</p>
	{#if explorer.theme.stops.length}
		<p class="note" style="margin-top: 0">
			{oogBefore} out of gamut{explorer.theme.gamutMap === 'none' ? '' : ` → ${oogAfter} after mapping`}
		</p>
		{#if explorer.theme.gamutMap !== 'none'}
			<div class="raw-final">
				<span class="rf-label">Raw</span>
				<div class="ramp">
					{#each explorer.theme.rawStops as stop}
						<div class="ramp-chip" title={stop.hex} style={rampChipStyle(stop)}></div>
					{/each}
				</div>
				<span class="rf-label">Final</span>
				<div class="ramp">
					{#each explorer.theme.stops as stop}
						<div class="ramp-chip" title={stop.hex} style={rampChipStyle(stop)}></div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
{/if}

{#if showExport}
	<div class="ramp" aria-label="Theme ramp preview">
		{#if explorer.theme.stops.length}
			{#each explorer.theme.stops as stop}
				<div
					class="ramp-chip"
					title={`${stop.hex}${explorer.cvd === 'none' ? '' : ' source, CVD preview shown'}`}
					style={rampChipStyle(stop)}
				></div>
			{/each}
		{:else}
			{#each Array.from({ length: explorer.theme.steps }) as _}
				<div class="ramp-chip"></div>
			{/each}
		{/if}
	</div>

	<button type="button" onclick={() => showExportText('css')}>Export CSS tokens (oklch)</button>
	<button type="button" style="margin-top: 4px" onclick={() => showExportText('json')}>Export DTCG JSON</button>
	<textarea class="export-box" class:visible={!!exportText} readonly spellcheck="false" bind:value={exportText}></textarea>
	<p class="note">Exports serialize final stops after adjustment and gamut mapping.</p>
{/if}

<style>
	.field-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin: 6px 0;
		font-size: 12px;
	}
	.field-row select {
		flex: 1;
		max-width: 60%;
	}
	.anchor-label {
		color: var(--muted);
		font-weight: 600;
		min-width: 12px;
	}
	.palette-grid {
		display: grid;
		gap: 2px;
		margin-top: 6px;
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
		font-size: 11px;
	}
	.cp-action {
		flex: none;
		width: auto;
		padding: 3px 6px;
		font-size: 10px;
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
		font-size: 16px;
	}
	.raw-final {
		display: grid;
		gap: 3px;
		margin-top: 4px;
	}
	.rf-label {
		color: var(--dim);
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
</style>
