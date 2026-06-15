<script lang="ts">
	import { APP_VERSION, CHANGELOG_URL, REPO_URL } from '$lib/app-meta';

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
		<span style="opacity: 0.3; margin: 0 4px">|</span>
		<a href={REPO_URL} target="_blank" rel="noopener noreferrer">
			GitHub
		</a>
		<span style="opacity: 0.3; margin: 0 4px">|</span>
		<a href={CHANGELOG_URL} target="_blank" rel="noopener noreferrer" title="View changelog">
			v{APP_VERSION}
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
		<div id="app-privacy-panel" class="app-info-panel" role="dialog" aria-label="About Color Lab">
			<h2>About</h2>
			<p>
				Color Lab is a color science instrument created by
				<a href="https://ferreyrapons.com" target="_blank" rel="author noopener noreferrer" style="text-decoration: underline; color: var(--txt)">
					Sebastian Ferreyra Pons
				</a>.
			</p>
			<h2>Open Source</h2>
			<p>
				The project is open source under the MIT License. You can inspect the math, submit issues, or contribute on
				<a href={REPO_URL} target="_blank" rel="noopener noreferrer" style="text-decoration: underline; color: var(--txt)">
					GitHub
				</a>
				(version <a href={CHANGELOG_URL} target="_blank" rel="noopener noreferrer" style="text-decoration: underline; color: var(--txt)">v{APP_VERSION}</a>).
			</p>
			<h2>Changelog</h2>
			<p>
				Release notes for v{APP_VERSION} and earlier versions are in the
				<a href={CHANGELOG_URL} target="_blank" rel="noopener noreferrer" style="text-decoration: underline; color: var(--txt)">
					project changelog
				</a>
				on GitHub.
			</p>
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
