<script lang="ts">
	import { APP_VERSION, CHANGELOG_URL, REPO_URL } from '$lib/app-meta';

	let { open = $bindable(false) } = $props<{ open?: boolean }>();
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
		<span class="app-info-sep" aria-hidden="true">|</span>
		<a href={REPO_URL} class="app-info-gh" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository" title="GitHub repository">
			<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true">
				<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
			</svg>
		</a>
		<span class="app-info-sep" aria-hidden="true">|</span>
		<a href={CHANGELOG_URL} target="_blank" rel="noopener noreferrer" title="View changelog">
			v{APP_VERSION}
		</a>
	</span>
	<button
		type="button"
		class="app-info-about"
		aria-expanded={open}
		aria-controls="app-about-panel"
		aria-label="About Color Lab"
		onclick={toggle}
	>
		About
	</button>

	{#if open}
		<div id="app-about-panel" class="app-info-panel" role="dialog" aria-label="About Color Lab">
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
			<h2>Beta limitations</h2>
			<p>
				Color Lab is pre-release beta software. A few things to know before you rely on it for
				production work:
			</p>
			<ul>
				<li>
					<strong>WebGL2 required.</strong> There is no canvas or CPU fallback. If your browser
					does not support WebGL2, the 3D solid will not render.
				</li>
				<li>
					<strong>Ramp gamut map targets the active colorspace.</strong> sRGB is the default.
					The analytic mapper is sRGB-specific today — other active gamuts as output targets await
					the generic solver.
				</li>
				<li>
					<strong>Non-D65 gamuts use Bradford chromatic adaptation.</strong> NTSC (Illuminant C) and
					CIE 1931 RGB (Illuminant E) are adapted to the D65 interchange white used by sRGB/Lab/Oklab
					math. D65 gamuts are unchanged.
				</li>
				<li>
					<strong>Display assumed sRGB.</strong> Vision simulation and on-screen preview assume an
					sRGB-compliant monitor. Custom display primaries and calibration are planned.
				</li>
			</ul>
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
