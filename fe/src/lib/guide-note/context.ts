import { getContext, setContext } from 'svelte';

const GUIDE_NOTE_CONTEXT_KEY = Symbol('guide-note');

export type GuideNoteContext = {
	openEditor: () => void;
};

export function setGuideNoteContext(context: GuideNoteContext) {
	setContext(GUIDE_NOTE_CONTEXT_KEY, context);
}

export function getGuideNoteContext(): GuideNoteContext | null {
	return getContext<GuideNoteContext | null>(GUIDE_NOTE_CONTEXT_KEY) ?? null;
}
