<script lang="ts">
	let open = $state(false);
	let popoverStyle = $state('');

	const steps = [
		{ label: 'Picked color', detail: 'linear sRGB anchor or spline point' },
		{ label: 'Interpolation', detail: 'segment, arc, spread, or spline space' },
		{ label: 'Raw stops', detail: 'unmapped ramp samples' },
		{ label: 'Adjustments', detail: 'WCAG or even spacing when requested' },
		{ label: 'Gamut map', detail: 'selected ramp-only policy' },
		{ label: 'Export', detail: 'CSS / DTCG stop colors' }
	];

	function placePopover(event: MouseEvent | FocusEvent) {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const width = Math.min(560, window.innerWidth - 24);
		const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
		const top = Math.min(rect.bottom + 8, window.innerHeight - 230);
		popoverStyle = `left: ${left}px; top: ${top}px; width: ${width}px;`;
		open = true;
	}
</script>

<span class="ramp-pipeline-help" role="presentation" onmouseleave={() => (open = false)}>
	<button
		type="button"
		class="ramp-pipeline-trigger"
		aria-describedby="ramp-pipeline-popover"
		onmouseenter={placePopover}
		onfocus={placePopover}
		onblur={() => (open = false)}
	>pipeline</button>
	<span id="ramp-pipeline-popover" class="ramp-pipeline-popover" class:open role="tooltip" style={popoverStyle}>
		<span class="ramp-pipeline-title">Ramp pipeline</span>
		<span class="ramp-pipeline-flow">
			{#each steps as step, index}
				<span class="ramp-pipeline-step">
					<b>{step.label}</b>
					<small>{step.detail}</small>
				</span>
				{#if index < steps.length - 1}
					<span class="ramp-pipeline-arrow" aria-hidden="true">-&gt;</span>
				{/if}
			{/each}
		</span>
		<p class="ramp-pipeline-note">
			Ramp gamut mapping only affects generated ramp stops and exports. It does not reshape the 3D
			color solid, hover readouts, or gamut selector pipeline.
		</p>
	</span>
</span>

<style>
	.ramp-pipeline-help {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.ramp-pipeline-trigger {
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

	.ramp-pipeline-trigger:hover,
	.ramp-pipeline-trigger:focus {
		border-color: transparent;
		color: var(--txt);
		outline: none;
	}

	.ramp-pipeline-popover {
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

	.ramp-pipeline-popover.open {
		visibility: visible;
		opacity: 1;
		pointer-events: auto;
	}

	.ramp-pipeline-title {
		color: var(--dim);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.ramp-pipeline-flow {
		display: flex;
		align-items: stretch;
		gap: 6px;
	}

	.ramp-pipeline-step {
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

	.ramp-pipeline-step b {
		font-size: 10px;
		line-height: 1.15;
	}

	.ramp-pipeline-step small {
		color: var(--dim);
		font-size: 9px;
		line-height: 1.2;
	}

	.ramp-pipeline-arrow {
		display: grid;
		align-items: center;
		color: var(--accent);
		font-family: "IBM Plex Mono", ui-monospace, monospace;
		font-size: 10px;
	}

	.ramp-pipeline-note {
		margin: 0;
		color: var(--dim);
		font-size: 10px;
		line-height: 1.35;
	}
</style>
