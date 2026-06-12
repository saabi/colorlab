<script lang="ts">
	import { focusTrap } from '$lib/actions/focusTrap';
	import { TRACKS, type TrackId, type TutorialState } from '$lib/engine/tutorial.svelte';

	let {
		tutorial,
		onClose
	}: {
		tutorial: TutorialState;
		onClose: () => void;
	} = $props();

	let purpose = $state<'explore' | 'design'>('explore');
	let depth = $state<'quick' | 'pipeline'>('quick');
	let isMobile = $state(false);

	$effect(() => {
		const mq = window.matchMedia('(max-width: 760px)');
		isMobile = mq.matches;
		const handler = (e: MediaQueryListEvent) => { isMobile = e.matches; };
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});

	const selectedTrack = $derived<TrackId>(
		purpose === 'explore'
			? depth === 'quick'
				? 'a-quick'
				: 'a-pipeline'
			: depth === 'quick'
				? 'b-quick'
				: 'b-pipeline'
	);

	const selectedTrackInfo = $derived(TRACKS[selectedTrack]);

	function start() {
		tutorial.start(selectedTrack);
		onClose();
	}

	function handleBackdropKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="lane-picker-backdrop" onclick={onClose} onkeydown={handleBackdropKeydown}></div>

<div
	class="lane-picker-card"
	role="dialog"
	aria-label="Choose a tutorial lane"
	aria-modal="true"
	tabindex="-1"
	use:focusTrap={{ onEscape: onClose }}
>
	<div class="lane-picker-header">
		<span class="lane-picker-title">Start Tutorial</span>
		<button type="button" class="lane-picker-close" onclick={onClose} aria-label="Close">×</button>
	</div>

	{#if isMobile}
		<p class="lane-mobile-notice">
			The tutorial is designed for desktop use — it points to sidebar controls and inspector panels
			that are hidden or rearranged on small screens. Open Color Lab on a wider display for the full
			step-by-step walkthrough.
		</p>
		<div class="lane-picker-actions">
			<button type="button" class="lane-btn lane-btn-primary" onclick={onClose}>Got it</button>
		</div>
	{:else}
		<p class="lane-picker-intro">
			Color Lab has two purposes: <strong>explore color spaces in 3D</strong> and
			<strong>generate smooth, perceptually harmonic palettes</strong>. Choose the track that matches your goal.
		</p>

		<div class="lane-columns">
			<!-- Explore column -->
			<button
				type="button"
				class="lane-col"
				class:active={purpose === 'explore'}
				onclick={() => (purpose = 'explore')}
			>
				<span class="lane-col-icon">⬡</span>
				<span class="lane-col-name">Explore</span>
				<span class="lane-col-desc">Compare gamuts, inspect cross-sections, and read the full color chain for any hovered point.</span>
			</button>

			<!-- Design column -->
			<button
				type="button"
				class="lane-col"
				class:active={purpose === 'design'}
				onclick={() => (purpose = 'design')}
			>
				<span class="lane-col-icon">▦</span>
				<span class="lane-col-name">Design</span>
				<span class="lane-col-desc">Build ramps and palettes from source colors, then export CSS or DTCG tokens.</span>
			</button>
		</div>

		<div class="lane-depth">
			<fieldset class="lane-depth-field">
				<legend class="lane-depth-legend">Depth</legend>
				<label class="lane-depth-option">
					<input type="radio" bind:group={depth} value="quick" />
					<span>
						<strong>Quick</strong> — fastest path to productivity
					</span>
				</label>
				<label class="lane-depth-option">
					<input type="radio" bind:group={depth} value="pipeline" />
					<span>
						<strong>Pipeline</strong> — stage-by-stage deep dive
					</span>
				</label>
			</fieldset>
		</div>

		<div class="lane-summary">
			<span class="lane-summary-id">{selectedTrackInfo.label}</span>
			<span class="lane-summary-time">~{selectedTrackInfo.durationMin} min</span>
			<span class="lane-summary-steps">{selectedTrackInfo.steps.length} steps</span>
		</div>

		<div class="lane-picker-actions">
			{#if tutorial.progress}
				<button
					type="button"
					class="lane-btn lane-btn-ghost"
					onclick={() => { tutorial.resume(); onClose(); }}
				>Resume previous</button>
			{/if}
			<button type="button" class="lane-btn lane-btn-primary" onclick={start}>
				Start {selectedTrackInfo.label}
			</button>
		</div>
	{/if}
</div>

<style>
	.lane-picker-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		z-index: 1200;
	}

	.lane-picker-card {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1210;
		width: min(480px, calc(100vw - 32px));
		max-height: min(90dvh, 600px);
		overflow-y: auto;
		padding: 18px;
		border: 1px solid #35363b;
		border-radius: 10px;
		background: #111216;
		box-shadow: 0 24px 64px #000e;
		color: var(--txt);
	}

	.lane-picker-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.lane-picker-title {
		color: var(--txt);
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.lane-picker-close {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border: 1px solid var(--line);
		border-radius: 50%;
		background: transparent;
		color: var(--dim);
		padding: 0;
		font-size: 15px;
		line-height: 1;
	}

	.lane-picker-close:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.lane-mobile-notice {
		margin: 0 0 18px;
		color: var(--dim);
		font-size: 12px;
		line-height: 1.6;
	}

	.lane-picker-intro {
		margin: 0 0 14px;
		color: var(--dim);
		font-size: 12px;
		line-height: 1.5;
	}

	.lane-picker-intro strong {
		color: var(--txt);
		font-weight: 600;
	}

	.lane-columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-bottom: 14px;
	}

	.lane-col {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 5px;
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: transparent;
		color: var(--dim);
		text-align: left;
		cursor: pointer;
		transition: border-color 100ms;
	}

	.lane-col:hover {
		border-color: color-mix(in srgb, var(--accent), transparent 50%);
	}

	.lane-col.active {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent), transparent 88%);
		color: var(--txt);
	}

	.lane-col-icon {
		font-size: 18px;
		line-height: 1;
	}

	.lane-col-name {
		font-size: 13px;
		font-weight: 700;
	}

	.lane-col-desc {
		font-size: 11px;
		line-height: 1.45;
		color: var(--dim);
	}

	.lane-col.active .lane-col-desc {
		color: var(--txt);
	}

	.lane-depth {
		margin-bottom: 14px;
	}

	.lane-depth-field {
		border: 1px solid var(--line);
		border-radius: 6px;
		padding: 10px 12px;
		margin: 0;
		display: grid;
		gap: 8px;
	}

	.lane-depth-legend {
		color: var(--dim);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 0 4px;
	}

	.lane-depth-option {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-size: 12px;
		color: var(--txt);
		cursor: pointer;
	}

	.lane-depth-option input[type='radio'] {
		flex-shrink: 0;
		margin: 0;
		cursor: pointer;
	}

	.lane-depth-option strong {
		font-weight: 600;
	}

	.lane-summary {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 16px;
		padding: 8px 10px;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--line);
	}

	.lane-summary-id {
		color: var(--accent);
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.lane-summary-time,
	.lane-summary-steps {
		color: var(--dim);
		font-size: 11px;
	}

	.lane-picker-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.lane-btn {
		padding: 7px 16px;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: transparent;
		color: var(--txt);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}

	.lane-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.lane-btn-ghost {
		color: var(--dim);
	}

	.lane-btn-primary {
		border-color: var(--accent);
		background: var(--accent);
		color: #0a0a0b;
		font-weight: 600;
	}

	.lane-btn-primary:hover {
		background: color-mix(in srgb, var(--accent), white 12%);
		color: #0a0a0b;
	}
</style>
