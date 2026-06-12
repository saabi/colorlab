<script lang="ts">
	import type { TutorialState } from '$lib/engine/tutorial.svelte';

	let {
		tutorial,
		hideAids = false,
		loadExample
	}: {
		tutorial: TutorialState;
		hideAids?: boolean;
		loadExample?: (id: string) => void | Promise<void>;
	} = $props();

	let cardStyle = $state('');

	// Tone rows for each field
	const rows = $derived(
		tutorial.step
			? [
					{ tone: 'neutral', label: 'Concept', text: tutorial.step.concept },
					{ tone: 'change', label: 'Try it', text: tutorial.step.tryIt },
					{ tone: 'output', label: 'Success', text: tutorial.step.successCheck },
					{ tone: 'exclude', label: 'Mistake', text: tutorial.step.commonMistake }
				]
			: []
	);

	// Step counter string
	const counterText = $derived(
		tutorial.progress
			? `${tutorial.displayIndex} / ${tutorial.total}`
			: ''
	);

	// Arrow class based on zone
	const arrowClass = $derived(() => {
		const zone = tutorial.step?.zone;
		if (zone === 'sidebar-inline') return 'arrow-left';
		if (zone === 'inspector-adjacent') return 'arrow-right';
		if (zone === 'viewport-float' || zone === 'docbar-adjacent') return 'arrow-up';
		return '';
	});

	// Highlight the target element
	$effect(() => {
		const selector = tutorial.step?.target;
		if (!selector) return;
		const el = document.querySelector(selector);
		if (!el) return;
		el.classList.add('tutorial-target');
		return () => el.classList.remove('tutorial-target');
	});

	// Position the card
	$effect(() => {
		// Track step so effect re-runs on navigation
		const step = tutorial.step;
		if (!step) {
			cardStyle = '';
			return;
		}

		function place() {
			const W = 300;
			const M = 10;
			const vh = window.innerHeight;
			// Worst-case card height mirrors the CSS max-height (100dvh - 20px).
			// If a top-anchor would push the card bottom beyond the viewport, flip
			// to a bottom-anchor so the card grows upward instead.
			const worstH = vh * 0.9;

			function pos(rawTop: number, leftOrRight: string): string {
				const top = Math.max(M, rawTop);
				if (top + worstH <= vh - M) {
					return `${leftOrRight} top: ${top}px; width: ${W}px;`;
				}
				return `${leftOrRight} bottom: ${M}px; width: ${W}px;`;
			}

			if (step!.zone === 'viewport-float') {
				const vp = document.querySelector('.viewport');
				const r = vp?.getBoundingClientRect();
				const left = r ? r.left + M : M;
				const bottom = r ? vh - r.bottom + M : M;
				cardStyle = `left: ${left}px; bottom: ${bottom}px; width: ${W}px;`;
				return;
			}

			if (step!.zone === 'sidebar-inline') {
				const sidebar = document.querySelector('.left-panel');
				if (!sidebar) return;
				const sr = sidebar.getBoundingClientRect();
				const targetEl = step!.target ? document.querySelector(step!.target) : null;
				const rawTop = targetEl ? targetEl.getBoundingClientRect().top : sr.top;
				cardStyle = pos(rawTop, `left: ${sr.right + 8}px;`);
				return;
			}

			if (step!.zone === 'inspector-adjacent') {
				const inspector = document.querySelector('.right-panel');
				if (!inspector) return;
				const ir = inspector.getBoundingClientRect();
				const targetEl = step!.target ? document.querySelector(step!.target) : null;
				const rawTop = targetEl ? targetEl.getBoundingClientRect().top : ir.top;
				cardStyle = pos(rawTop, `right: ${window.innerWidth - ir.left + 8}px;`);
				return;
			}

			if (step!.zone === 'docbar-adjacent') {
				const targetEl = step!.target ? document.querySelector(step!.target) : null;
				const rawTop = targetEl
					? targetEl.getBoundingClientRect().bottom + 8
					: (document.querySelector('.app-header')?.getBoundingClientRect().bottom ?? 44) + 8;
				const left = targetEl ? Math.max(M, targetEl.getBoundingClientRect().left) : M;
				cardStyle = pos(rawTop, `left: ${left}px;`);
			}
		}

		place();
		window.addEventListener('resize', place);
		return () => window.removeEventListener('resize', place);
	});

	function onTutorialKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.stopPropagation();
		tutorial.stop();
	}
</script>

{#if tutorial.step}
	{#key `${tutorial.progress?.trackId}:${tutorial.progress?.stepIndex}`}
		<div
			class="tutorial-card {arrowClass()}"
			style={cardStyle}
			role="dialog"
			aria-label="Tutorial step"
			lang="en"
			translate="yes"
			tabindex="-1"
			onkeydown={onTutorialKeydown}
		>
			<div class="tutorial-card-header">
				<span class="tutorial-step-counter">{counterText}</span>
				<span class="tutorial-step-title">{tutorial.step.title}</span>
				<button
					type="button"
					class="tutorial-close"
					onclick={() => tutorial.stop()}
					aria-label="Stop tutorial"
				>×</button>
			</div>

			<div class="panel-help-stage">
				{#each rows as row (row.tone)}
					<div
						class="panel-help-stage-row"
						class:neutral={row.tone === 'neutral'}
						class:change={row.tone === 'change'}
						class:output={row.tone === 'output'}
						class:exclude={row.tone === 'exclude'}
					>
						<span class="panel-help-stage-label">{row.label}</span>
						<span class="panel-help-stage-text">{row.text}</span>
					</div>
				{/each}
			</div>

			{#if tutorial.step?.suggestedExample && loadExample}
				<div class="tutorial-example-block">
					{#if hideAids}
						<p class="tutorial-example-note">
							Hide aids is on — shell, slice outlines, and ramp markers are hidden. Loading
							the example will turn overlays back on.
						</p>
					{/if}
					<div class="tutorial-example-row">
						<span class="tutorial-example-label">Example</span>
						<button
							type="button"
							class="tutorial-example-btn"
							onclick={() => loadExample!(tutorial.step!.suggestedExample!)}
						>Load example →</button>
					</div>
				</div>
			{/if}

			<div class="tutorial-card-footer">
				<button
					type="button"
					class="tutorial-nav-btn"
					disabled={tutorial.isFirst}
					onclick={() => tutorial.back()}
				>← Back</button>
				<button
					type="button"
					class="tutorial-nav-btn tutorial-nav-primary"
					onclick={() => (tutorial.isLast ? tutorial.done() : tutorial.next())}
				>{tutorial.isLast ? 'Done' : 'Next →'}</button>
			</div>
		</div>
	{/key}
{/if}

<style>
	.tutorial-card {
		position: fixed;
		z-index: 1100;
		display: grid;
		gap: 8px;
		max-height: calc(100dvh - 20px);
		overflow-x: hidden;
		overflow-y: auto;
		border: 1px solid #35363b;
		border-radius: 8px;
		background: #111216;
		box-shadow: 0 20px 56px #000d;
		padding: 10px;
		color: var(--txt);
	}

	/* Arrow connectors */
	.tutorial-card.arrow-left::before {
		content: '';
		position: absolute;
		left: -7px;
		top: 18px;
		border: 7px solid transparent;
		border-right-color: #35363b;
	}

	.tutorial-card.arrow-left::after {
		content: '';
		position: absolute;
		left: -5px;
		top: 19px;
		border: 6px solid transparent;
		border-right-color: #111216;
	}

	.tutorial-card.arrow-right::before {
		content: '';
		position: absolute;
		right: -7px;
		top: 18px;
		border: 7px solid transparent;
		border-left-color: #35363b;
	}

	.tutorial-card.arrow-right::after {
		content: '';
		position: absolute;
		right: -5px;
		top: 19px;
		border: 6px solid transparent;
		border-left-color: #111216;
	}

	.tutorial-card.arrow-up::before {
		content: '';
		position: absolute;
		top: -7px;
		left: 18px;
		border: 7px solid transparent;
		border-bottom-color: #35363b;
	}

	.tutorial-card.arrow-up::after {
		content: '';
		position: absolute;
		top: -5px;
		left: 19px;
		border: 6px solid transparent;
		border-bottom-color: #111216;
	}

	.tutorial-card-header {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}

	.tutorial-step-counter {
		flex-shrink: 0;
		color: var(--dim);
		font-size: 0.692rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.tutorial-step-title {
		flex: 1;
		color: var(--txt);
		font-size: 0.846rem;
		font-weight: 600;
		line-height: var(--ui-line-height-tight);
	}

	.tutorial-close {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 18px;
		height: 18px;
		border: 1px solid var(--line);
		border-radius: 50%;
		background: transparent;
		color: var(--dim);
		padding: 0;
		font-size: 1rem;
		line-height: 1;
	}

	.tutorial-close:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.tutorial-example-block {
		display: grid;
		gap: 6px;
		padding: 4px 0;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.tutorial-example-note {
		margin: 0;
		color: var(--dim);
		font-size: 0.769rem;
		line-height: var(--ui-line-height-snug);
	}

	.tutorial-example-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}

	.tutorial-example-label {
		color: var(--dim);
		font-size: 0.692rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		flex-shrink: 0;
	}

	.tutorial-example-btn {
		padding: 3px 8px;
		border: 1px solid var(--accent);
		border-radius: 4px;
		background: transparent;
		color: var(--accent);
		font-size: 0.769rem;
		cursor: pointer;
	}

	.tutorial-example-btn:hover {
		background: var(--accent);
		color: #0a0a0b;
	}

	.tutorial-card-footer {
		display: flex;
		justify-content: space-between;
		gap: 6px;
		padding-top: 4px;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.tutorial-nav-btn {
		padding: 4px 10px;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: transparent;
		color: var(--dim);
		font-size: 0.846rem;
		cursor: pointer;
	}

	.tutorial-nav-btn:not(:disabled):hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.tutorial-nav-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.tutorial-nav-primary {
		color: var(--txt);
		border-color: var(--accent);
	}

	.tutorial-nav-primary:not(:disabled):hover {
		background: var(--accent);
		color: #0a0a0b;
	}
</style>
