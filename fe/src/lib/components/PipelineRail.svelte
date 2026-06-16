<script lang="ts">
	import { PIPELINE_NODES, isNodeEnabled, type PipelineLane, type PipelineNodeId } from './pipeline-nodes';

	import type { ExplorerState } from '$lib/engine/types';

	let { explorer, openIds, onSelect } = $props<{
		explorer: ExplorerState;
		/** Step ids currently expanded in the sidebar (highlighted on the rail). */
		openIds: string[];
		onSelect: (id: PipelineNodeId) => void;
	}>();

	const LANES: readonly PipelineLane[] = ['Explorer', 'Ramp'];
	// Aggregate/container nodes are not navigation targets.
	const HIDDEN: readonly PipelineNodeId[] = ['all', 'ramp-builder'];
	const laneNodes = (lane: PipelineLane) =>
		PIPELINE_NODES.filter((n) => n.lane === lane && !HIDDEN.includes(n.id));
</script>

<!-- Read-only pipeline map + status dashboard. Clicking a step opens and scrolls
     to its controls below; it does not own any parameters. -->
<nav class="pipeline-rail" aria-label="Pipeline steps">
	{#each LANES as lane}
		<div class="rail-lane">
			<span class="rail-lane-name">{lane}</span>
			<div class="rail-nodes">
				{#each laneNodes(lane) as node (node.id)}
					{@const status = node.status(explorer)}
					{@const disabled = !isNodeEnabled(node, explorer)}
					{@const warn = node.warn?.(explorer) ?? null}
					<button
						type="button"
						class="rail-node"
						class:open={openIds.includes(node.id)}
						{disabled}
						title={`${node.label} — ${status} · affects ${node.affects}`}
						aria-label={`${node.label}: ${status}`}
						onclick={() => onSelect(node.id)}
					>
						<span class="rail-node-label">{node.shortLabel}</span>
						<span class="rail-node-status">{status}</span>
						{#if warn}<span class="rail-node-warn" title="Out of gamut">{warn}</span>{/if}
					</button>
				{/each}
			</div>
		</div>
	{/each}
</nav>

<style>
	.pipeline-rail {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 10px;
		padding: 8px;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--panel2);
	}

	.rail-lane {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.rail-lane-name {
		color: var(--dim);
		font-size: 0.692rem;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.rail-nodes {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.rail-node {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
		width: auto;
		min-width: 0;
		padding: 3px 7px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--panel);
		color: var(--txt);
		font-size: 0.769rem;
		line-height: 1.2;
		cursor: pointer;
	}

	.rail-node:not(:disabled):hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.rail-node.open {
		border-color: var(--accent);
	}

	.rail-node:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.rail-node-label {
		font-weight: 600;
	}

	.rail-node-status {
		color: var(--dim);
		font-variant-numeric: tabular-nums;
		max-width: 9ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rail-node-warn {
		color: var(--warn);
		font-weight: 700;
	}
</style>
