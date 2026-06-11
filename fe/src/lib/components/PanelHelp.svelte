<script lang="ts">
	import { onMount } from 'svelte';
	import { HELP_BY_ID, type HelpId } from '$lib/inspector/help-copy';

	let {
		helpId,
		instanceId = helpId,
		openHelp = $bindable(null as string | null)
	}: {
		helpId: HelpId;
		instanceId?: string;
		openHelp?: string | null;
	} = $props();

	let popoverStyle = $state('');
	let buttonEl = $state<HTMLButtonElement | null>(null);
	const openKey = $derived(`${helpId}:${instanceId}`);
	let popoverId = $derived(`panel-help-${openKey.replace(/[^a-zA-Z0-9_-]+/g, '-')}`);

	const content = $derived(HELP_BY_ID[helpId]);
	const open = $derived(openHelp === openKey);
	const visibleSources = $derived(content.sources.filter((source) => !isRepoInternalSource(source.label)));

	function isRepoInternalSource(label: string) {
		return /\b[\w-]+\.(?:ts|svelte|md|glsl|vert|frag)\b/.test(label) || /\bdesign\.md\b/.test(label) || /\bWebGL renderer\b/.test(label) || /\bshader\b/i.test(label);
	}

	function placePopover() {
		if (!buttonEl) return;
		const rect = buttonEl.getBoundingClientRect();
		const width = Math.min(300, window.innerWidth - 24);
		const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
		const top = Math.min(rect.bottom + 8, window.innerHeight - 200);
		popoverStyle = `left: ${left}px; top: ${top}px; width: ${width}px;`;
	}

	function toggle() {
		if (open) {
			openHelp = null;
			return;
		}
		placePopover();
		openHelp = openKey;
	}

	function close() {
		if (open) openHelp = null;
	}

	onMount(() => {
		const onDocClick = (event: MouseEvent) => {
			if (!open) return;
			const target = event.target as Node;
			if (buttonEl?.contains(target)) return;
			const popover = document.getElementById(popoverId);
			if (popover?.contains(target)) return;
			close();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (open && event.key === 'Escape') close();
		};
		document.addEventListener('click', onDocClick, true);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('click', onDocClick, true);
			document.removeEventListener('keydown', onKeyDown);
		};
	});
</script>

<span class="panel-help">
	<button
		bind:this={buttonEl}
		type="button"
		class="panel-help-trigger"
		class:active={open}
		aria-label="Help: {content.title}"
		aria-expanded={open}
		aria-controls={popoverId}
		onclick={toggle}
	>?</button>
	{#if open}
		<div id={popoverId} class="panel-help-popover" class:open role="dialog" style={popoverStyle}>
			<span class="panel-help-title">{content.title}</span>
			<p class="panel-help-summary">{content.summary}</p>
			{#if content.stageRows?.length}
				<div class="panel-help-stage">
					{#each content.stageRows as row}
						<div class="panel-help-stage-row" class:neutral={row.tone === 'neutral'} class:change={row.tone === 'change'} class:output={row.tone === 'output'} class:exclude={row.tone === 'exclude'}>
							<span class="panel-help-stage-label">{row.label}</span>
							<span class="panel-help-stage-text">{row.text}</span>
						</div>
					{/each}
				</div>
			{:else}
				{#each content.details ?? [] as paragraph}
					<p class="panel-help-summary">{paragraph}</p>
				{/each}
			{/if}
			{#if visibleSources.length}
				<span class="panel-help-sources-label">Sources</span>
				<ul class="panel-help-sources">
					{#each visibleSources as source}
						<li>
							{#if source.href}
								<a href={source.href} target="_blank" rel="noopener noreferrer">{source.label}</a>
							{:else}
								{source.label}
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</span>

<style>
	.panel-help {
		position: relative;
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
	}

	.panel-help-trigger {
		display: grid;
		place-items: center;
		width: 17px;
		height: 17px;
		border: 1px solid var(--line);
		border-radius: 50%;
		background: transparent;
		color: var(--dim);
		padding: 0;
		font-size: 10px;
		font-weight: 600;
		line-height: 1;
	}

	.panel-help-trigger:hover,
	.panel-help-trigger:focus,
	.panel-help-trigger.active {
		border-color: var(--accent);
		color: var(--accent);
		outline: none;
	}

	.panel-help-popover {
		position: fixed;
		z-index: 1000;
		display: grid;
		gap: 6px;
		max-height: min(70dvh, 480px);
		overflow-y: auto;
		border: 1px solid #35363b;
		border-radius: 8px;
		background: #111216;
		box-shadow: 0 16px 44px #000b;
		padding: 10px;
		color: var(--txt);
		text-transform: none;
		letter-spacing: 0;
	}

	.panel-help-title {
		color: var(--dim);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.panel-help-summary {
		margin: 0;
		color: var(--txt);
		font-size: 11px;
		line-height: 1.4;
	}

	.panel-help-stage {
		display: grid;
		gap: 5px;
		margin-top: 2px;
	}

	.panel-help-stage-row {
		display: grid;
		grid-template-columns: 82px minmax(0, 1fr);
		gap: 8px;
		align-items: start;
		border-left: 2px solid transparent;
		padding: 4px 0 4px 7px;
	}

	.panel-help-stage-row.neutral {
		border-left-color: color-mix(in srgb, var(--dim), transparent 45%);
	}

	.panel-help-stage-row.change {
		border-left-color: color-mix(in srgb, var(--accent), transparent 20%);
	}

	.panel-help-stage-row.output {
		border-left-color: #65bfa8;
	}

	.panel-help-stage-row.exclude {
		border-left-color: #a06f6f;
	}

	.panel-help-stage-label {
		color: var(--dim);
		font-size: 9px;
		font-weight: 700;
		line-height: 1.35;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.panel-help-stage-text {
		color: var(--txt);
		font-size: 11px;
		line-height: 1.4;
	}

	.panel-help-sources-label {
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		color: var(--faint);
		margin-top: 2px;
		padding-top: 7px;
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.panel-help-sources {
		margin: 0;
		padding-left: 14px;
		color: var(--dim);
		font-size: 10px;
		line-height: 1.35;
	}

	.panel-help-sources a {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.panel-help-sources a:hover {
		color: var(--txt);
	}

	@media (max-width: 520px) {
		.panel-help-stage-row {
			grid-template-columns: 1fr;
			gap: 1px;
		}
	}
</style>
