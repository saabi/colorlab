<script module lang="ts">
	// ===== IMPORTS =====
	import { track } from '$lib/analytics/umami';
	import { getGuideNoteContext } from '$lib/guide-note/context';
	import type { GuideNotePlacement } from '$lib/engine/types';

	// ===== TYPES =====
	interface Props {
		note?: string | null;
		placement?: GuideNotePlacement;
		dismissed?: boolean;
		variant: GuideNotePlacement;
	}
</script>

<script lang="ts">
	// ===== PROPS =====
	let {
		note = $bindable<string | null>(null),
		placement = $bindable<GuideNotePlacement>('sidebar'),
		dismissed = $bindable(false),
		variant
	}: Props = $props();

	// ===== DERIVED =====
	const guideNote = getGuideNoteContext();
	const paragraphs = $derived((note ?? '').split(/\n\n+/).filter(Boolean));

	// ===== FUNCTIONS =====
	function dismiss() {
		dismissed = true;
		track('guide_note_dismiss', { variant });
	}

	function restore() {
		dismissed = false;
		track('guide_note_restore', { variant });
	}

	function openEditor() {
		guideNote?.openEditor();
	}
</script>

{#if note}
	{#if !dismissed}
		<aside class="guide-note guide-note--{variant}" aria-label="Example guide">
			<div class="guide-note-head">
				<span class="guide-note-label">Guide</span>
				<div class="guide-note-actions">
					<button type="button" class="guide-note-icon-btn" onclick={openEditor} aria-label="Edit guide">
						<span class="guide-icon" aria-hidden="true">✎</span>
					</button>
					<button type="button" class="guide-note-icon-btn" onclick={dismiss} aria-label="Dismiss guide">
						×
					</button>
				</div>
			</div>
			<div class="guide-note-body">
				{#each paragraphs as paragraph (paragraph)}
					<p>{paragraph}</p>
				{/each}
			</div>
		</aside>
	{:else}
		<div class="guide-restore-row guide-restore-row--{variant}">
			<button type="button" class="guide-restore" onclick={restore}>Show guide</button>
			<button type="button" class="guide-note-icon-btn guide-restore-edit" onclick={openEditor} aria-label="Edit guide">
				<span class="guide-icon" aria-hidden="true">✎</span>
			</button>
		</div>
	{/if}
{/if}
