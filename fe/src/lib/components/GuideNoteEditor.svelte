<script lang="ts">
	import { track } from '$lib/analytics/umami';

	import type { GuideNotePlacement } from '$lib/engine/types';

	let {
		open = false,
		initialNote = '',
		initialPlacement = 'sidebar',
		onSave,
		onCancel
	} = $props<{
		open: boolean;
		initialNote?: string;
		initialPlacement?: GuideNotePlacement;
		onSave: (note: string | null, placement: GuideNotePlacement) => void;
		onCancel: () => void;
	}>();

	let draftNote = $state('');
	let draftPlacement = $state<GuideNotePlacement>('sidebar');
	let textareaEl: HTMLTextAreaElement | undefined = $state();

	$effect(() => {
		if (open) {
			draftNote = initialNote;
			draftPlacement = initialPlacement;
			queueMicrotask(() => {
				textareaEl?.focus();
				textareaEl?.setSelectionRange(draftNote.length, draftNote.length);
			});
		}
	});

	function save() {
		const trimmed = draftNote.trim();
		onSave(trimmed || null, draftPlacement);
		track('guide_note_save', { placement: draftPlacement, empty: !trimmed });
	}

	function remove() {
		onSave(null, draftPlacement);
		track('guide_note_remove', { placement: draftPlacement });
	}
</script>

{#if open}
	<div class="confirm-backdrop" role="presentation" onclick={onCancel}></div>
	<div class="guide-note-editor" role="dialog" aria-modal="true" aria-labelledby="guide-note-editor-title">
		<h2 id="guide-note-editor-title">Guide note</h2>
		<label class="guide-editor-field">
			<span>Note</span>
			<textarea
				bind:this={textareaEl}
				bind:value={draftNote}
				rows={6}
				placeholder="Explain what to try in this example…"
				onkeydown={(event) => {
					if (event.key === 'Escape') onCancel();
				}}
			></textarea>
		</label>
		<fieldset class="guide-note-placement">
			<legend>Show on</legend>
			<label class="guide-placement-option">
				<input type="radio" bind:group={draftPlacement} value="sidebar" />
				Right sidebar
			</label>
			<label class="guide-placement-option">
				<input type="radio" bind:group={draftPlacement} value="overlay" />
				Explorer overlay
			</label>
		</fieldset>
		<p class="guide-editor-hint">Separate paragraphs with a blank line.</p>
		<div class="confirm-actions guide-editor-actions">
			{#if initialNote}
				<button type="button" class="confirm-btn confirm-btn-danger guide-editor-remove" onclick={remove}>
					Remove
				</button>
			{/if}
			<span class="guide-editor-actions-end">
				<button type="button" class="confirm-btn" onclick={onCancel}>Cancel</button>
				<button type="button" class="confirm-btn" onclick={save}>Save</button>
			</span>
		</div>
	</div>
{/if}
