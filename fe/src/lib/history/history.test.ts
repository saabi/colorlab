import { describe, expect, it, vi } from 'vitest';
import { createAppState } from '$lib/engine/state.svelte';
import { createHistory } from './history.svelte';

describe('history', () => {
	it('captures, undoes, and redoes snapshots', () => {
		const state = createAppState();
		const history = createHistory(() => state);

		state.explorer.gamut = 'p3';
		history.capture('Change gamut');

		expect(history.canUndo).toBe(true);
		expect(history.undoLabel).toBe('Change gamut');

		history.undo();
		expect(state.explorer.gamut).toBe('srgb');
		expect(history.canRedo).toBe(true);

		history.redo();
		expect(state.explorer.gamut).toBe('p3');
	});

	it('clears redo after a new capture', () => {
		const state = createAppState();
		const history = createHistory(() => state);

		state.explorer.gamut = 'p3';
		history.capture('Change gamut');
		history.undo();

		state.explorer.spaceMode = 1;
		history.capture('Change world space');

		expect(history.canRedo).toBe(false);
		expect(history.undoLabel).toBe('Change world space');
	});

	it('groups pending edits and lets undo flush them immediately', () => {
		vi.useFakeTimers();
		const state = createAppState();
		const history = createHistory(() => state);

		state.explorer.off = 0.7;
		history.scheduleCapture('Change slice offset', 500);

		expect(history.canUndo).toBe(true);
		history.undo();

		expect(state.explorer.off).toBe(0.5);
		vi.useRealTimers();
	});

	it('hintLabel overrides the generic scheduleCapture label, and is one-shot', () => {
		vi.useFakeTimers();
		const state = createAppState();
		const history = createHistory(() => state);

		// A discrete action hints its label before mutating; the generic observer
		// then schedules with its default — the hint must win.
		history.hintLabel('Add point');
		state.explorer.off = 0.7;
		history.scheduleCapture('Edit parameters', 500);
		vi.advanceTimersByTime(500);
		expect(history.undoLabel).toBe('Add point');

		// The hint is consumed: the next generic change keeps the generic label.
		state.explorer.off = 0.8;
		history.scheduleCapture('Edit parameters', 500);
		vi.advanceTimersByTime(500);
		expect(history.undoLabel).toBe('Edit parameters');
		vi.useRealTimers();
	});

	it('resets stacks at document boundaries', () => {
		const state = createAppState();
		const history = createHistory(() => state);

		state.explorer.gamut = 'p3';
		history.capture('Change gamut');
		expect(history.canUndo).toBe(true);

		history.reset();
		expect(history.canUndo).toBe(false);
		expect(history.canRedo).toBe(false);
	});

	it('enforces max depth', () => {
		const state = createAppState();
		const history = createHistory(() => state, { maxEntries: 2 });

		state.explorer.off = 0.1;
		history.capture('one');
		state.explorer.off = 0.2;
		history.capture('two');
		state.explorer.off = 0.3;
		history.capture('three');

		history.undo();
		expect(state.explorer.off).toBe(0.2);
		history.undo();
		expect(state.explorer.off).toBe(0.1);
		expect(history.canUndo).toBe(false);
	});
});
