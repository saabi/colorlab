<script lang="ts">
	import { onMount } from 'svelte';
	import AppShell from '$lib/components/AppShell.svelte';
	import { createCamera } from '$lib/engine/camera';
	import { isMobileClient } from '$lib/engine/mobile';
	import { createExplorerState } from '$lib/engine/state.svelte';
	import { createDocumentSession } from '$lib/documents/session.svelte';

	let explorer = $state(createExplorerState());
	let camera = $state(createCamera());
	const session = createDocumentSession(() => explorer, () => camera);

	onMount(() => {
		session.init({ mobile: isMobileClient() });

		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (session.isDirty) event.preventDefault();
		};
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	});
</script>

<AppShell bind:state={explorer} bind:camera {session} />
