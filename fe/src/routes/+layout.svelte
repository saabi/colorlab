<script lang="ts">
	import { browser } from '$app/environment';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { injectUmami } from '$lib/analytics/umami';

	let { children } = $props();

	$effect(() => {
		if (browser) injectUmami();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
