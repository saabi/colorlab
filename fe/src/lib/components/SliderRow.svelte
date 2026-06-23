<script module lang="ts">
	// ===== TYPES =====
	interface Props {
		label: string;
		value: number;
		min: number;
		max: number;
		step: number;
		format?: (next: number) => string;
	}
</script>

<script lang="ts">
	// ===== PROPS =====
	let {
		label,
		value = $bindable(),
		min,
		max,
		step,
		format = (next: number) => String(next)
	}: Props = $props();

	// ===== DERIVED =====
	const id = $derived(`slider-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
</script>

<label class="row" for={id}>
	<span>{label}</span>
	<span class="value">{format(value)}</span>
</label>
<input {id} type="range" bind:value {min} {max} {step} />
