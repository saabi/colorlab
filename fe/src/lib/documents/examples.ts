import { EXAMPLE_ID_PREFIX, EXAMPLE_STATES, isExampleId } from '$lib/engine/state.svelte';
import { toSnapshot } from './snapshot';

import type { ExampleDocument } from './types';

export { EXAMPLE_ID_PREFIX, isExampleId };

export const EXAMPLE_DOCUMENTS: ExampleDocument[] = EXAMPLE_STATES.map((doc) => ({
	...doc,
	snapshot: toSnapshot(doc.snapshot)
}));

export function listExampleDocuments(): ExampleDocument[] {
	return EXAMPLE_DOCUMENTS;
}

export function getExampleDocument(id: string): ExampleDocument | null {
	return EXAMPLE_DOCUMENTS.find((doc) => doc.id === id) ?? null;
}
