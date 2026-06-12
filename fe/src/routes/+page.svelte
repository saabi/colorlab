<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import AppShell from '$lib/components/AppShell.svelte';
	import { isMobileLayout } from '$lib/engine/mobile';
	import { createAppState } from '$lib/engine/state.svelte';
	import { createDocumentSession } from '$lib/documents/session.svelte';

	const mobile = browser && isMobileLayout();
	let appState = $state(createAppState({ mobile }));
	const session = createDocumentSession(() => appState);

	// Run before child Viewport mounts WebGL so tessellation is capped on mobile.
	if (browser) {
		session.init({ mobile });
	}

	onMount(() => {
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (session.isDirty) event.preventDefault();
		};
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	});
</script>

<AppShell bind:state={appState} {session} />
