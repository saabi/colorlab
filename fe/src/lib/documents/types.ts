import type { Camera } from '$lib/engine/camera';
import type { ExplorerState } from '$lib/engine/types';

export const CURRENT_SNAPSHOT_VERSION = 1 as const;
export type SnapshotSchemaVersion = typeof CURRENT_SNAPSHOT_VERSION;

export type PersistedTheme = Omit<ExplorerState['theme'], 'arm' | 'stops'>;
export type PersistedExplorer = Omit<ExplorerState, 'hover' | 'theme'> & { theme: PersistedTheme };

export interface ParameterSnapshot {
	schemaVersion: SnapshotSchemaVersion;
	explorer: PersistedExplorer;
	camera: Camera;
}

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
