<script lang="ts">
	import { track } from '$lib/analytics/umami';
	import { setGuideNoteContext } from '$lib/guide-note/context';
	import GuideNoteEditor from './GuideNoteEditor.svelte';

	import type { ExplorerState } from '$lib/engine/types';
	import type { Snippet } from 'svelte';

	let {
		explorer = $bindable(),
		children
	} = $props<{
		explorer: ExplorerState;
		children: Snippet;
	}>();

	let open = $state(false);

	setGuideNoteContext({
		openEditor: () => {
			open = true;
			track('guide_note_edit_open', { hasNote: !!explorer.guideNote });
		}
	});

	function onSave(note: string | null, placement: ExplorerState['guideNotePlacement']) {
		open = false;
		explorer.guideNote = note;
		explorer.guideNotePlacement = placement;
		if (note) explorer.guideNoteDismissed = false;
	}

	function onCancel() {
		open = false;
	}
</script>

{@render children()}

<GuideNoteEditor
	{open}
	initialNote={explorer.guideNote ?? ''}
	initialPlacement={explorer.guideNotePlacement}
	onSave={onSave}
	onCancel={onCancel}
/>
