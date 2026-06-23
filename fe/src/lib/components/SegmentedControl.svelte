<script module lang="ts">
	// ===== TYPES =====
	interface Props<T extends string> {
		value: T;
		options: Array<{ value: T; label: string }>;
		columns?: number;
		onchange?: (value: T) => void;
	}
</script>

<script lang="ts" generics="T extends string">
	// ===== PROPS =====
	let {
		value = $bindable(),
		options,
		columns = options.length,
		onchange
	}: Props<T> = $props();
</script>

<div class="segmented" style={`--segments: ${columns}`}>
	{#each options as option}
		<button
			type="button"
			class:active={value === option.value}
			onclick={() => {
				value = option.value;
				onchange?.(option.value);
			}}
		>
			{option.label}
		</button>
	{/each}
</div>
