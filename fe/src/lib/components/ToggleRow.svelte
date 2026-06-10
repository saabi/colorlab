<script lang="ts">
	let { label, checked = $bindable() } = $props<{
		label: string;
		checked: boolean;
	}>();
</script>

<label class="row">
	<span>{label}</span>
	<input type="checkbox" bind:checked />
</label>
