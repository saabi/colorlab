<script lang="ts">
	import PanelHelp from './PanelHelp.svelte';
	import type { HelpId } from '$lib/inspector/help-copy';

	let {
		title,
		children,
		collapsible = false,
		defaultOpen = true,
		helpId,
		openHelp = $bindable(null as string | null)
	} = $props<{
		title: string;
		children: import('svelte').Snippet;
		collapsible?: boolean;
		defaultOpen?: boolean;
		helpId?: HelpId;
		openHelp?: string | null;
	}>();

	let open = $state(false);
	let initialized = $state(false);
	const contentId = $derived(`group-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);

	$effect(() => {
		if (!initialized) {
			open = defaultOpen;
			initialized = true;
		}
	});
</script>

<section class:collapsed={collapsible && !open} class="group">
	{#if collapsible}
		<div class="group-header">
			<button
				type="button"
				class="group-toggle"
				aria-expanded={open}
				aria-controls={contentId}
				onclick={() => {
					open = !open;
				}}
			>
				<span>{title}</span>
				<span class="group-chevron" aria-hidden="true">▾</span>
			</button>
			{#if helpId}
				<PanelHelp {helpId} instanceId={contentId} bind:openHelp />
			{/if}
		</div>
	{:else}
		<div class="group-header">
			<h2>{title}</h2>
			{#if helpId}
				<PanelHelp {helpId} instanceId={contentId} bind:openHelp />
			{/if}
		</div>
	{/if}

	{#if !collapsible || open}
		<div id={contentId} class="group-body">
			{@render children()}
		</div>
	{/if}
</section>
