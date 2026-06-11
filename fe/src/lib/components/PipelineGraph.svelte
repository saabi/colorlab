<script lang="ts">
	import { tick } from 'svelte';
	import { PIPELINE_NODES, isNodeEnabled, type PipelineLane, type PipelineNodeId } from './pipeline-nodes';
	import { track } from '$lib/analytics/umami';
	import type { ExplorerState } from '$lib/engine/types';

	let {
		state: explorer,
		selectedNode = $bindable('all')
	} = $props<{
		state: ExplorerState;
		selectedNode: PipelineNodeId;
	}>();

	const lanes: PipelineLane[] = ['Explorer', 'Ramp', 'Support'];
	let navEl: HTMLElement;

	// "What changed?" feedback: pulse a node when its status value changes.
	const statuses = $derived(PIPELINE_NODES.map((node) => node.status(explorer)));
	let pulsing = $state(new Set<PipelineNodeId>());
	let prevStatuses: string[] = [];

	function pulseNode(id: PipelineNodeId) {
		pulsing.add(id);
		pulsing = new Set(pulsing);
		setTimeout(() => {
			pulsing.delete(id);
			pulsing = new Set(pulsing);
		}, 650);
	}

	$effect(() => {
		const current = statuses;
		if (prevStatuses.length) {
			PIPELINE_NODES.forEach((node, i) => {
				if (current[i] !== prevStatuses[i]) pulseNode(node.id);
			});
		}
		prevStatuses = [...current];
	});

	function selectNode(id: PipelineNodeId, lane: PipelineLane) {
		selectedNode = id;
		track('pipeline_node_select', { node: id, lane });
	}

	async function focusTab(id: PipelineNodeId) {
		await tick();
		navEl?.querySelector<HTMLElement>(`#pipeline-tab-${id}`)?.focus();
	}

	// Roving-tabindex tab navigation with selection following focus (automatic activation).
	function onKeydown(event: KeyboardEvent) {
		const handled = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
		if (!handled.includes(event.key)) return;
		event.preventDefault();
		const last = PIPELINE_NODES.length - 1;
		const idx = Math.max(0, PIPELINE_NODES.findIndex((node) => node.id === selectedNode));
		let next = idx;
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = idx >= last ? 0 : idx + 1;
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = idx <= 0 ? last : idx - 1;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = last;
		const node = PIPELINE_NODES[next];
		selectNode(node.id, node.lane);
		focusTab(node.id);
	}
</script>

<!-- Roving tabindex lives on the tabs (WAI tabs pattern); the tablist itself is not a tab stop. -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
	class="pipeline-graph"
	role="tablist"
	aria-label="Pipeline stages"
	bind:this={navEl}
	onkeydown={onKeydown}
>
	{#each lanes as lane}
		<section class="pipeline-lane" role="presentation">
			<div class="pipeline-lane-label" aria-hidden="true">{lane}</div>
			<div class="pipeline-node-row" role="presentation">
				{#each PIPELINE_NODES.filter((node) => node.lane === lane) as node}
					{@const enabled = isNodeEnabled(node, explorer)}
					{@const warn = node.warn?.(explorer) ?? null}
					<button
						type="button"
						role="tab"
						id={`pipeline-tab-${node.id}`}
						class="pipeline-node"
						class:active={selectedNode === node.id}
						class:disabled={!enabled}
						class:pulse={pulsing.has(node.id)}
						aria-selected={selectedNode === node.id}
						aria-controls="pipeline-panel"
						tabindex={selectedNode === node.id ? 0 : -1}
						title={enabled ? node.description : `${node.description} (pick a source color first)`}
						aria-label={`${node.label}, ${node.lane} lane, affects ${node.affects}${warn ? `, ${warn}` : ''}${enabled ? '' : ', unavailable until a source color is picked'}`}
						onclick={() => selectNode(node.id, lane)}
					>
						<span class="pipeline-node-main" aria-hidden="true">
							<span class="pipeline-node-label">{node.shortLabel}</span>
							<span class="pipeline-node-scope">{node.affects}</span>
						</span>
						<span class="pipeline-node-footer" aria-hidden="true">
							<span class="pipeline-node-status">{node.status(explorer)}</span>
							{#if warn}<span class="pipeline-node-warn">{warn}</span>{/if}
						</span>
					</button>
				{/each}
			</div>
		</section>
	{/each}
</div>
