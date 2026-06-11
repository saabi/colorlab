<script lang="ts">
	import { onMount } from 'svelte';
	import { track } from '$lib/analytics/umami';

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
				['A + click', 'add source point']
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
			title: 'Spline Points',
			items: [
				['Click / tap point', 'select'],
				['Drag point', 'move'],
				['Arrow keys', 'nudge selected'],
				['Alt / Shift + arrows', 'fine / coarse nudge'],
				['Delete', 'remove selected']
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
		if (!open) return;
		const target = event.target;
		if (target instanceof Node && root?.contains(target)) return;
		open = false;
	}

	onMount(() => {
		document.addEventListener('pointerdown', onDocumentPointerDown);
		return () => document.removeEventListener('pointerdown', onDocumentPointerDown);
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
			if (open) track('gesture_reference_open', { mobile: window.matchMedia('(max-width: 760px)').matches });
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
