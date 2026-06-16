import { describe, expect, it } from 'vitest';

import {
	clampActiveListIndex,
	formatListChipLabel,
	formatListsSummary,
	formatRampBuilderStatus,
	formatSourcesStatus,
	pipelinesDiffer
} from './ramp-list-ui';
import { defaultPipeline } from './state.svelte';

import type { ThemeSlice } from './ramp-list-ui';
import type { RampList } from './types';

function anchor() {
	return { srgbLin: [0.5, 0.5, 0.5] as [number, number, number] };
}

function list(anchors: number, pipelineOverrides: Partial<RampList['pipeline']> = {}): RampList {
	return {
		anchors: Array.from({ length: anchors }, anchor),
		pipeline: { ...defaultPipeline(), ...pipelineOverrides }
	};
}

function theme(overrides: Partial<ThemeSlice> & { lists?: RampList[] } = {}): ThemeSlice {
	const lists = overrides.lists ?? [list(0)];
	const { lists: _l, ...rest } = overrides;
	return {
		activeList: 0,
		selectedPoint: null,
		gamutMap: 'none',
		gamutMapParams: { focusL: 0.5, alpha: 0.5 },
		lists,
		curves: [],
		rawRows: [],
		rows: [],
		splineCurve: [],
		rawStops: [],
		arm: null,
		stops: [],
		showPoints: true,
		showCurve: true,
		showStops: true,
		showPalette: false,
		grid: [],
		...rest
	};
}

describe('clampActiveListIndex', () => {
	it('clamps out-of-range activeList', () => {
		expect(clampActiveListIndex(theme({ lists: [list(1), list(2)], activeList: 99 }))).toBe(1);
		expect(clampActiveListIndex(theme({ lists: [list(1)], activeList: -1 }))).toBe(0);
	});
});

describe('formatRampBuilderStatus', () => {
	it('single list shows List 1', () => {
		expect(formatRampBuilderStatus(theme({ lists: [list(4)] }))).toBe('List 1');
	});

	it('multiple lists uses of phrasing', () => {
		expect(
			formatRampBuilderStatus(theme({ lists: [list(1), list(2), list(3), list(0)], activeList: 1 }))
		).toBe('List 2 of 4');
	});

	it('appends mixed when pipelines differ', () => {
		const lists = [list(1), list(2, { mode: 'linear' })];
		expect(formatRampBuilderStatus(theme({ lists, activeList: 0 }))).toBe('List 1 of 2 · mixed');
	});

	it('does not include point counts', () => {
		expect(formatRampBuilderStatus(theme({ lists: [list(12)] }))).not.toMatch(/pt|point/i);
	});
});

describe('formatSourcesStatus', () => {
	it('describes active list point count only', () => {
		const lists = [list(4), list(8)];
		expect(formatSourcesStatus(theme({ lists, activeList: 0 }))).toBe('4 points');
		expect(formatSourcesStatus(theme({ lists, activeList: 1 }))).toBe('8 points');
	});

	it('handles empty and singular', () => {
		expect(formatSourcesStatus(theme({ lists: [list(0)] }))).toBe('No points');
		expect(formatSourcesStatus(theme({ lists: [list(1)] }))).toBe('1 point');
	});

	it('never mentions global list totals', () => {
		const lists = [list(2), list(3)];
		expect(formatSourcesStatus(theme({ lists, activeList: 0 }))).not.toMatch(/lists/i);
	});

	it('includes selected point when set', () => {
		expect(formatSourcesStatus(theme({ lists: [list(4)], selectedPoint: 1 }))).toBe(
			'4 points · point 2 selected'
		);
	});
});

describe('formatListChipLabel', () => {
	it('shows empty lists', () => {
		expect(formatListChipLabel(list(0), 1)).toBe('2 · empty');
	});

	it('shows point counts', () => {
		expect(formatListChipLabel(list(3), 0)).toBe('1 · 3 pts');
		expect(formatListChipLabel(list(1), 2)).toBe('3 · 1 pt');
	});
});

describe('formatListsSummary', () => {
	it('returns null for single list', () => {
		expect(formatListsSummary(theme({ lists: [list(3)] }))).toBeNull();
	});

	it('sums points across lists', () => {
		expect(formatListsSummary(theme({ lists: [list(3), list(0), list(5)] }))).toBe(
			'3 lists · 8 points total'
		);
	});
});

describe('pipelinesDiffer', () => {
	it('false for single list', () => {
		expect(pipelinesDiffer(theme({ lists: [list(1)] }))).toBe(false);
	});

	it('false when all pipelines match', () => {
		expect(pipelinesDiffer(theme({ lists: [list(1), list(2)] }))).toBe(false);
	});

	it('true when a non-active list differs', () => {
		const lists = [list(1), list(2, { interpolateOn: false })];
		expect(pipelinesDiffer(theme({ lists, activeList: 0 }))).toBe(true);
	});
});
