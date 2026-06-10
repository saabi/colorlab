<script lang="ts">
	import LeftControls from './LeftControls.svelte';
	import RightInspector from './RightInspector.svelte';
	import Viewport from './Viewport.svelte';
	import { rebuildMatrices } from '$lib/renderer/uniforms';

	import type { ExplorerState } from '$lib/engine/types';

	let { state = $bindable() } = $props<{ state: ExplorerState }>();
	const matrices = $derived(rebuildMatrices(state.gamut));
</script>

<div class="app-shell">
	<header class="app-header">
		<h1>GAMUT EXPLORER</h1>
		<span class="sub">instanced color solids - arbitrary slices - transform chain</span>
		<span class="badge">WebGL2 - Svelte migration</span>
	</header>

	<LeftControls bind:state {matrices} />
	<Viewport bind:state />
	<RightInspector {state} />
</div>
