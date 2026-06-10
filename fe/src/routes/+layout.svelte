<script lang="ts">
	import { browser } from '$app/environment';
	import '../app.css';
	import { injectUmami } from '$lib/analytics/umami';

	let { children } = $props();

	$effect(() => {
		if (browser) injectUmami();
	});
</script>

<svelte:head>
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content="#0a0a0b" />
	<link rel="icon" href="/favicon.ico" sizes="any" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</svelte:head>

{@render children()}
