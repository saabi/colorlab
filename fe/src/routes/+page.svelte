<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import { createExplorerState } from '$lib/engine/state.svelte';

	let state = $state(createExplorerState());
</script>

<AppShell bind:state />
