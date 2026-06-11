<script lang="ts">
	import SegmentedControl from './SegmentedControl.svelte';
	import RampPipelinePopover from './RampPipelinePopover.svelte';
	import SliderRow from './SliderRow.svelte';
	import ToggleRow from './ToggleRow.svelte';
	import { track } from '$lib/analytics/umami';
	import { simulateCvdSrgb } from '$lib/color/cvd';
	import { INTERP_SPACES, INTERP_SPACE_KEYS } from '$lib/color/interp';
	import { buildRamp, exportDTCG, exportTokens, fitEven, fitWcag, srgbHex } from '$lib/engine/theme';

	import type { ExplorerState, ThemeAnchor } from '$lib/engine/types';
	import type { DerivedMatrices } from '$lib/renderer/uniforms';
	import type { TouchTool } from './Viewport.svelte';

	type RampPanel = 'all' | 'pick' | 'points' | 'interpolate' | 'adjust' | 'gamut-map' | 'export';

	let {
		state: explorer = $bindable(),
		matrices,
		touchTool = $bindable('auto'),
		panel = 'all'
	} = $props<{ state: ExplorerState; matrices: DerivedMatrices; touchTool?: TouchTool; panel?: RampPanel }>();
	let exportText = $state('');

	const showAll = $derived(panel === 'all');
	const showPick = $derived(showAll || panel === 'pick');
	const showPoints = $derived(showAll || panel === 'points');
	const showInterpolate = $derived(showAll || panel === 'interpolate');
	const showAdjust = $derived(showAll || panel === 'adjust');
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

	function showExportText(kind: 'css' | 'json') {
		exportText = kind === 'css' ? exportTokens(explorer.theme.stops) : exportDTCG(explorer.theme.stops);
		navigator.clipboard?.writeText(exportText).catch(() => {});
		track('theme_export', { format: kind === 'css' ? 'css' : 'dtcg' });
	}

	function setThemeMode(mode: typeof explorer.theme.mode) {
		explorer.theme.mode = mode;
		if (mode !== 'spline') {
			explorer.theme.selectedCp = null;
			if (explorer.theme.arm === 'spline-add') explorer.theme.arm = null;
		}
		track('theme_mode_change', { mode });
	}

	function toggleSplineAdd() {
		explorer.theme.arm = explorer.theme.arm === 'spline-add' ? null : 'spline-add';
	}

	function removeControlPoint(index: number) {
		explorer.theme.controlPoints = explorer.theme.controlPoints.filter((_: ThemeAnchor, i: number) => i !== index);
		const len = explorer.theme.controlPoints.length;
		if (explorer.theme.selectedCp !== null) {
			explorer.theme.selectedCp = len ? Math.min(explorer.theme.selectedCp, len - 1) : null;
		}
		buildRamp(explorer, matrices);
		track('theme_spline_point', { action: 'remove_panel' });
	}

	function selectControlPoint(index: number) {
		explorer.theme.selectedCp = index;
		track('theme_spline_point', { action: 'select_panel' });
	}

	function duplicateControlPoint(index: number) {
		const cp = explorer.theme.controlPoints[index];
		if (!cp) return;
		const next = [...explorer.theme.controlPoints];
		next.splice(index + 1, 0, { srgbLin: [...cp.srgbLin] as [number, number, number] });
		explorer.theme.controlPoints = next;
		explorer.theme.selectedCp = index + 1;
		buildRamp(explorer, matrices);
		track('theme_spline_point', { action: 'duplicate_panel' });
	}

	function moveControlPoint(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= explorer.theme.controlPoints.length) return;
		const next = [...explorer.theme.controlPoints];
		[next[index], next[target]] = [next[target], next[index]];
		explorer.theme.controlPoints = next;
		explorer.theme.selectedCp = target;
		buildRamp(explorer, matrices);
		track('theme_spline_point', { action: 'reorder_panel' });
	}

	function fitWcagTracked() {
		fitWcag(explorer, matrices);
		track('theme_fit_wcag', { bg: explorer.theme.wcagBg, target: explorer.theme.aa });
	}

	function fitEvenTracked() {
		fitEven(explorer, matrices);
		track('theme_fit_even');
	}

	function rampChipStyle(stop: { srgbLin: [number, number, number]; inG: boolean }) {
		const simulated = simulateCvdSrgb(stop.srgbLin, explorer.cvd, explorer.cvdSev);
		const rgb = simulated.map((v) => {
			const c = Math.min(Math.max(v, 0), 1);
			const encoded = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
			return Math.round(encoded * 255);
		});
		return `background: rgb(${rgb.join(',')}); ${stop.inG ? '' : 'outline: 1px dashed var(--warn); outline-offset: -2px;'}`;
	}

	function anchorStyle(anchor: ThemeAnchor | null) {
		if (!anchor) return '';
		return rampChipStyle({ srgbLin: anchor.srgbLin, inG: true });
	}

</script>

{#if showPick}
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
	{#if explorer.theme.mode === 'spline'}
		<button type="button" class:active={explorer.theme.arm === 'spline-add'} onclick={toggleSplineAdd}>
			{explorer.theme.arm === 'spline-add' ? 'Adding… click the solid' : '+ Add control point'}
		</button>
	{/if}
	<label class="field-row">
		<span>Touch tool</span>
		<select bind:value={touchTool}>
			{#each touchToolOptions as tool}
				<option value={tool.value}>{tool.label}</option>
			{/each}
		</select>
	</label>
	<p class="note">
		Arm a target, then click the solid or slice cap. Picked colors become ramp anchors or spline control points.
	</p>
{/if}

{#if showPoints}
	<div class="panel-label" class:separator={!showPick}>Anchors</div>
	<div class="anchor-list">
		<div class="anchor-row">
			<span class="anchor-label">A</span>
			<span class="cp-chip" style={anchorStyle(explorer.theme.A)}></span>
			<span class="cp-hex">{explorer.theme.A ? srgbHex(explorer.theme.A.srgbLin) : 'Not set'}</span>
		</div>
		<div class="anchor-row">
			<span class="anchor-label">B</span>
			<span class="cp-chip" style={anchorStyle(explorer.theme.B)}></span>
			<span class="cp-hex">{explorer.theme.B ? srgbHex(explorer.theme.B.srgbLin) : 'Not set'}</span>
		</div>
	</div>

	{#if explorer.theme.controlPoints.length}
		<div class="panel-label" style="margin-top: 8px">Spline points</div>
		<div class="cp-list">
			{#each explorer.theme.controlPoints as cp, i}
				<div class="cp-row" class:active={explorer.theme.selectedCp === i}>
					<button type="button" class="cp-select" onclick={() => selectControlPoint(i)}>
						<span class="cp-chip" style={rampChipStyle({ srgbLin: cp.srgbLin, inG: true })}></span>
						<span class="cp-hex">{srgbHex(cp.srgbLin)}</span>
					</button>
					<button type="button" class="cp-action" title="Move control point earlier" disabled={i === 0} onclick={() => moveControlPoint(i, -1)}>
						Up
					</button>
					<button
						type="button"
						class="cp-action"
						title="Move control point later"
						disabled={i === explorer.theme.controlPoints.length - 1}
						onclick={() => moveControlPoint(i, 1)}
					>
						Down
					</button>
					<button type="button" class="cp-action" title="Duplicate control point" onclick={() => duplicateControlPoint(i)}>
						Copy
					</button>
					<button type="button" class="cp-del" title="Remove control point" onclick={() => removeControlPoint(i)}>
						×
					</button>
				</div>
			{/each}
		</div>
	{:else}
		<p class="note">Spline control points appear here after using Add control point from Pick.</p>
	{/if}
{/if}

{#if showInterpolate}
	<SegmentedControl
		bind:value={explorer.theme.mode}
		onchange={setThemeMode}
		columns={2}
		options={[
			{ value: 'seg', label: 'Segment' },
			{ value: 'arc', label: 'Hue arc' },
			{ value: 'spread', label: 'Spread A' },
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

	{#if explorer.theme.mode === 'spline'}
		<label class="field-row">
			<span>Interpolate in</span>
			<select bind:value={explorer.theme.splineSpace}>
				{#each INTERP_SPACE_KEYS as key}
					<option value={key}>{INTERP_SPACES[key].label}</option>
				{/each}
			</select>
		</label>
		<label class="field-row">
			<span>Curve constraint</span>
			<select bind:value={explorer.theme.splineConstraint}>
				{#each SPLINE_CONSTRAINT_OPTIONS as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</label>
	{/if}

	{#if explorer.theme.mode === 'arc'}
		<ToggleRow label="Long path (other side)" bind:checked={explorer.theme.arcLong} />
	{/if}

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

	<p class="note">
		Interpolation creates raw ramp stops from anchors or spline points. WCAG/even adjustment and gamut mapping run afterward.
	</p>
{/if}

{#if showAdjust}
	<div class:separator={!showAll}>
	<div class="panel-label" style="margin-top: 0">Auto-adjust</div>
	<p class="note" style="margin-top: 0">Adjustments run after interpolation and before gamut mapping.</p>
	<button type="button" onclick={fitWcagTracked}>Ensure WCAG AA on white</button>
	<SliderRow
		label="AA target"
		bind:value={explorer.theme.aa}
		min={3}
		max={7}
		step={0.5}
		format={(value) => `${value.toFixed(1)}:1`}
	/>
	<button type="button" style="margin-top: 4px" onclick={fitEvenTracked}>Even perceptual spacing</button>
</div>
{/if}

{#if showGamutMap}
	<label class="field-row">
		<span>Gamut mapping <RampPipelinePopover /></span>
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
	.anchor-list {
		display: grid;
		gap: 4px;
		margin: 4px 0 8px;
	}
	.anchor-row {
		display: grid;
		grid-template-columns: 18px 16px minmax(0, 1fr);
		align-items: center;
		gap: 8px;
		font-size: 11px;
	}
	.anchor-label {
		color: var(--muted);
		font-weight: 600;
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
