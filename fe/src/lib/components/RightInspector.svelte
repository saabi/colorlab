<script lang="ts">
	import { onMount } from 'svelte';
	import PanelHeader from './PanelHeader.svelte';
	import PaletteStrip from './PaletteStrip.svelte';
	import TeachingNote from './TeachingNote.svelte';
	import { track } from '$lib/analytics/umami';
	import { drawConesPanel } from '$lib/panels/cones-panel';
	import { drawTransferPanel } from '$lib/panels/transfer-panel';
	import { drawXyPanel } from '$lib/panels/xy-panel';

	import type { ExplorerState } from '$lib/engine/types';
	import type { Vec3 } from '$lib/color/math';

	let { state: explorer } = $props<{ state: ExplorerState }>();
	let transferCanvas: HTMLCanvasElement;
	let conesCanvas: HTMLCanvasElement;
	let xyCanvas: HTMLCanvasElement;
	let spectrumLabel = $state('');
	let activeTab = $state<'transfer' | 'cones' | 'xy' | 'values' | 'palette'>('transfer');
	let openHelp = $state<string | null>(null);

	// The exported palette (2-D grid when present — Expand or multiple lists — else
	// the 1-D active ramp as one row).
	const paletteRows = $derived(
		explorer.theme.grid.length
			? explorer.theme.grid
			: explorer.theme.stops.length
				? [explorer.theme.stops]
				: []
	);

	const fmt = (value: number, places = 3) => (Math.abs(value) < 1e-4 ? 0 : value).toFixed(places);
	const fmtVec = (vec: Vec3, places = 3) => vec.map((v: number) => fmt(v, places)).join(' ');
	const encSrgb = (v: number) => {
		const c = Math.min(Math.max(v, 0), 1);
		return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
	};
	const rows = $derived.by(() => {
		const ch = explorer.hover?.chain;
		if (!ch) return [['hover the solid...', '']];
		return [
			['encoded RGB', fmtVec(ch.enc)],
			['linear RGB', fmtVec(ch.rgbLin)],
			['CIE XYZ', fmtVec(ch.xyz)],
			['LMS', fmtVec(ch.lms)],
			['CIELAB', fmtVec(ch.lab, 1)],
			['Oklab', fmtVec(ch.ok)],
			['OKLCh', `${fmt(ch.oklch[0])} ${fmt(ch.oklch[1])} ${fmt(ch.oklch[2], 1)} deg`]
		];
	});
	const swatchStyle = $derived.by(() => {
		const ch = explorer.hover?.chain;
		if (!ch) return '';
		const disp = ch.cvdLin.map((v: number) => Math.round(encSrgb(v) * 255));
		return `background: rgb(${disp.join(',')}); color: ${explorer.hover?.inGamut ? '#0008' : '#fffb'};`;
	});
	const drawable = (canvas: HTMLCanvasElement | undefined) => !!canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0;

	function setActiveTab(tab: typeof activeTab) {
		activeTab = tab;
		track('inspector_tab', { tab });
	}

	function drawPanels() {
		const ch = explorer.hover?.chain ?? null;
		if (drawable(transferCanvas)) drawTransferPanel(transferCanvas, ch, explorer);
		if (drawable(conesCanvas)) spectrumLabel = drawConesPanel(conesCanvas, ch, explorer);
		if (drawable(xyCanvas)) drawXyPanel(xyCanvas, ch, explorer);
	}

	function queueDrawPanels() {
		requestAnimationFrame(drawPanels);
	}

	onMount(() => {
		const ro = new ResizeObserver(drawPanels);
		[transferCanvas, conesCanvas, xyCanvas].forEach((canvas) => ro.observe(canvas));
		drawPanels();
		return () => ro.disconnect();
	});

	$effect(() => {
		explorer.hover;
		explorer.gamut;
		explorer.cvd;
		explorer.cvdSev;
		activeTab;
		queueDrawPanels();
	});

	$effect(() => {
		activeTab;
		openHelp = null;
	});
</script>

<aside class="side-panel right-panel">
	{#if explorer.guideNote && explorer.guideNotePlacement === 'sidebar'}
		<TeachingNote
			bind:note={explorer.guideNote}
			bind:placement={explorer.guideNotePlacement}
			bind:dismissed={explorer.guideNoteDismissed}
			variant="sidebar"
		/>
	{/if}
	<div class="inspector-tabs" aria-label="Inspector panels">
		<button
			type="button"
			class:active={activeTab === 'transfer'}
			onclick={() => {
				setActiveTab('transfer');
			}}>Transfer</button
		>
		<button
			type="button"
			class:active={activeTab === 'cones'}
			onclick={() => {
				setActiveTab('cones');
			}}>LMS</button
		>
		<button
			type="button"
			class:active={activeTab === 'xy'}
			onclick={() => {
				setActiveTab('xy');
			}}>xy</button
		>
		<button
			type="button"
			class:active={activeTab === 'values'}
			onclick={() => {
				setActiveTab('values');
			}}>Values</button
		>
		<button
			type="button"
			class="palette-tab"
			class:active={activeTab === 'palette'}
			onclick={() => {
				setActiveTab('palette');
			}}>Palette</button
		>
	</div>

	<section class:active={activeTab === 'transfer'} class="inspector-tab-panel">
		<PanelHeader
			label="Transfer (encode to linear)"
			panelId="transfer"
			bind:openHelp
		/>
		<canvas bind:this={transferCanvas} class="panel-canvas" aria-label="Transfer curve panel"></canvas>
	</section>

	<section class:active={activeTab === 'cones'} class="inspector-tab-panel">
		<PanelHeader
			label="Cone fundamentals L M S"
			panelId="cones"
			meta={spectrumLabel}
			bind:openHelp
		/>
		<canvas bind:this={conesCanvas} class="panel-canvas tall" aria-label="Cone fundamentals and spectrum panel"></canvas>
	</section>

	<section class:active={activeTab === 'xy'} class="inspector-tab-panel">
		<PanelHeader label="CIE xy chromaticity" panelId="xy" bind:openHelp />
		<canvas bind:this={xyCanvas} class="panel-canvas tall" aria-label="CIE xy chromaticity panel"></canvas>

		<p class="note">
			Excitations are integrals: a general color is three magnitudes, not points on wavelength curves.
		</p>
	</section>

	<section class:active={activeTab === 'values'} class="inspector-tab-panel values-panel">
		<PanelHeader label="Hovered stimulus" panelId="values" bind:openHelp />
		<div class:oog={!!explorer.hover && !explorer.hover.inGamut} class="swatch" style={swatchStyle}>
			<span>{explorer.hover ? (explorer.hover.inGamut ? '' : 'OUT OF GAMUT') : ''}</span>
		</div>
		<div class="chain">
			{#each rows as row}
				<div class="stage">
					<b>{row[0]}</b>
					<span>{row[1]}</span>
				</div>
			{/each}
		</div>
	</section>

	<section class:active={activeTab === 'palette'} class="inspector-tab-panel palette-panel">
		<PanelHeader label="Exported palette" panelId="palette" bind:openHelp />
		{#if paletteRows.length}
			<PaletteStrip rows={paletteRows} swatch={22} cvd={explorer.cvd} cvdSev={explorer.cvdSev} ariaLabel="Exported palette" />
		{:else}
			<p class="note">Pick source colors to generate a ramp; the exported palette appears here.</p>
		{/if}
	</section>
</aside>
