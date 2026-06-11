<script lang="ts">
	import { PIPELINE_NODES, isNodeEnabled, type PipelineLane, type PipelineNodeId } from './pipeline-nodes';
	import { track } from '$lib/analytics/umami';
	import type { ExplorerState } from '$lib/engine/types';

	let {
		state,
		selectedNode = $bindable('all')
	} = $props<{
		state: ExplorerState;
		selectedNode: PipelineNodeId;
	}>();

	const lanes: PipelineLane[] = ['Explorer', 'Ramp', 'Support'];

	function selectNode(id: PipelineNodeId, lane: PipelineLane) {
		selectedNode = id;
		track('pipeline_node_select', { node: id, lane });
	}
</script>

<nav class="pipeline-graph" aria-label="Pipeline controls">
	{#each lanes as lane}
		<section class="pipeline-lane" aria-label={`${lane} pipeline`}>
			<div class="pipeline-lane-label">{lane}</div>
			<div class="pipeline-node-row">
				{#each PIPELINE_NODES.filter((node) => node.lane === lane) as node}
					{@const enabled = isNodeEnabled(node, state)}
					<button
						type="button"
						class="pipeline-node"
						class:active={selectedNode === node.id}
						class:disabled={!enabled}
						aria-pressed={selectedNode === node.id}
						title={enabled ? node.description : `${node.description} (pick a source color first)`}
						onclick={() => selectNode(node.id, lane)}
					>
						<span class="pipeline-node-main">
							<span class="pipeline-node-label">{node.shortLabel}</span>
							<span class="pipeline-node-scope">{node.affects}</span>
						</span>
						<span class="pipeline-node-status">{node.status(state)}</span>
					</button>
				{/each}
			</div>
		</section>
	{/each}
</nav>
