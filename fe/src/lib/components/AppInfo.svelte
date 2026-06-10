<script lang="ts">
	let open = $state(false);
	let root: HTMLDivElement | undefined = $state();

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	function onDocumentPointerDown(event: PointerEvent) {
		if (!open || !root) return;
		if (!root.contains(event.target as Node)) close();
	}

	function onDocumentKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') close();
	}
</script>

<svelte:document onpointerdown={onDocumentPointerDown} onkeydown={onDocumentKeyDown} />

<div class="app-info" bind:this={root}>
	<span class="app-info-author">
		<span class="app-info-by">by</span>
		<a href="https://ferreyrapons.com" target="_blank" rel="author noopener noreferrer">
			Sebastian Ferreyra Pons
		</a>
	</span>
	<button
		type="button"
		class="app-info-privacy"
		aria-expanded={open}
		aria-controls="app-privacy-panel"
		onclick={toggle}
	>
		<span class="app-info-privacy-label">Privacy</span>
		<span class="app-info-mobile-label">Info</span>
	</button>

	{#if open}
		<div id="app-privacy-panel" class="app-info-panel" role="dialog" aria-label="Privacy statement">
			<h2>Privacy</h2>
			<p>
				Color Lab stores your saved parameter sets in this browser's local storage. They are not uploaded by the app.
			</p>
			<p>
				If analytics are enabled, this site uses Umami to collect privacy-friendly usage statistics such as page views
				and feature interactions. Analytics events do not include document names, color values, exported tokens, or saved
				parameter data.
			</p>
			<p>You can clear saved parameter sets from your browser storage at any time.</p>
		</div>
	{/if}
</div>
