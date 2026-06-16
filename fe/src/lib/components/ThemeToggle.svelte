<script lang="ts">
	import { readAppPreferences, setUiTheme, type UiTheme } from '$lib/preferences/app.svelte';

	let theme = $state<UiTheme>('dark');

	$effect(() => {
		theme = readAppPreferences().theme;
	});

	function toggle() {
		const next: UiTheme = theme === 'dark' ? 'light' : 'dark';
		theme = next;
		setUiTheme(next);
	}

	const actionLabel = $derived(theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
</script>

<button type="button" class="theme-toggle" onclick={toggle} aria-label={actionLabel} title={actionLabel}>
	{#if theme === 'dark'}
		<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
			<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
		</svg>
	{:else}
		<svg
			viewBox="0 0 24 24"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="4" />
			<path
				d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
			/>
		</svg>
	{/if}
</button>

<style>
	.theme-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		width: auto;
		min-width: 30px;
		min-height: 30px;
		padding: 3px 7px;
		border: 1px solid color-mix(in srgb, var(--accent), transparent 38%);
		border-radius: 5px;
		background: color-mix(in srgb, var(--accent), transparent 88%);
		color: var(--txt);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--txt) 6%, transparent);
		cursor: pointer;
	}

	.theme-toggle:hover {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent), transparent 80%);
		color: var(--accent);
	}

	.theme-toggle svg {
		display: block;
	}
</style>
