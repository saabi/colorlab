<script lang="ts">
	import LeftControls from './LeftControls.svelte';
	import RightInspector from './RightInspector.svelte';
	import Viewport from './Viewport.svelte';

	import type { ExplorerState } from '$lib/engine/types';

	let { state = $bindable() } = $props<{ state: ExplorerState }>();
</script>

<div class="app-shell">
	<header class="app-header">
		<h1>GAMUT EXPLORER</h1>
		<span class="sub">instanced color solids - arbitrary slices - transform chain</span>
		<span class="badge">WebGL2 - Svelte migration</span>
	</header>

	<LeftControls bind:state />
	<Viewport bind:state />
	<RightInspector {state} />
</div>
