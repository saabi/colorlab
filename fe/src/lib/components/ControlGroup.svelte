<script lang="ts">
	let { title, children } = $props<{
		title: string;
		children: import('svelte').Snippet;
	}>();
</script>

<section class="group">
	<h2>{title}</h2>
	{@render children()}
</section>
