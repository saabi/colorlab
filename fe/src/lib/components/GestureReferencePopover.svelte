<script module lang="ts">
	// ===== IMPORTS =====
	import { MOBILE_LAYOUT_MAX_WIDTH } from '$lib/engine/mobile';

	// ===== TYPES =====
	interface Props {
		open: boolean;
	}

	type GestureGroup = {
		title: string;
		items: [string, string][];
	};

	// ===== STATIC CONSTANTS =====
	const POINTER_GROUPS: GestureGroup[] = [
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

	const TOUCH_GROUPS: GestureGroup[] = [
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

	const KEYBOARD_GROUPS: GestureGroup[] = [
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
</script>

<script lang="ts">
	// ===== IMPORTS =====
	import { onMount } from 'svelte';
	import { track } from '$lib/analytics/umami';

	// ===== PROPS =====
	let { open = $bindable() }: Props = $props();

	// ===== STATE =====
	let tab = $state<'pointer' | 'touch' | 'keyboard'>('pointer');

	// ===== DERIVED =====
	const groups = $derived(
		tab === 'pointer' ? POINTER_GROUPS : tab === 'touch' ? TOUCH_GROUPS : KEYBOARD_GROUPS
	);

	// ===== REFS =====
	let root: HTMLDivElement;

	// ===== LIFECYCLE =====
	onMount(() => {
		document.addEventListener('pointerdown', onDocumentPointerDown);
		return () => document.removeEventListener('pointerdown', onDocumentPointerDown);
	});

	// ===== FUNCTIONS =====
	function onDocumentPointerDown(event: PointerEvent) {
		if (!open) return;
		const target = event.target;
		if (target instanceof Node && root?.contains(target)) return;
		open = false;
	}
</script>

<div bind:this={root} class="gesture-reference">
	<button
		type="button"
		class="gesture-reference-trigger"
		aria-expanded={open}
		aria-controls="gesture-reference-panel"
		onclick={() => {
			open = !open;
			if (open) track('gesture_reference_open', { mobile: window.matchMedia(`(max-width: ${MOBILE_LAYOUT_MAX_WIDTH}px)`).matches });
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
