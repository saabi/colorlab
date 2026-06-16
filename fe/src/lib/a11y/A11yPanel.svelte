<script lang="ts">
	import {
		FONT_SCALE_OPTIONS,
		LINE_HEIGHT_OPTIONS,
		SECONDARY_CONTRAST_OPTIONS,
		a11yPreferences,
		loadA11yPreferences,
		resetA11yPreferences,
		setA11yPreference,
		type SecondaryContrast
	} from './preferences.svelte';

	let { open = $bindable(false) } = $props<{ open?: boolean }>();
	let root: HTMLDivElement;

	const contrastLabel: Record<SecondaryContrast, string> = {
		normal: 'Normal',
		high: 'High',
		maximum: 'Maximum'
	};

	$effect(() => {
		loadA11yPreferences();
	});

	function onDocumentPointerDown(event: PointerEvent) {
		if (!open) return;
		const target = event.target;
		if (target instanceof Node && root?.contains(target)) return;
		open = false;
	}

	$effect(() => {
		document.addEventListener('pointerdown', onDocumentPointerDown);
		return () => document.removeEventListener('pointerdown', onDocumentPointerDown);
	});
</script>

<div bind:this={root} class="a11y-wrap">
	<button
		type="button"
		class="a11y-trigger"
		aria-expanded={open}
		aria-controls="readability-panel"
		aria-label="Readability preferences"
		onclick={() => (open = !open)}
	>
		Text
	</button>

	{#if open}
		<div id="readability-panel" class="a11y-panel" role="dialog" aria-label="Readability preferences">
			<div class="a11y-panel-head">
				<h2>Readability</h2>
				<button type="button" class="a11y-reset" onclick={resetA11yPreferences}>Reset</button>
			</div>

			<fieldset>
				<legend>Font scale</legend>
				<div class="a11y-options">
					{#each FONT_SCALE_OPTIONS as option}
						<button
							type="button"
							class:active={a11yPreferences.fontScale === option}
							aria-pressed={a11yPreferences.fontScale === option}
							onclick={() => setA11yPreference('fontScale', option)}
						>{option}%</button>
					{/each}
				</div>
			</fieldset>

			<fieldset>
				<legend>Secondary contrast</legend>
				<div class="a11y-options">
					{#each SECONDARY_CONTRAST_OPTIONS as option}
						<button
							type="button"
							class:active={a11yPreferences.secondaryContrast === option}
							aria-pressed={a11yPreferences.secondaryContrast === option}
							onclick={() => setA11yPreference('secondaryContrast', option)}
						>{contrastLabel[option]}</button>
					{/each}
				</div>
			</fieldset>

			<fieldset>
				<legend>Line height</legend>
				<div class="a11y-options">
					{#each LINE_HEIGHT_OPTIONS as option}
						<button
							type="button"
							class:active={a11yPreferences.lineHeight === option}
							aria-pressed={a11yPreferences.lineHeight === option}
							onclick={() => setA11yPreference('lineHeight', option)}
						>{option}%</button>
					{/each}
				</div>
			</fieldset>
		</div>
	{/if}
</div>

<style>
	.a11y-wrap {
		position: relative;
		flex: 0 0 auto;
	}

	.a11y-trigger {
		width: auto;
		border: 1px solid color-mix(in srgb, var(--accent), transparent 38%);
		border-radius: 5px;
		background: color-mix(in srgb, var(--accent), transparent 88%);
		color: var(--txt);
		padding: 3px 8px;
		font-size: max(12px, 0.923rem);
		font-weight: 600;
		white-space: nowrap;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--txt) 6%, transparent);
	}

	.a11y-trigger:hover,
	.a11y-trigger[aria-expanded="true"] {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent), transparent 80%);
		color: var(--accent);
	}

	.a11y-panel {
		position: absolute;
		z-index: 40;
		top: calc(100% + 10px);
		right: 0;
		display: grid;
		gap: 14px;
		width: min(360px, calc(100vw - 24px));
		padding: 14px;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: color-mix(in srgb, var(--panel) 98%, transparent);
		box-shadow: 0 12px 32px color-mix(in srgb, var(--txt) 14%, transparent);
		color: var(--txt);
		font-size: max(14px, 1rem);
		line-height: var(--ui-line-height);
		backdrop-filter: blur(10px);
	}

	.a11y-panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.a11y-panel h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
	}

	.a11y-reset {
		width: auto;
		border-radius: 5px;
		padding: 4px 9px;
		font-size: 0.923rem;
	}

	.a11y-panel fieldset {
		display: grid;
		gap: 7px;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.a11y-panel legend {
		padding: 0;
		color: var(--dim);
		font-size: 0.923rem;
		font-weight: 600;
	}

	.a11y-options {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.a11y-options button {
		width: auto;
		min-height: 30px;
		padding: 5px 9px;
		border-radius: 5px;
		background: var(--panel2);
		color: var(--txt);
		font-size: 0.923rem;
	}

	.a11y-options button.active,
	.a11y-options button[aria-pressed="true"] {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 12%, var(--panel2));
		color: var(--accent);
	}

	@media (max-width: 820px) {
		.a11y-panel {
			position: fixed;
			top: auto;
			right: 12px;
			bottom: 12px;
			left: 12px;
			width: auto;
		}
	}
</style>
