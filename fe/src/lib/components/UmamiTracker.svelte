<script lang="ts">
	import { dev } from '$app/environment';
	import { env } from '$env/dynamic/public';

	const src = env.PUBLIC_UMAMI_SRC;
	const websiteId = env.PUBLIC_UMAMI_WEBSITE_ID;
	const enabled = !dev && !!src && !!websiteId;
</script>

<svelte:head>
	{#if enabled}
		<script
			defer
			src={src}
			data-website-id={websiteId}
			data-do-not-track="true"
			data-exclude-search="true"
			data-exclude-hash="true"
		></script>
	{/if}
</svelte:head>
