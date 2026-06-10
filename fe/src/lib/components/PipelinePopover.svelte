<script lang="ts">
	import type { CvdMode } from '$lib/engine/types';

	let { cvd = 'none', cvdSev = 1 } = $props<{ cvd?: CvdMode; cvdSev?: number }>();
	let open = $state(false);
	let popoverStyle = $state('');

	type PipelineStep = { label: string; detail: string; disabled: boolean };

	const baseSteps = [
		{ label: 'Encoded RGB', detail: 'selector primaries + transfer curve', disabled: false },
		{ label: 'Linear RGB', detail: 'cube coordinates', disabled: false },
		{ label: 'XYZ', detail: 'gamut matrix', disabled: false },
		{ label: 'World space', detail: 'RGB cube, XYZ, Lab, or Oklab', disabled: false }
	] satisfies PipelineStep[];

	const cvdLabel = $derived(
		cvd === 'none' ? 'Color vision' : `${cvd[0].toUpperCase()}${cvd.slice(1)} ${cvdSev.toFixed(2)}`
	);

	const steps = $derived<PipelineStep[]>([
		...baseSteps,
		{
			label: cvdLabel,
			detail: cvd === 'none' ? 'LMS simulation disabled' : 'LMS deficiency transform',
			disabled: cvd === 'none'
		},
		{ label: 'Display', detail: 'sRGB-compliant monitor', disabled: false }
	]);

	function placePopover(event: MouseEvent | FocusEvent) {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const width = Math.min(520, window.innerWidth - 24);
		const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
		const top = Math.min(rect.bottom + 8, window.innerHeight - 220);
		popoverStyle = `left: ${left}px; top: ${top}px; width: ${width}px;`;
		open = true;
	}
</script>

<span class="pipeline-help" role="presentation" onmouseleave={() => (open = false)}>
	<button
		type="button"
		class="pipeline-trigger"
		aria-describedby="pipeline-popover"
		onmouseenter={placePopover}
		onfocus={placePopover}
		onblur={() => (open = false)}
	>pipeline</button>
	<span id="pipeline-popover" class="pipeline-popover" class:open role="tooltip" style={popoverStyle}>
		<span class="pipeline-title">Color pipeline</span>
		<span class="pipeline-flow">
			{#each steps as step, index}
				<span class="pipeline-step" class:disabled={step.disabled}>
					<b>{step.label}</b>
					<small>{step.detail}</small>
				</span>
				{#if index < steps.length - 1}
					<span class="pipeline-arrow" aria-hidden="true">-&gt;</span>
				{/if}
			{/each}
		</span>
		<p class="pipeline-note">
			The display step assumes an sRGB-compliant monitor. Future versions will let you set custom
			chromaticities and gamma; the pipeline will update to match.
		</p>
	</span>
</span>

<style>
	.pipeline-help {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.pipeline-trigger {
		width: auto;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--accent);
		padding: 0;
		font-size: inherit;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 2px;
	}

	.pipeline-trigger:hover,
	.pipeline-trigger:focus {
		border-color: transparent;
		color: var(--txt);
		outline: none;
	}

	.pipeline-popover {
		position: fixed;
		z-index: 1000;
		display: grid;
		gap: 8px;
		visibility: hidden;
		opacity: 0;
		pointer-events: none;
		border: 1px solid #35363b;
		border-radius: 8px;
		background: #111216;
		box-shadow: 0 16px 44px #000b;
		padding: 10px;
		color: var(--txt);
		text-transform: none;
		letter-spacing: 0;
		transition:
			opacity 120ms ease,
			visibility 120ms ease;
	}

	.pipeline-popover.open {
		visibility: visible;
		opacity: 1;
		pointer-events: auto;
	}

	.pipeline-title {
		color: var(--dim);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.pipeline-flow {
		display: flex;
		align-items: stretch;
		gap: 6px;
	}

	.pipeline-step {
		display: grid;
		min-width: 0;
		flex: 1 1 0;
		align-content: start;
		gap: 3px;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--panel2);
		padding: 7px 6px;
	}

	.pipeline-step.disabled {
		border-style: dashed;
		background: #15161a;
		opacity: 0.58;
	}

	.pipeline-step b {
		font-size: 10px;
		line-height: 1.15;
	}

	.pipeline-step small {
		color: var(--dim);
		font-size: 9px;
		line-height: 1.2;
	}

	.pipeline-arrow {
		display: grid;
		align-items: center;
		color: var(--accent);
		font-family: "IBM Plex Mono", ui-monospace, monospace;
		font-size: 10px;
	}

	.pipeline-note {
		margin: 0;
		color: var(--dim);
		font-size: 10px;
		line-height: 1.35;
	}
</style>
