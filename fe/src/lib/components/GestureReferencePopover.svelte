<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	let { open = $bindable() } = $props<{ open: boolean }>();
	let root: HTMLDivElement;

	const groups = [
		{
			title: 'View',
			items: [
				['Drag', 'orbit'],
				['Wheel / pinch', 'zoom'],
				['Shift or Space + drag', 'pan'],
				['Double click solid', 'center target'],
				['R', 'reset camera']
			]
		},
		{
			title: 'Inspect and Pick',
			items: [
				['Hover solid', 'inspect'],
				['Touch solid + drag', 'inspect'],
				['A + click', 'set theme A'],
				['B + click', 'set theme B']
			]
		},
		{
			title: 'Direct Edits',
			items: [
				['Alt + drag', 'slice offset'],
				['Ctrl + drag', 'cylinder radius'],
				['[ / ]', 'step slice'],
				['- / =', 'step cylinder']
			]
		},
		{
			title: 'Toggles',
			items: [
				['X', 'slice'],
				['C', 'cylinder'],
				['G', 'surface grid'],
				['O', 'outlines']
			]
		}
	];

	function onDocumentPointerDown(event: PointerEvent) {
		if (!open || root?.contains(event.target as Node)) return;
		open = false;
	}

	onMount(() => {
		document.addEventListener('pointerdown', onDocumentPointerDown);
		return () => document.removeEventListener('pointerdown', onDocumentPointerDown);
	});

	onDestroy(() => {
		document.removeEventListener('pointerdown', onDocumentPointerDown);
	});
</script>

<div bind:this={root} class="gesture-reference">
	<button
		type="button"
		class="gesture-reference-trigger"
		aria-expanded={open}
		aria-controls="gesture-reference-panel"
		onclick={() => {
			open = !open;
		}}
	>
		Gestures
	</button>

	{#if open}
		<div id="gesture-reference-panel" class="gesture-reference-panel" role="dialog" aria-label="Gesture reference">
			{#each groups as group}
				<section>
					<h2>{group.title}</h2>
					{#each group.items as item}
						<div class="gesture-reference-row">
							<kbd>{item[0]}</kbd>
							<span>{item[1]}</span>
						</div>
					{/each}
				</section>
			{/each}
		</div>
	{/if}
</div>
