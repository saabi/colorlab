<script lang="ts">
	import { GAMUTS } from '$lib/color/pipeline';
	import type { ExplorerState, GamutKey } from '$lib/engine/types';
	import type { HistoryController } from '$lib/history/history.svelte';
	import {
		DISPLAY_GAMUT_LABELS,
		DISPLAY_GAMUT_OPTIONS,
		readAppPreferences,
		setDisplayGamut,
		type DisplayGamutId
	} from '$lib/preferences/app.svelte';

	let { explorer = $bindable(), history } = $props<{
		explorer: ExplorerState;
		history?: HistoryController | null;
	}>();

	const activeOptions = [
		{ value: 'srgb', label: 'sRGB / Rec.709' },
		{ value: 'p3', label: 'DCI-P3 D65' },
		{ value: 'rec2020', label: 'Rec.2020' },
		{ value: 'ntsc', label: 'NTSC 1953' },
		{ value: 'ebu', label: 'EBU (Rec.601-625)' },
		{ value: 'smptec', label: 'SMPTE-C' },
		{ value: 'cie', label: 'CIE 1931 RGB' }
	] as const;

	let displayGamut = $state<DisplayGamutId>('srgb');
	$effect(() => {
		displayGamut = readAppPreferences().displayGamut;
	});

	// R/G/B primary chromaticities (x, y) from a gamut's P matrix (row-major 3×3).
	function primariesXY(P: number[]): Array<[number, number]> {
		return [
			[P[0], P[3]],
			[P[1], P[4]],
			[P[2], P[5]]
		];
	}

	function inTriangle(
		p: [number, number],
		a: [number, number],
		b: [number, number],
		c: [number, number]
	): boolean {
		const cross = (u: [number, number], v: [number, number], w: [number, number]) =>
			(u[0] - w[0]) * (v[1] - w[1]) - (v[0] - w[0]) * (u[1] - w[1]);
		const d1 = cross(p, a, b);
		const d2 = cross(p, b, c);
		const d3 = cross(p, c, a);
		const hasNeg = d1 < -1e-6 || d2 < -1e-6 || d3 < -1e-6;
		const hasPos = d1 > 1e-6 || d2 > 1e-6 || d3 > 1e-6;
		return !(hasNeg && hasPos);
	}

	// Chromaticity-only check: does the active gamut have primaries the display can't show?
	const exceedsDisplay = $derived.by(() => {
		const active = GAMUTS[explorer.gamut as keyof typeof GAMUTS];
		const disp = GAMUTS[displayGamut];
		if (!active || !disp) return false;
		const tri = primariesXY(disp.P);
		return primariesXY(active.P).some((pt) => !inTriangle(pt, tri[0], tri[1], tri[2]));
	});

	function onDisplayChange(value: string) {
		displayGamut = value as DisplayGamutId;
		setDisplayGamut(displayGamut);
	}
</script>

<section class="color-context" aria-label="Color context" data-tutorial="color-context">
	<div class="color-context-head">Color context</div>

	<label class="row" for="active-gamut-select"><span>Active gamut</span></label>
	<select
		id="active-gamut-select"
		bind:value={explorer.gamut}
		onchange={() => history?.hintLabel('Change gamut')}
	>
		{#each activeOptions as opt}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>

	<label class="row" for="display-gamut-select"><span>Display gamut</span></label>
	<select
		id="display-gamut-select"
		value={displayGamut}
		onchange={(e) => onDisplayChange(e.currentTarget.value)}
	>
		{#each DISPLAY_GAMUT_OPTIONS as id}
			<option value={id}>{DISPLAY_GAMUT_LABELS[id]}</option>
		{/each}
	</select>

	{#if exceedsDisplay}
		<p class="color-context-warn" role="status">
			⚠ Active gamut has colors your <strong>{DISPLAY_GAMUT_LABELS[displayGamut]}</strong> display can't
			show. On-screen previews are approximate; export is unaffected.
		</p>
	{:else}
		<p class="color-context-note">
			Working/export intent vs what your screen can show. Display gamut is a local device
			preference (sRGB default); it does not change exported colors.
		</p>
	{/if}
</section>

<style>
	.color-context {
		display: grid;
		gap: 5px;
		margin-bottom: 10px;
		padding: 10px;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--surface-inset);
	}

	.color-context-head {
		font-size: 0.769rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--dim);
	}

	.color-context .row {
		margin-top: 3px;
		font-size: 0.846rem;
		color: var(--dim);
	}

	.color-context-note {
		margin: 2px 0 0;
		font-size: 0.769rem;
		line-height: var(--ui-line-height-note);
		color: var(--faint);
	}

	.color-context-warn {
		margin: 4px 0 0;
		padding: 6px 8px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--warn) 14%, transparent);
		color: var(--warn);
		font-size: 0.769rem;
		line-height: var(--ui-line-height-note);
	}
</style>
