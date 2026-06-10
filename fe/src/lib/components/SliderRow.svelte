<script lang="ts">
	let {
		label,
		value = $bindable(),
		min,
		max,
		step,
		format = (next: number) => String(next)
	} = $props<{
		label: string;
		value: number;
		min: number;
		max: number;
		step: number;
		format?: (next: number) => string;
	}>();

	const id = $derived(`slider-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
</script>

<label class="row" for={id}>
	<span>{label}</span>
	<span class="value">{format(value)}</span>
</label>
<input {id} type="range" bind:value {min} {max} {step} />
