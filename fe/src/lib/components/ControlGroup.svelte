<script lang="ts">
	let {
		title,
		children,
		collapsible = false,
		defaultOpen = true
	} = $props<{
		title: string;
		children: import('svelte').Snippet;
		collapsible?: boolean;
		defaultOpen?: boolean;
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
	{:else}
		<h2>{title}</h2>
	{/if}

	{#if !collapsible || open}
		<div id={contentId} class="group-body">
			{@render children()}
		</div>
	{/if}
</section>
