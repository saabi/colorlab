<script lang="ts">
	import { browser } from '$app/environment';
	import '../app.css';
	import '$lib/a11y/a11y.css';
	import { injectUmami } from '$lib/analytics/umami';

	let { children, data } = $props();
	const meta = $derived(data.meta);

	$effect(() => {
		if (browser) injectUmami();
	});
</script>

<svelte:head>
	<title>{meta.title}</title>
	<meta name="description" content={meta.description} />
	<link rel="canonical" href={meta.siteUrl} />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content="#0a0a0b" />
	<link rel="icon" href="/favicon.ico" sizes="any" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="COLOR LAB" />
	<meta property="og:title" content={meta.title} />
	<meta property="og:description" content={meta.description} />
	<meta property="og:url" content={meta.siteUrl} />
	<meta property="og:image" content={meta.imageUrl} />
	<meta property="og:image:secure_url" content={meta.imageUrl} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content={meta.imageWidth} />
	<meta property="og:image:height" content={meta.imageHeight} />
	<meta property="og:image:alt" content="COLOR LAB gamut explorer interface" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={meta.title} />
	<meta name="twitter:description" content={meta.description} />
	<meta name="twitter:image" content={meta.imageUrl} />
</svelte:head>

{@render children()}
