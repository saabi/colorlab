<script lang="ts">
	import type { ExplorerState } from '$lib/engine/types';

	let { state } = $props<{ state: ExplorerState }>();
</script>

<main class="viewport">
	<canvas aria-label="Gamut explorer WebGL viewport"></canvas>
	<div class="viewport-placeholder">
		WebGL renderer migration starts here
	</div>
	<div class="hint">
		drag - orbit&nbsp;&nbsp;wheel - zoom&nbsp;&nbsp;hover solid - inspect chain
	</div>
</main>
