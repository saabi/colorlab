<script lang="ts">
	import { onMount } from 'svelte';
	import AppShell from '$lib/components/AppShell.svelte';
	import { isMobileClient } from '$lib/engine/mobile';
	import { createExplorerState } from '$lib/engine/state.svelte';

	let state = $state(createExplorerState());

	onMount(() => {
		if (isMobileClient()) state.N = 128;
	});
</script>

<AppShell bind:state />
