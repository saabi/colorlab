<script lang="ts">
	import LeftControls from './LeftControls.svelte';
	import RightInspector from './RightInspector.svelte';
	import Viewport from './Viewport.svelte';
	import DocumentBar from './DocumentBar.svelte';
	import { rebuildMatrices } from '$lib/renderer/uniforms';

	import type { AppState } from '$lib/engine/types';
	import type { DocumentSession } from '$lib/documents/session.svelte';

	let {
		state: appState = $bindable(),
		session
	} = $props<{ state: AppState; session: DocumentSession }>();
	const explorer = $derived(appState.explorer);
	const camera = $derived(appState.camera);
	const matrices = $derived(rebuildMatrices(explorer.gamut));
	let drawerOpen = $state(false);
</script>

<div class:drawer-open={drawerOpen} class="app-shell">
	<header class="app-header">
		<button
			type="button"
			class="drawer-toggle"
			aria-label="Open controls"
			aria-expanded={drawerOpen}
			onclick={() => {
				drawerOpen = !drawerOpen;
			}}
		>
			<span></span>
			<span></span>
			<span></span>
		</button>
		<h1>GAMUT EXPLORER</h1>
		<span class="sub">instanced color solids - arbitrary slices - transform chain</span>
		<DocumentBar {session} />
		<span class="badge">WebGL2 - Svelte migration</span>
	</header>

	<button
		type="button"
		class="drawer-backdrop"
		aria-label="Close controls"
		onclick={() => {
			drawerOpen = false;
		}}
	></button>
	<LeftControls state={explorer} {matrices} />
	<Viewport state={explorer} {camera} />
	<RightInspector state={explorer} />
</div>
