import { activePipeline } from '$lib/engine/theme';
import {
	formatRampBuilderStatus,
	formatSourcesStatus
} from '$lib/engine/ramp-list-ui';

import type { ExplorerState } from '$lib/engine/types';

export type PipelineNodeId =
	| 'all'
	| 'gamut'
	| 'world'
	| 'tessellation'
	| 'clip'
	| 'view'
	| 'cvd'
	| 'ramp-builder'
	| 'sources'
	| 'interpolate'
	| 'adjust'
	| 'expand'
	| 'gamut-map'
	| 'export';

export type PipelineLane = 'Explorer' | 'Ramp';

// What a stage actually affects — a single fixed vocabulary, distinct from the
// lane (workflow group). Never combine lane + affects into one badge string.
export type PipelineAffects = 'All' | 'Viewport' | 'Ramp' | 'Export' | 'Display only' | 'View only';

export type PipelineNode = {
	id: PipelineNodeId;
	lane: PipelineLane;
	label: string;
	shortLabel: string;
	description: string;
	affects: PipelineAffects;
	/** Ramp stages that have no meaning until a source color exists. */
	requiresSource?: boolean;
	status: (state: ExplorerState) => string;
	/** Optional warning chip (e.g. out-of-gamut count); null when nothing to warn. */
	warn?: (state: ExplorerState) => string | null;
};

const oogCount = (stops: ExplorerState['theme']['stops']) => stops.reduce((n, s) => (s.inG ? n : n + 1), 0);
const usesFocus = (method: string) => method === 'project-0.5' || method === 'adaptive-0.5';

const spaceLabels: Record<ExplorerState['spaceMode'], string> = {
	0: 'RGB',
	1: 'XYZ',
	2: 'CIELAB',
	3: 'Oklab',
	5: 'Luma'
};

/** True once any source list has at least one color (anchor or control point). */
export function hasRampSource(state: ExplorerState): boolean {
	return state.theme.lists.some((list) => list.anchors.length > 0);
}

/** Whether a node's controls are meaningful given the current state. */
export function isNodeEnabled(node: PipelineNode, state: ExplorerState): boolean {
	return node.requiresSource ? hasRampSource(state) : true;
}

export const PIPELINE_NODES: PipelineNode[] = [
	{
		id: 'all',
		lane: 'Explorer',
		label: 'All controls',
		shortLabel: 'All',
		description: 'Full parameter list in pipeline order — the primary surface for multi-step work.',
		affects: 'All',
		status: () => 'Full'
	},
	{
		id: 'gamut',
		lane: 'Explorer',
		label: 'Gamut',
		shortLabel: 'Gamut',
		description: 'Input primaries and transfer assumptions for the active color solid; reference-gamut shell overlay.',
		affects: 'Viewport',
		status: (state) => state.gamut.toUpperCase()
	},
	{
		id: 'world',
		lane: 'Explorer',
		label: 'World space',
		shortLabel: 'World',
		description: 'Maps color values into the 3D coordinate system.',
		affects: 'Viewport',
		status: (state) => spaceLabels[state.spaceMode]
	},
	{
		id: 'tessellation',
		lane: 'Explorer',
		label: 'Tessellation',
		shortLabel: 'Tess',
		description: 'Mesh resolution of the solid — also the accuracy of the clipped cross-section. Includes the surface grid.',
		affects: 'Viewport',
		status: (state) => `${state.N}`
	},
	{
		id: 'clip',
		lane: 'Explorer',
		label: 'Clip / cut',
		shortLabel: 'Clip',
		description: 'The visible slice and cylindrical cutaway geometry, plus its outlines.',
		affects: 'Viewport',
		status: (state) => [state.slice ? 'Slice' : null, state.cylSlice ? 'Cylinder' : null].filter(Boolean).join(' + ') || 'Off'
	},
	{
		id: 'view',
		lane: 'Explorer',
		label: 'View',
		shortLabel: 'View',
		description: 'Camera projection, floor grid, and direct-manipulation shortcuts.',
		affects: 'View only',
		status: () => 'Camera'
	},
	{
		id: 'cvd',
		lane: 'Explorer',
		label: 'Vision',
		shortLabel: 'Vision',
		description: 'Simulates how a color-deficient eye perceives the displayed image — the terminal preview stage.',
		affects: 'Display only',
		status: (state) => (state.cvd === 'none' ? 'Normal' : `${state.cvd} ${state.cvdSev.toFixed(2)}`)
	},
	{
		id: 'ramp-builder',
		lane: 'Ramp',
		label: 'Ramp Builder',
		shortLabel: 'Builder',
		description: 'Active source-list pipeline: source colors, interpolation, placement, and expansion settings owned by the selected list.',
		affects: 'Ramp',
		status: (state) => formatRampBuilderStatus(state.theme)
	},
	{
		id: 'sources',
		lane: 'Ramp',
		label: 'Source colors',
		shortLabel: 'Sources',
		description: 'Pick, list, and edit the ordered source colors the ramps are built from (one or more source lists).',
		affects: 'Ramp',
		status: (state) => formatSourcesStatus(state.theme)
	},
	{
		id: 'interpolate',
		lane: 'Ramp',
		label: 'Interpolate',
		shortLabel: 'Interp',
		description: 'Builds and optionally constrains the ramp path before any stop placement or output gamut mapping.',
		affects: 'Ramp',
		requiresSource: true,
		status: (state) => {
			const p = activePipeline(state.theme);
			if (!p.interpolateOn) return 'Off';
			const mode = p.mode === 'spline' ? 'Spline' : 'Linear';
			if (p.main.constraint === 'surface-oklab-project') {
				const focus = usesFocus(p.main.projection) ? ` L ${p.main.projectionParams.focusL.toFixed(2)}` : '';
				const alpha = p.main.projection.startsWith('adaptive-') ? ` α ${p.main.projectionParams.alpha.toFixed(2)}` : '';
				return `${mode} ${p.splineSpace}${focus}${alpha}`;
			}
			const constrained = p.main.constraint === 'free' ? '' : ' constrained';
			return `${mode} ${p.splineSpace}${constrained}`;
		},
		// Interpolation can produce out-of-gamut stops; the count is taken before the gamut-map stage.
		warn: (state) => {
			const n = oogCount(state.theme.rawStops);
			return n ? `${n} OOG` : null;
		}
	},
	{
		id: 'adjust',
		lane: 'Ramp',
		label: 'Place',
		shortLabel: 'Place',
		description: 'Samples the already-built path into N ramp stops; it does not change the path geometry.',
		affects: 'Ramp',
		requiresSource: true,
		status: (state) => {
			const p = activePipeline(state.theme);
			return !p.interpolateOn ? '—' : !p.placeOn ? 'Off' : p.place;
		}
	},
	{
		id: 'expand',
		lane: 'Ramp',
		label: 'Expand',
		shortLabel: 'Expand',
		description: 'Per-stop generator that turns the 1-D ramp into a 2-D palette (e.g. tints & shades).',
		affects: 'Export',
		requiresSource: true,
		status: (state) =>
			!activePipeline(state.theme).expandOn ? 'Off' : `${state.theme.grid.length}×${state.theme.grid[0]?.length ?? 0}`
	},
	{
		id: 'gamut-map',
		lane: 'Ramp',
		label: 'Gamut map',
		shortLabel: 'Map',
		description: 'Terminal ramp-only policy that brings generated stops into the sRGB export target after the path is built and sampled.',
		affects: 'Export',
		requiresSource: true,
		status: (state) =>
			`sRGB · ${state.theme.gamutMap}${usesFocus(state.theme.gamutMap) ? ` L ${state.theme.gamutMapParams.focusL.toFixed(2)}` : ''}${
				state.theme.gamutMap.startsWith('adaptive-') ? ` α ${state.theme.gamutMapParams.alpha.toFixed(2)}` : ''
			}`,
		// Stops still outside sRGB after the policy runs (only when policy is 'none').
		warn: (state) => {
			const n = oogCount(state.theme.stops);
			return n ? `${n} OOG` : null;
		}
	},
	{
		id: 'export',
		lane: 'Ramp',
		label: 'Export',
		shortLabel: 'Export',
		description: 'Serializes final ramp stops as CSS or DTCG tokens.',
		affects: 'Export',
		requiresSource: true,
		status: (state) => `${state.theme.stops.length} stops`
	}
];

export function getPipelineNode(id: PipelineNodeId) {
	return PIPELINE_NODES.find((node) => node.id === id) ?? PIPELINE_NODES[0];
}
