<script module lang="ts">
	// ===== IMPORTS =====
	import { focusTrap } from '$lib/actions/focusTrap';
	import {
		resolveSnapshotFromUrl,
		snapshotFromJsonString,
		type UrlImportResult
	} from '$lib/documents/share';
	import type { DocumentSession } from '$lib/documents/session.svelte';
	import type { ParseSnapshotResult } from '$lib/documents/parse';

	// ===== TYPES =====
	interface Props {
		open: boolean;
		session: DocumentSession;
		notify?: (text: string) => void;
		onClose: () => void;
	}

	type Mode = 'file' | 'url' | 'paste';

	// ===== STATIC CONSTANTS =====
	const MODES: Array<{ value: Mode; label: string }> = [
		{ value: 'file', label: 'From file' },
		{ value: 'url', label: 'From URL' },
		{ value: 'paste', label: 'Paste JSON' }
	];
	const SOURCE_LABEL: Record<Mode, string> = { file: 'file', url: 'URL', paste: 'pasted JSON' };
</script>

<script lang="ts">
	// ===== PROPS =====
	let { open = false, session, notify, onClose }: Props = $props();

	// ===== STATE =====
	let mode = $state<Mode>('file');
	let urlValue = $state('');
	let pasteValue = $state('');
	let busy = $state(false);
	let error = $state('');

	// ===== EFFECTS =====
	$effect(() => {
		if (!open) {
			mode = 'file';
			urlValue = '';
			pasteValue = '';
			error = '';
			busy = false;
		}
	});

	// ===== FUNCTIONS =====
	function describe(result: ParseSnapshotResult | UrlImportResult): string {
		const reason = (result as UrlImportResult).reason;
		if (reason === 'network') return 'Could not reach that URL — the network or CORS policy blocked it.';
		if (reason === 'http') return 'That URL returned an error (not found or server error).';
		if (reason === 'too-large') return 'That response is too large to be a Color Lab document.';
		if (result.rejectReason === 'newer')
			return 'That document was saved by a newer version of Color Lab and cannot be opened here.';
		return 'That is not a valid Color Lab document.';
	}

	// Close before handing off so the dirty-discard confirm never stacks on this dialog.
	async function finish(result: ParseSnapshotResult | UrlImportResult, source: Mode) {
		if (!result.snapshot) {
			error = describe(result);
			return;
		}
		onClose();
		const ok = await session.importSnapshot(result.snapshot, { source });
		if (ok) notify?.(`Loaded from ${SOURCE_LABEL[source]}`);
	}

	async function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		error = '';
		await finish(snapshotFromJsonString(await file.text()), 'file');
	}

	async function onUrl() {
		const url = urlValue.trim();
		if (!url) return;
		busy = true;
		error = '';
		try {
			await finish(await resolveSnapshotFromUrl(url), 'url');
		} finally {
			busy = false;
		}
	}

	async function onPaste() {
		if (!pasteValue.trim()) return;
		error = '';
		await finish(snapshotFromJsonString(pasteValue), 'paste');
	}
</script>

{#if open}
	<div class="confirm-backdrop" role="presentation" onclick={onClose}></div>
	<div
		class="import-dialog"
		role="dialog"
		aria-modal="true"
		aria-labelledby="import-dialog-title"
		tabindex="-1"
		use:focusTrap={{ onEscape: onClose }}
	>
		<h2 id="import-dialog-title">Open a document</h2>

		<div class="import-tabs" role="tablist" aria-label="Import source">
			{#each MODES as m}
				<button
					type="button"
					role="tab"
					aria-selected={mode === m.value}
					class:active={mode === m.value}
					onclick={() => {
						mode = m.value;
						error = '';
					}}
				>{m.label}</button>
			{/each}
		</div>

		<div class="import-pane">
			{#if mode === 'file'}
				<p class="import-hint">Choose a Color Lab <code>.json</code> file.</p>
				<input type="file" accept="application/json,.json" onchange={onFile} />
			{:else if mode === 'url'}
				<p class="import-hint">Paste a Color Lab share link, or a URL pointing to a <code>.json</code> document.</p>
				<input
					type="url"
					placeholder="https://…"
					bind:value={urlValue}
					onkeydown={(event) => {
						if (event.key === 'Enter') onUrl();
					}}
				/>
			{:else}
				<p class="import-hint">Paste document JSON.</p>
				<textarea rows={7} placeholder="{'{'} … {'}'}" bind:value={pasteValue}></textarea>
			{/if}
		</div>

		{#if error}
			<p class="import-error">{error}</p>
		{/if}

		<div class="confirm-actions import-actions">
			<button type="button" class="confirm-btn" onclick={onClose}>Cancel</button>
			{#if mode === 'url'}
				<button type="button" class="confirm-btn" disabled={busy || !urlValue.trim()} onclick={onUrl}>
					{busy ? 'Fetching…' : 'Fetch'}
				</button>
			{:else if mode === 'paste'}
				<button type="button" class="confirm-btn" disabled={!pasteValue.trim()} onclick={onPaste}>Load</button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.import-dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1000;
		width: min(34rem, calc(100vw - 2rem));
		padding: 1.1rem 1.2rem 1rem;
		background: var(--panel, #16161a);
		border: 1px solid var(--line, #2a2a30);
		border-radius: 0.6rem;
		box-shadow: 0 1.4rem 3rem rgba(0, 0, 0, 0.5);
	}

	.import-dialog h2 {
		margin: 0 0 0.7rem;
		font-size: 1.077rem;
	}

	.import-tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 0.7rem;
	}

	.import-tabs button {
		flex: 1;
		padding: 0.35rem 0.5rem;
		font-size: 0.846rem;
		color: var(--dim, #9a9ba1);
		background: var(--bg, #0a0a0b);
		border: 1px solid var(--line, #2a2a30);
		border-radius: 0.35rem;
		cursor: pointer;
	}

	.import-tabs button.active {
		color: var(--fg, #e6e6ea);
		border-color: var(--accent, #d6a93a);
	}

	.import-pane {
		min-height: 4.5rem;
		margin-bottom: 0.6rem;
	}

	.import-hint {
		margin: 0 0 0.5rem;
		color: var(--dim, #9a9ba1);
		line-height: var(--ui-line-height, 1.45);
	}

	.import-pane input,
	.import-pane textarea {
		width: 100%;
		padding: 0.4rem 0.5rem;
		font-size: 0.846rem;
		color: var(--fg, #e6e6ea);
		background: var(--bg, #0a0a0b);
		border: 1px solid var(--line, #2a2a30);
		border-radius: 0.35rem;
	}

	.import-pane textarea {
		font-family: 'IBM Plex Mono', monospace;
		resize: vertical;
	}

	.import-error {
		margin: 0 0 0.6rem;
		color: var(--warn, #e0a14a);
		line-height: var(--ui-line-height, 1.45);
	}

	.import-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
</style>
