import {
	PRELUDE_STEPS,
	A_QUICK_STEPS,
	A_PIPELINE_STEPS,
	B_QUICK_STEPS,
	B_PIPELINE_STEPS,
	type TutorialStep
} from '$lib/inspector/tutorial-steps';
import type { ExplorerState } from './types';

export type { TutorialStep };

export type TrackId = 'a-quick' | 'a-pipeline' | 'b-quick' | 'b-pipeline';

export interface TutorialTrack {
	id: TrackId;
	label: string;
	durationMin: number;
	steps: TutorialStep[];
}

export interface TutorialProgress {
	trackId: TrackId;
	/** 0-based index into the full track steps array. */
	stepIndex: number;
	/** How many leading steps were skipped at start time (already satisfied). */
	skipCount: number;
	active: boolean;
}

export const TRACKS: Record<TrackId, TutorialTrack> = {
	'a-quick': {
		id: 'a-quick',
		label: 'A-quick',
		durationMin: 15,
		steps: [...PRELUDE_STEPS, ...A_QUICK_STEPS]
	},
	'a-pipeline': {
		id: 'a-pipeline',
		label: 'A-pipeline',
		durationMin: 25,
		steps: [...PRELUDE_STEPS, ...A_PIPELINE_STEPS]
	},
	'b-quick': {
		id: 'b-quick',
		label: 'B-quick',
		durationMin: 15,
		steps: [...PRELUDE_STEPS, ...B_QUICK_STEPS]
	},
	'b-pipeline': {
		id: 'b-pipeline',
		label: 'B-pipeline',
		durationMin: 30,
		steps: [...PRELUDE_STEPS, ...B_PIPELINE_STEPS]
	}
};

const STORAGE_KEY = 'colorlab:tutorial';

function loadFromSession(): TutorialProgress | null {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const p = JSON.parse(raw) as TutorialProgress;
		if (!p.trackId || typeof p.stepIndex !== 'number') return null;
		// backward compat: sessions saved before skipCount was added
		if (typeof p.skipCount !== 'number') p.skipCount = 0;
		return p;
	} catch {
		return null;
	}
}

function persist(p: TutorialProgress | null) {
	if (p) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
	else sessionStorage.removeItem(STORAGE_KEY);
}

export function createTutorialState(getExplorer: () => ExplorerState) {
	let progress = $state<TutorialProgress | null>(loadFromSession());

	const track = $derived(progress ? TRACKS[progress.trackId] : null);
	const step = $derived(track && progress ? (track.steps[progress.stepIndex] ?? null) : null);
	const skipCount = $derived(progress?.skipCount ?? 0);
	const total = $derived((track?.steps.length ?? 0) - skipCount);
	const isFirst = $derived(!!progress && progress.stepIndex === skipCount);
	const isLast = $derived(!!progress && track ? progress.stepIndex === track.steps.length - 1 : false);
	const displayIndex = $derived(progress ? progress.stepIndex - skipCount + 1 : 0);

	return {
		get progress() {
			return progress;
		},
		get track() {
			return track;
		},
		get step() {
			return step;
		},
		get total() {
			return total;
		},
		get isFirst() {
			return isFirst;
		},
		get isLast() {
			return isLast;
		},
		get displayIndex() {
			return displayIndex;
		},

		start(trackId: TrackId) {
			const explorer = getExplorer();
			const steps = TRACKS[trackId].steps;
			let sc = 0;
			for (const s of steps) {
				if (s.skip?.(explorer)) sc++;
				else break;
			}
			progress = { trackId, stepIndex: sc, skipCount: sc, active: true };
			persist(progress);
		},
		next() {
			if (!progress || !track || isLast) return;
			progress = { ...progress, stepIndex: progress.stepIndex + 1 };
			persist(progress);
		},
		back() {
			if (!progress || isFirst) return;
			progress = { ...progress, stepIndex: Math.max(progress.skipCount, progress.stepIndex - 1) };
			persist(progress);
		},
		stop() {
			if (progress) {
				progress = { ...progress, active: false };
				persist(progress);
			}
		},
		done() {
			progress = null;
			persist(null);
		},
		restart(trackId: TrackId) {
			const explorer = getExplorer();
			const steps = TRACKS[trackId].steps;
			let sc = 0;
			for (const s of steps) {
				if (s.skip?.(explorer)) sc++;
				else break;
			}
			progress = { trackId, stepIndex: sc, skipCount: sc, active: true };
			persist(progress);
		},
		resume() {
			if (progress) {
				progress = { ...progress, active: true };
				persist(progress);
			}
		}
	};
}

export type TutorialState = ReturnType<typeof createTutorialState>;
