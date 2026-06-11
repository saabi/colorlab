import type { ExplorerState } from '$lib/engine/types';

export type PipelineNodeId =
	| 'all'
	| 'gamut'
	| 'world'
	| 'clip'
	| 'cvd'
	| 'display'
	| 'pick'
	| 'points'
	| 'interpolate'
	| 'adjust'
	| 'gamut-map'
	| 'export'
	| 'view'
	| 'performance';

export type PipelineLane = 'Explorer' | 'Ramp' | 'Support';

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

const spaceLabels: Record<ExplorerState['spaceMode'], string> = {
	0: 'RGB',
	1: 'XYZ',
	2: 'CIELAB',
	3: 'Oklab',
	5: 'Luma'
};

/** True once the ramp has at least one source color (anchor or control point). */
export function hasRampSource(state: ExplorerState): boolean {
	const t = state.theme;
	return t.A !== null || t.B !== null || t.controlPoints.length > 0;
}

/** Whether a node's controls are meaningful given the current state. */
export function isNodeEnabled(node: PipelineNode, state: ExplorerState): boolean {
	return node.requiresSource ? hasRampSource(state) : true;
}

export const PIPELINE_NODES: PipelineNode[] = [
	{
		id: 'all',
		lane: 'Support',
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
		description: 'Input primaries and transfer assumptions for the active color solid.',
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
		id: 'clip',
		lane: 'Explorer',
		label: 'Clip / cut',
		shortLabel: 'Clip',
		description: 'Controls the visible slice and cylindrical cutaway geometry.',
		affects: 'Viewport',
		status: (state) => [state.slice ? 'Slice' : null, state.cylSlice ? 'Cylinder' : null].filter(Boolean).join(' + ') || 'Off'
	},
	{
		id: 'cvd',
		lane: 'Explorer',
		label: 'Vision',
		shortLabel: 'Vision',
		description: 'Applies color-vision-deficiency simulation to displayed colors only.',
		affects: 'Display only',
		status: (state) => (state.cvd === 'none' ? 'Normal' : `${state.cvd} ${state.cvdSev.toFixed(2)}`)
	},
	{
		id: 'display',
		lane: 'Explorer',
		label: 'Display',
		shortLabel: 'Display',
		description: 'Viewport display aids and monitor assumptions.',
		affects: 'Display only',
		status: (state) => (state.shell === 'none' ? 'sRGB' : `Shell ${state.shell}`)
	},
	{
		id: 'pick',
		lane: 'Ramp',
		label: 'Pick',
		shortLabel: 'Pick',
		description: 'Bridge from visible color solid to ramp anchors and control points.',
		affects: 'Ramp',
		status: (state) => state.theme.arm ?? 'Idle'
	},
	{
		id: 'points',
		lane: 'Ramp',
		label: 'Anchors / points',
		shortLabel: 'Points',
		description: 'Editable source anchors and spline control points for ramp generation.',
		affects: 'Ramp',
		requiresSource: true,
		status: (state) => (state.theme.mode === 'spline' ? `${state.theme.controlPoints.length} pts` : `${state.theme.A ? 'A' : '-'}${state.theme.B ? 'B' : '-'}`)
	},
	{
		id: 'interpolate',
		lane: 'Ramp',
		label: 'Interpolate',
		shortLabel: 'Interp',
		description: 'Builds raw ramp paths from anchors or spline points.',
		affects: 'Ramp',
		requiresSource: true,
		status: (state) => (state.theme.mode === 'spline' ? `Spline ${state.theme.splineSpace}` : state.theme.mode),
		// Interpolation can produce out-of-gamut stops; the count is taken before the gamut-map stage.
		warn: (state) => {
			const n = oogCount(state.theme.rawStops);
			return n ? `${n} OOG` : null;
		}
	},
	{
		id: 'adjust',
		lane: 'Ramp',
		label: 'Adjust',
		shortLabel: 'Adjust',
		description: 'Post-processes ramp stops for contrast or perceptual spacing.',
		affects: 'Ramp',
		requiresSource: true,
		status: (state) => `${state.theme.aa.toFixed(1)}:1`
	},
	{
		id: 'gamut-map',
		lane: 'Ramp',
		label: 'Gamut map',
		shortLabel: 'Map',
		description: 'Terminal ramp-only policy for out-of-gamut generated stops.',
		affects: 'Export',
		requiresSource: true,
		status: (state) => state.theme.gamutMap,
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
	},
	{
		id: 'view',
		lane: 'Support',
		label: 'View',
		shortLabel: 'View',
		description: 'Camera, gestures, and direct manipulation shortcuts.',
		affects: 'View only',
		status: () => 'Camera'
	},
	{
		id: 'performance',
		lane: 'Support',
		label: 'Performance',
		shortLabel: 'Perf',
		description: 'Rendering density and automatic tessellation adjustment.',
		affects: 'View only',
		status: (state) => `${state.N}${state.autoPerformance ? ` / ${state.minAverageFps}fps` : ''}`
	}
];

export function getPipelineNode(id: PipelineNodeId) {
	return PIPELINE_NODES.find((node) => node.id === id) ?? PIPELINE_NODES[0];
}
