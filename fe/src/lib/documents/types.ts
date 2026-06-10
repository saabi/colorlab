import type { PersistedAppState, StateSchemaVersion } from '$lib/engine/types';
export { CURRENT_STATE_SCHEMA_VERSION as CURRENT_SNAPSHOT_VERSION } from '$lib/engine/types';

export type SnapshotSchemaVersion = StateSchemaVersion;
export type ParameterSnapshot = PersistedAppState;

export type DocumentSource = 'user' | 'example';

export interface DocumentDescriptor {
	id: string;
	name: string;
	source: DocumentSource;
	updatedAt?: number;
}

export interface StoredDocument extends DocumentDescriptor {
	source: 'user';
	updatedAt: number;
	snapshot: ParameterSnapshot;
}

export interface ExampleDocument extends DocumentDescriptor {
	source: 'example';
	snapshot: ParameterSnapshot;
}

export interface DocumentRegistry {
	version: 1;
	documents: StoredDocument[];
}

export interface SessionState {
	lastDocumentId: string | null;
}

export type ResolvedDocument = StoredDocument | ExampleDocument;
