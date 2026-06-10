<script lang="ts">
	import { onMount } from 'svelte';
	import AppShell from '$lib/components/AppShell.svelte';
	import { isMobileClient } from '$lib/engine/mobile';
	import { createAppState } from '$lib/engine/state.svelte';
	import { createDocumentSession } from '$lib/documents/session.svelte';

	let appState = $state(createAppState());
	const session = createDocumentSession(() => appState);

	onMount(() => {
		session.init({ mobile: isMobileClient() });

		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (session.isDirty) event.preventDefault();
		};
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	});
</script>

<AppShell bind:state={appState} {session} />
