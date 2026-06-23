<script module lang="ts">
	// ===== IMPORTS =====
	import { focusTrap } from '$lib/actions/focusTrap';

	// ===== TYPES =====
	interface Props {
		open: boolean;
		message: string;
		confirmLabel?: string;
		onDiscard: () => void;
		onCancel: () => void;
	}
</script>

<script lang="ts">
	// ===== PROPS =====
	let {
		open = false,
		message = '',
		confirmLabel = 'Discard',
		onDiscard,
		onCancel
	}: Props = $props();
</script>

{#if open}
	<div class="confirm-backdrop" role="presentation" onclick={onCancel}></div>
	<div
		class="confirm-dialog"
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="confirm-title"
		tabindex="-1"
		use:focusTrap={{ onEscape: onCancel }}
	>
		<p id="confirm-title">{message}</p>
		<div class="confirm-actions">
			<button type="button" class="confirm-btn" onclick={onCancel}>Cancel</button>
			<button type="button" class="confirm-btn confirm-btn-danger" onclick={onDiscard}>{confirmLabel}</button>
		</div>
	</div>
{/if}
