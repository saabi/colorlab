<script lang="ts">
	import { onMount } from 'svelte';
	import { track } from '$lib/analytics/umami';

	let { open = $bindable() } = $props<{ open: boolean }>();
	let root: HTMLDivElement;
	let tab = $state<'pointer' | 'touch' | 'keyboard'>('pointer');

	const pointerGroups = [
		{
			title: 'View',
			items: [
				['Drag', 'orbit'],
				['Wheel', 'zoom'],
				['Shift or Space + drag', 'pan'],
				['Double click solid', 'center target']
			]
		},
		{
			title: 'Inspect and Pick',
			items: [
				['Hover solid', 'inspect'],
				['Click point', 'select source point'],
				['Drag point', 'move source point'],
				['A + click solid', 'add source point']
			]
		},
		{
			title: 'Direct Edits',
			items: [
				['Alt + drag', 'slice offset'],
				['Ctrl / Cmd + drag', 'cylinder radius']
			]
		}
	];

	const touchGroups = [
		{
			title: 'View',
			items: [
				['Drag empty space', 'orbit'],
				['Pinch', 'zoom'],
				['Two-finger drag', 'pan']
			]
		},
		{
			title: 'Inspect and Pick',
			items: [
				['Drag solid', 'inspect'],
				['Tap point', 'select source point'],
				['Drag point', 'move source point']
			]
		},
		{
			title: 'Touch Tools',
			items: [
				['Slice tool + drag', 'slice offset'],
				['Cylinder tool + drag', 'cylinder radius'],
				['Add tool + tap solid', 'add source point']
			]
		}
	];

	const keyboardGroups = [
		{
			title: 'View',
			items: [
				['R', 'reset camera'],
				['Space (hold)', 'pan mode with drag'],
				['Ctrl / Cmd + Z', 'undo'],
				['Ctrl / Cmd + Shift + Z', 'redo'],
				['Ctrl + Y', 'redo']
			]
		},
		{
			title: 'Direct Edits',
			items: [
				['[ / ]', 'step slice'],
				['- / =', 'step cylinder']
			]
		},
		{
			title: 'Spline Points',
			items: [
				['A (hold)', 'add-point mode'],
				['Arrow keys', 'nudge selected'],
				['Alt + arrows', 'fine nudge'],
				['Shift + arrows', 'coarse nudge'],
				['Delete / Backspace', 'remove selected'],
				['Escape', 'cancel add mode']
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

	const groups = $derived(
		tab === 'pointer' ? pointerGroups : tab === 'touch' ? touchGroups : keyboardGroups
	);

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
			<div class="gesture-reference-tabs" role="tablist" aria-label="Gesture reference categories">
				<button
					type="button"
					role="tab"
					aria-selected={tab === 'pointer'}
					class:active={tab === 'pointer'}
					onclick={() => (tab = 'pointer')}
				>Mouse</button>
				<button
					type="button"
					role="tab"
					aria-selected={tab === 'touch'}
					class:active={tab === 'touch'}
					onclick={() => (tab = 'touch')}
				>Touch</button>
				<button
					type="button"
					role="tab"
					aria-selected={tab === 'keyboard'}
					class:active={tab === 'keyboard'}
					onclick={() => (tab = 'keyboard')}
				>Keyboard</button>
			</div>
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
