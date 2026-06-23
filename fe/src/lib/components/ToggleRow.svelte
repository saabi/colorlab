<script module lang="ts">
	// ===== TYPES =====
	interface Props {
		label: string;
		checked: boolean;
	}
</script>

<script lang="ts">
	// ===== PROPS =====
	let { label, checked = $bindable() }: Props = $props();
</script>

<label class="row">
	<span>{label}</span>
	<input type="checkbox" bind:checked />
</label>
