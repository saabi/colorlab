<script lang="ts">
	import { focusTrap } from '$lib/actions/focusTrap';

	let {
		open = false,
		title = '',
		label = 'Name',
		initialValue = '',
		onSubmit,
		onCancel
	} = $props<{
		open: boolean;
		title: string;
		label?: string;
		initialValue?: string;
		onSubmit: (name: string) => void;
		onCancel: () => void;
	}>();

	let value = $state('');
	let inputEl: HTMLInputElement | undefined = $state();

	$effect(() => {
		if (open) {
			value = initialValue;
			queueMicrotask(() => {
				inputEl?.focus();
				inputEl?.select();
			});
		}
	});

	function submit() {
		const name = value.trim();
		if (!name) return;
		onSubmit(name);
	}
</script>

{#if open}
	<div class="confirm-backdrop" role="presentation" onclick={onCancel}></div>
	<div
		class="name-prompt-dialog"
		role="dialog"
		aria-modal="true"
		aria-labelledby="name-prompt-title"
		tabindex="-1"
		use:focusTrap={{ onEscape: onCancel }}
	>
		<h2 id="name-prompt-title">{title}</h2>
		<label class="name-prompt-label">
			<span>{label}</span>
			<input
				bind:this={inputEl}
				type="text"
				bind:value
				onkeydown={(event) => {
					if (event.key === 'Enter') submit();
					if (event.key === 'Escape') onCancel();
				}}
			/>
		</label>
		<div class="confirm-actions">
			<button type="button" class="confirm-btn" onclick={onCancel}>Cancel</button>
			<button type="button" class="confirm-btn" onclick={submit}>OK</button>
		</div>
	</div>
{/if}
