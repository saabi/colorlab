<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import UmamiTracker from '$lib/components/UmamiTracker.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<UmamiTracker />
{@render children()}
