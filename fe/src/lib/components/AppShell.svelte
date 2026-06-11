<script lang="ts">
	import { onMount } from 'svelte';
	import LeftControls from './LeftControls.svelte';
	import PipelineGraph from './PipelineGraph.svelte';
	import RightInspector from './RightInspector.svelte';
	import Viewport from './Viewport.svelte';
	import AppInfo from './AppInfo.svelte';
	import DocumentBar from './DocumentBar.svelte';
	import { rebuildMatrices } from '$lib/renderer/uniforms';
	import { PIPELINE_NODES, type PipelineNodeId } from './pipeline-nodes';

	import type { AppState } from '$lib/engine/types';
	import type { DocumentSession } from '$lib/documents/session.svelte';
	import type { TouchTool } from './Viewport.svelte';

	// Last-selected pipeline stage is session UI state (localStorage), never part of
	// the saved document. Restored on mount to preserve working context across reloads.
	const UI_NODE_KEY = 'colorlab:ui:selected-node';

	let {
		state: appState = $bindable(),
		session
	} = $props<{ state: AppState; session: DocumentSession }>();
	const explorer = $derived(appState.explorer);
	const camera = $derived(appState.camera);
	const matrices = $derived(rebuildMatrices(explorer.gamut));
	let drawerOpen = $state(false);
	let selectedPipelineNode: PipelineNodeId = $state('all');
	let touchTool: TouchTool = $state('auto');
	let nodeRestored = false;

	onMount(() => {
		const stored = localStorage.getItem(UI_NODE_KEY);
		if (stored && PIPELINE_NODES.some((node) => node.id === stored)) {
			selectedPipelineNode = stored as PipelineNodeId;
		}
		nodeRestored = true;
	});

	$effect(() => {
		const id = selectedPipelineNode;
		if (!nodeRestored || typeof localStorage === 'undefined') return;
		localStorage.setItem(UI_NODE_KEY, id);
	});
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
	<LeftControls explorer={appState.explorer} {matrices} {camera} selectedNode={selectedPipelineNode} bind:touchTool />
	<div class="pipeline-graph-region">
		<PipelineGraph state={explorer} bind:selectedNode={selectedPipelineNode} />
	</div>
	<Viewport state={explorer} {camera} bind:touchTool />
	<RightInspector state={explorer} />
</div>
