<script lang="ts">
	import PanelHelp from './PanelHelp.svelte';
	import type { InspectorPanelId } from '$lib/inspector/help-copy';

	let {
		label,
		panelId,
		meta = '',
		openHelp = $bindable(null as string | null)
	} = $props<{
		label: string;
		panelId: InspectorPanelId;
		meta?: string;
		openHelp?: string | null;
	}>();
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
