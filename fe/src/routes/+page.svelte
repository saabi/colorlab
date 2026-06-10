<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import { createExplorerState } from '$lib/engine/state.svelte';

	const state = createExplorerState();
</script>

<AppShell {state} />
