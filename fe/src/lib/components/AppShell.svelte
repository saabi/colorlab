<script lang="ts">
	import LeftControls from './LeftControls.svelte';
	import RightInspector from './RightInspector.svelte';
	import Viewport from './Viewport.svelte';
	import AppInfo from './AppInfo.svelte';
	import DocumentBar from './DocumentBar.svelte';
	import GuideNoteEditorHost from './GuideNoteEditorHost.svelte';
	import { rebuildMatrices } from '$lib/renderer/uniforms';

	import type { AppState } from '$lib/engine/types';
	import type { DocumentSession } from '$lib/documents/session.svelte';
	import type { TouchTool } from './Viewport.svelte';

	let {
		state: appState = $bindable(),
		session
	} = $props<{ state: AppState; session: DocumentSession }>();
	const explorer = $derived(appState.explorer);
	const camera = $derived(appState.camera);
	const matrices = $derived(rebuildMatrices(explorer.gamut));
	let drawerOpen = $state(false);
	let touchTool: TouchTool = $state('auto');
</script>

<GuideNoteEditorHost explorer={appState.explorer}>
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
			<h1>COLOR LAB</h1>
			<span class="sub">Gamut Explorer</span>
			<DocumentBar {session} />
			<AppInfo />
			<span class="badge">WebGL2</span>
		</header>

		<button
			type="button"
			class="drawer-backdrop"
			aria-label="Close controls"
			onclick={() => {
				drawerOpen = false;
			}}
		></button>
		<LeftControls explorer={appState.explorer} {matrices} {camera} bind:touchTool />
		<Viewport state={explorer} {camera} bind:touchTool />
		<RightInspector state={explorer} />
	</div>
</GuideNoteEditorHost>
