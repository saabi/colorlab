import { track } from '$lib/analytics/umami';
import { applySnapshot, cloneSnapshot, snapshotsEqual, toSnapshot } from '$lib/documents/snapshot';

import type { AppState } from '$lib/engine/types';
import type { ParameterSnapshot } from '$lib/documents/types';

type HistoryEntry = {
	snapshot: ParameterSnapshot;
	label: string | null;
	timestamp: number;
};

type HistoryOptions = {
	maxEntries?: number;
	onApply?: () => void;
};

const DEFAULT_MAX_ENTRIES = 100;

export function createHistory(getAppState: () => AppState, options: HistoryOptions = {}) {
	const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
	let past = $state<HistoryEntry[]>([]);
	let current = $state<ParameterSnapshot>(toSnapshot(getAppState()));
	let future = $state<HistoryEntry[]>([]);
	let transactionBase: ParameterSnapshot | null = null;
	let transactionLabel: string | null = null;
	let pendingTimer: ReturnType<typeof setTimeout> | null = null;
	let pendingLabel: string | null = null;
	let hasPending = $state(false);

	const canUndo = $derived(past.length > 0 || hasPending);
	const canRedo = $derived(future.length > 0);
	const undoLabel = $derived(past[past.length - 1]?.label ?? null);
	const redoLabel = $derived(future[future.length - 1]?.label ?? null);

	function entry(snapshot: ParameterSnapshot, label?: string | null): HistoryEntry {
		return { snapshot: cloneSnapshot(snapshot), label: label ?? null, timestamp: Date.now() };
	}

	function trim(entries: HistoryEntry[]) {
		return entries.length > maxEntries ? entries.slice(entries.length - maxEntries) : entries;
	}

	function reset(snapshot = toSnapshot(getAppState())) {
		if (pendingTimer) clearTimeout(pendingTimer);
		current = cloneSnapshot(snapshot);
		past = [];
		future = [];
		transactionBase = null;
		transactionLabel = null;
		pendingTimer = null;
		pendingLabel = null;
		hasPending = false;
	}

	function capture(label?: string) {
		if (pendingTimer) clearTimeout(pendingTimer);
		pendingTimer = null;
		pendingLabel = null;
		hasPending = false;
		const next = toSnapshot(getAppState());
		if (snapshotsEqual(next, current)) return;
		past = trim([...past, entry(current, label)]);
		current = cloneSnapshot(next);
		future = [];
		transactionBase = null;
		transactionLabel = null;
	}

	function matchesCurrent(snapshot = toSnapshot(getAppState())) {
		return snapshotsEqual(snapshot, current);
	}

	function scheduleCapture(label = 'Edit parameters', delayMs = 350) {
		if (matchesCurrent()) return;
		pendingLabel = label;
		hasPending = true;
		if (pendingTimer) clearTimeout(pendingTimer);
		pendingTimer = setTimeout(() => capture(pendingLabel ?? label), delayMs);
	}

	function flushPending() {
		if (!pendingTimer) return;
		const label = pendingLabel ?? undefined;
		clearTimeout(pendingTimer);
		pendingTimer = null;
		pendingLabel = null;
		hasPending = false;
		capture(label);
	}

	function begin(label?: string) {
		if (transactionBase) return;
		transactionBase = cloneSnapshot(current);
		transactionLabel = label ?? null;
	}

	function commit(label?: string) {
		const finalLabel = label ?? transactionLabel ?? undefined;
		transactionBase = null;
		transactionLabel = null;
		capture(finalLabel);
	}

	function cancel() {
		if (!transactionBase) return;
		applySnapshot(getAppState(), transactionBase);
		current = cloneSnapshot(transactionBase);
		transactionBase = null;
		transactionLabel = null;
		options.onApply?.();
	}

	function undo() {
		flushPending();
		if (!past.length) return;
		const previous = past[past.length - 1];
		future = [...future, entry(current, previous.label)];
		past = past.slice(0, -1);
		current = cloneSnapshot(previous.snapshot);
		transactionBase = null;
		transactionLabel = null;
		applySnapshot(getAppState(), current);
		options.onApply?.();
		track('history_undo', { label: previous.label ?? 'unknown' });
	}

	function redo() {
		flushPending();
		if (!future.length) return;
		const next = future[future.length - 1];
		past = trim([...past, entry(current, next.label)]);
		future = future.slice(0, -1);
		current = cloneSnapshot(next.snapshot);
		transactionBase = null;
		transactionLabel = null;
		applySnapshot(getAppState(), current);
		options.onApply?.();
		track('history_redo', { label: next.label ?? 'unknown' });
	}

	return {
		get canUndo() {
			return canUndo;
		},
		get canRedo() {
			return canRedo;
		},
		get undoLabel() {
			return undoLabel;
		},
		get redoLabel() {
			return redoLabel;
		},
		capture,
		scheduleCapture,
		flushPending,
		matchesCurrent,
		begin,
		commit,
		cancel,
		undo,
		redo,
		reset
	};
}

export type HistoryController = ReturnType<typeof createHistory>;
