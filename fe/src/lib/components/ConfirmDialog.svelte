<script lang="ts">
	let {
		open = false,
		message = '',
		confirmLabel = 'Discard',
		onDiscard,
		onCancel
	} = $props<{
		open: boolean;
		message: string;
		confirmLabel?: string;
		onDiscard: () => void;
		onCancel: () => void;
	}>();
</script>

{#if open}
	<div class="confirm-backdrop" role="presentation" onclick={onCancel}></div>
	<div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
		<p id="confirm-title">{message}</p>
		<div class="confirm-actions">
			<button type="button" class="confirm-btn" onclick={onCancel}>Cancel</button>
			<button type="button" class="confirm-btn confirm-btn-danger" onclick={onDiscard}>{confirmLabel}</button>
		</div>
	</div>
{/if}
