<script module lang="ts">
	// ===== IMPORTS =====
	import type { Snippet } from 'svelte';
	import PanelHelp from './PanelHelp.svelte';
	import type { HelpId } from '$lib/inspector/help-copy';

	// ===== TYPES =====
	interface Props {
		title: string;
		children: Snippet;
		/** Controlled expanded state (owned by the parent so it can be persisted). */
		open?: boolean;
		onToggle?: () => void;
		helpId?: HelpId;
		openHelp?: string | null;
		/** 1-based step number within the lane; renders the connector marker when set. */
		index?: number;
		/** Compact status value shown on the collapsed header. */
		status?: string;
		/** Effect badge (Viewport / Ramp / Export / …). */
		affects?: string;
		/** Warning chip (e.g. out-of-gamut count); null when nothing to warn. */
		warn?: string | null;
		/** Dim the step when its controls have nothing to act on yet. */
		disabled?: boolean;
		/** data-tutorial attribute value for this group's root section. */
		tutorialId?: string;
	}
</script>

<script lang="ts">
	// ===== PROPS =====
	let {
		title,
		children,
		open = false,
		onToggle,
		helpId,
		openHelp = $bindable(null as string | null),
		index,
		status,
		affects,
		warn = null,
		disabled = false,
		tutorialId = undefined
	}: Props = $props();

	// ===== STATE =====
	// Pulse the marker when the status value changes ("what changed?" feedback).
	let pulse = $state(false);
	let prevStatus: string | undefined;

	// ===== DERIVED =====
	const contentId = $derived(`group-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);

	// ===== EFFECTS =====
	$effect(() => {
		const s = status;
		if (prevStatus !== undefined && s !== prevStatus) {
			pulse = true;
			setTimeout(() => (pulse = false), 650);
		}
		prevStatus = s;
	});
</script>

<section class="group" class:collapsed={!open} class:disabled class:has-rail={index != null} data-tutorial={tutorialId}>
	{#if index != null}
		<div class="group-rail" aria-hidden="true">
			<span class="step-marker" class:pulse>{index}</span>
		</div>
	{/if}
	<div class="group-col">
		<div class="group-header">
			<button
				type="button"
				class="group-toggle"
				aria-expanded={open}
				aria-controls={contentId}
				onclick={() => onToggle?.()}
			>
				<span class="group-name">{title}</span>
				<span class="group-meta">
					{#if warn}<span class="group-warn" title="Out of gamut">{warn}</span>{/if}
					{#if affects}<span class="group-affects">{affects}</span>{/if}
					{#if status}<span class="group-status">{status}</span>{/if}
					<span class="group-chevron" aria-hidden="true">▾</span>
				</span>
			</button>
			{#if helpId}
				<PanelHelp {helpId} instanceId={contentId} bind:openHelp />
			{/if}
		</div>

		{#if open}
			<div id={contentId} class="group-body">
				{@render children()}
			</div>
		{/if}
	</div>
</section>
