import { getContext, setContext } from 'svelte';

import type { HistoryController } from './history.svelte';

const HISTORY_CONTEXT = Symbol('colorlab:history');

export function setHistoryContext(history: HistoryController) {
	setContext(HISTORY_CONTEXT, history);
}

export function getHistoryContext() {
	return getContext<HistoryController | null>(HISTORY_CONTEXT) ?? null;
}
