<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import AppShell from '$lib/components/AppShell.svelte';
	import { isMobileLayout } from '$lib/engine/mobile';
	import { createAppState } from '$lib/engine/state.svelte';
	import { createDocumentSession } from '$lib/documents/session.svelte';
	import { createHistory } from '$lib/history/history.svelte';
	import { setHistoryContext } from '$lib/history/context';
	import { loadAppPreferences, persistAppPreferences } from '$lib/preferences/app.svelte';

	const mobile = browser && isMobileLayout();
	let appState = $state(createAppState({ mobile }));
	const history = createHistory(() => appState);
	setHistoryContext(history);
	const session = createDocumentSession(() => appState, {
		onAppliedSnapshot: (snapshot) => history.reset(snapshot)
	});

	let sessionInitialized = false;

	// Run before child Viewport mounts WebGL so tessellation is capped on mobile.
	$effect.pre(() => {
		if (!browser || sessionInitialized) return;
		sessionInitialized = true;
		loadAppPreferences(appState.explorer);
		session.init({ mobile });
	});

	$effect(() => {
		if (!browser) return;
		const { autoRotate, autoPerformance, minAverageFps, observerModel, chromaticityDiagram } = appState.explorer;
		persistAppPreferences({ autoRotate, autoPerformance, minAverageFps, observerModel, chromaticityDiagram });
	});

	// Shared-link (`#s=`) ingestion happens in AppShell so it can surface a notice.
	onMount(() => {
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (session.isDirty) event.preventDefault();
		};
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	});
</script>

<AppShell bind:state={appState} {session} {history} />
