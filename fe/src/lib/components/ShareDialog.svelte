<script module lang="ts">
	// ===== IMPORTS =====
	import { focusTrap } from '$lib/actions/focusTrap';
	import { track } from '$lib/analytics/umami';
	import { buildShareUrl, snapshotToJsonString } from '$lib/documents/share';
	import type { ParameterSnapshot } from '$lib/documents/types';

	// ===== TYPES =====
	interface Props {
		open: boolean;
		getSnapshot: () => ParameterSnapshot;
		notify?: (text: string) => void;
		onClose: () => void;
	}

	// ===== STATIC CONSTANTS =====
	// Beyond this, some browsers/clients truncate links — steer users to the file.
	const URL_SOFT_LIMIT = 8000;
</script>

<script lang="ts">
	// ===== PROPS =====
	let { open = false, getSnapshot, notify, onClose }: Props = $props();

	// ===== STATE =====
	let shareUrl = $state('');
	let building = $state(false);
	let error = $state('');

	// ===== DERIVED =====
	const tooLong = $derived(shareUrl.length > URL_SOFT_LIMIT);

	// ===== EFFECTS =====
	$effect(() => {
		if (!open) {
			shareUrl = '';
			error = '';
			return;
		}
		building = true;
		error = '';
		const base = `${window.location.origin}${window.location.pathname}`;
		buildShareUrl(getSnapshot(), base)
			.then((url) => {
				shareUrl = url;
			})
			.catch(() => {
				error = 'Could not build a share link. Use Save to file instead.';
			})
			.finally(() => {
				building = false;
			});
	});

	// ===== FUNCTIONS =====
	async function copyText(text: string, label: string, mode: 'url' | 'json') {
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
			track('document_share', { mode });
			notify?.(label);
			onClose();
		} catch {
			error = 'Clipboard was blocked. Select the link and copy manually.';
		}
	}
</script>

{#if open}
	<div class="confirm-backdrop" role="presentation" onclick={onClose}></div>
	<div
		class="share-dialog"
		role="dialog"
		aria-modal="true"
		aria-labelledby="share-dialog-title"
		tabindex="-1"
		use:focusTrap={{ onEscape: onClose }}
	>
		<h2 id="share-dialog-title">Share document</h2>
		<p class="share-hint">
			The link and JSON capture the current parameters — colors, pipeline, and view. They are
			self-contained; nothing is uploaded. To keep a copy on disk, use <strong>Save to file</strong>.
		</p>

		<label class="share-field">
			<span>Share link</span>
			<input
				type="text"
				readonly
				value={building ? 'Building link…' : shareUrl}
				onfocus={(event) => event.currentTarget.select()}
			/>
		</label>

		{#if tooLong}
			<p class="share-warn">This document is large; the link may not work everywhere. Prefer Save to file.</p>
		{/if}
		{#if error}
			<p class="share-warn">{error}</p>
		{/if}

		<div class="confirm-actions share-actions">
			<button type="button" class="confirm-btn" onclick={onClose}>Close</button>
			<span class="share-actions-end">
				<button
					type="button"
					class="confirm-btn"
					onclick={() => copyText(snapshotToJsonString(getSnapshot()), 'Copied JSON', 'json')}
				>Copy JSON</button>
				<button
					type="button"
					class="confirm-btn"
					disabled={building || !shareUrl}
					onclick={() => copyText(shareUrl, 'Copied share link', 'url')}
				>Copy link</button>
			</span>
		</div>
	</div>
{/if}

<style>
	.share-dialog {
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

	.share-dialog h2 {
		margin: 0 0 0.5rem;
		font-size: 1.077rem;
	}

	.share-hint {
		margin: 0 0 0.8rem;
		color: var(--dim, #9a9ba1);
		line-height: var(--ui-line-height, 1.45);
	}

	.share-field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-bottom: 0.6rem;
	}

	.share-field span {
		color: var(--dim, #9a9ba1);
	}

	.share-field input {
		width: 100%;
		padding: 0.4rem 0.5rem;
		font-family: 'IBM Plex Mono', monospace;
		font-size: 0.846rem;
		color: var(--fg, #e6e6ea);
		background: var(--bg, #0a0a0b);
		border: 1px solid var(--line, #2a2a30);
		border-radius: 0.35rem;
	}

	.share-warn {
		margin: 0 0 0.6rem;
		color: var(--warn, #e0a14a);
		line-height: var(--ui-line-height, 1.45);
	}

	.share-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.share-actions-end {
		display: inline-flex;
		gap: 0.5rem;
	}
</style>
