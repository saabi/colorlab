<script module lang="ts">
	// ===== IMPORTS =====
	import PanelHelp from './PanelHelp.svelte';
	import type { InspectorPanelId } from '$lib/inspector/help-copy';

	// ===== TYPES =====
	interface Props {
		label: string;
		panelId: InspectorPanelId;
		meta?: string;
		openHelp?: string | null;
	}
</script>

<script lang="ts">
	// ===== PROPS =====
	let {
		label,
		panelId,
		meta = '',
		openHelp = $bindable(null as string | null)
	}: Props = $props();
</script>

<div class="panel-header">
	<span class="panel-label">{label}</span>
	<div class="panel-header-end">
		{#if meta}
			<span class="panel-meta">{meta}</span>
		{/if}
		<PanelHelp helpId={panelId} bind:openHelp />
	</div>
</div>
