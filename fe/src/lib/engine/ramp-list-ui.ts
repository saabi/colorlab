import type { ExplorerState, RampList } from './types';

export type ThemeSlice = ExplorerState['theme'];

/** Bounds-check activeList against current lists length. */
export function clampActiveListIndex(theme: ThemeSlice): number {
	const lists = theme.lists;
	if (lists.length === 0) return 0;
	return Math.min(Math.max(theme.activeList, 0), lists.length - 1);
}

/** True when any non-active list has different pipeline settings than the active list. */
export function pipelinesDiffer(theme: ThemeSlice): boolean {
	if (theme.lists.length <= 1) return false;
	const activeIdx = clampActiveListIndex(theme);
	const activeJson = JSON.stringify(theme.lists[activeIdx]?.pipeline ?? {});
	return theme.lists.some((list, i) => i !== activeIdx && JSON.stringify(list.pipeline) !== activeJson);
}

/** Step 1 Ramp Builder header — active list identity only. */
export function formatRampBuilderStatus(theme: ThemeSlice): string {
	const lists = theme.lists;
	const active = clampActiveListIndex(theme);
	const n = lists.length;
	let status = n <= 1 ? 'List 1' : `List ${active + 1} of ${n}`;
	if (pipelinesDiffer(theme)) status += ' · mixed';
	return status;
}

/** Step 1.1 Source colors header — active list point count only. */
export function formatSourcesStatus(theme: ThemeSlice): string {
	const active = clampActiveListIndex(theme);
	const pts = theme.lists[active]?.anchors.length ?? 0;
	let status: string;
	if (pts === 0) status = 'No points';
	else if (pts === 1) status = '1 point';
	else status = `${pts} points`;

	if (theme.selectedPoint !== null && theme.selectedPoint >= 0) {
		status += ` · point ${theme.selectedPoint + 1} selected`;
	}
	return status;
}

/** List chip label — per-list identity and local point count. */
export function formatListChipLabel(list: RampList, index: number): string {
	const n = index + 1;
	const pts = list.anchors.length;
	if (pts === 0) return `${n} · empty`;
	return `${n} · ${pts} pt${pts === 1 ? '' : 's'}`;
}

/** Global list inventory summary for the list manager row; null when single list. */
export function formatListsSummary(theme: ThemeSlice): string | null {
	if (theme.lists.length <= 1) return null;
	const totalPts = theme.lists.reduce((sum, list) => sum + list.anchors.length, 0);
	const n = theme.lists.length;
	return `${n} lists · ${totalPts} point${totalPts === 1 ? '' : 's'} total`;
}
