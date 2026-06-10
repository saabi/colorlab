<script lang="ts" generics="T extends string">
	let {
		value = $bindable(),
		options,
		columns = options.length
	} = $props<{
		value: T;
		options: Array<{ value: T; label: string }>;
		columns?: number;
	}>();
</script>

<div class="segmented" style={`--segments: ${columns}`}>
	{#each options as option}
		<button
			type="button"
			class:active={value === option.value}
			onclick={() => {
				value = option.value;
			}}
		>
			{option.label}
		</button>
	{/each}
</div>
