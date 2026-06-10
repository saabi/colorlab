import { defaultSnapshot, mergeSnapshot } from './snapshot';

import type { Camera } from '$lib/engine/camera';
import type { ExampleDocument, ParameterSnapshot } from './types';

export const EXAMPLE_ID_PREFIX = 'example:';

export function isExampleId(id: string) {
	return id.startsWith(EXAMPLE_ID_PREFIX);
}

export function createExampleSnapshot(partial: {
	explorer?: Partial<ParameterSnapshot['explorer']> & {
		theme?: Partial<ParameterSnapshot['explorer']['theme']>;
	};
	camera?: Partial<Camera>;
}): ParameterSnapshot {
	return mergeSnapshot(defaultSnapshot(), partial);
}

export const EXAMPLE_DOCUMENTS: ExampleDocument[] = [
	{
		id: 'example:oklab-l-slice',
		name: 'Oklab L-slice',
		source: 'example',
		snapshot: createExampleSnapshot({
			explorer: {
				spaceMode: 3,
				slice: true,
				planeMode: 'L',
				off: 0.55
			},
			camera: { yaw: 0.9, pitch: 0.35 }
		})
	},
	{
		id: 'example:p3-shell',
		name: 'Display P3 + shell',
		source: 'example',
		snapshot: createExampleSnapshot({
			explorer: {
				gamut: 'p3',
				shell: 'p3',
				cylSlice: true,
				cylRad: 0.35
			},
			camera: { dist: 3.2 }
		})
	}
];

export function listExampleDocuments(): ExampleDocument[] {
	return EXAMPLE_DOCUMENTS;
}

export function getExampleDocument(id: string): ExampleDocument | null {
	return EXAMPLE_DOCUMENTS.find((doc) => doc.id === id) ?? null;
}
