import { getExampleDocument } from './examples';
import { parseSnapshot } from './parse';
import { coerceSnapshot } from './schema';

import type { DocumentRegistry, ResolvedDocument, SessionState, StoredDocument } from './types';

const REGISTRY_KEY = 'colorlab:documents:v1';
const SESSION_KEY = 'colorlab:session:v1';

function hasLocalStorage() {
	return typeof localStorage !== 'undefined';
}

function readRegistry(): DocumentRegistry {
	if (!hasLocalStorage()) return { version: 1, documents: [] };
	try {
		const raw = localStorage.getItem(REGISTRY_KEY);
		if (!raw) return { version: 1, documents: [] };
		const parsed = JSON.parse(raw) as Partial<DocumentRegistry>;
		if (!Array.isArray(parsed.documents)) return { version: 1, documents: [] };

		let migratedCount = 0;
		const documents = parsed.documents
			.map((doc) => {
				if (!doc || typeof doc !== 'object') return null;
				const id = typeof doc.id === 'string' ? doc.id : '';
				const name = typeof doc.name === 'string' ? doc.name : '';
				const updatedAt = typeof doc.updatedAt === 'number' ? doc.updatedAt : Date.now();
				const parsedSnapshot = parseSnapshot(doc.snapshot);
				if (parsedSnapshot.rejectReason === 'newer') {
					console.warn(`[documents] Skipping document "${name}" (${id}): newer schema.`);
					return null;
				}
				if (!id || !name || !parsedSnapshot.snapshot) {
					if (id || name) console.warn(`[documents] Skipping corrupt document "${name}" (${id}).`);
					return null;
				}
				if (parsedSnapshot.migrated) migratedCount += 1;
				return {
					id,
					name,
					source: 'user' as const,
					updatedAt,
					snapshot: parsedSnapshot.snapshot
				};
			})
			.filter((doc): doc is StoredDocument => doc !== null);

		const registry: DocumentRegistry = { version: 1, documents };
		if (migratedCount > 0) {
			console.warn(`[documents] Migrated ${migratedCount} parameter set(s) to current schema.`);
			writeRegistry(registry);
		}
		return registry;
	} catch {
		return { version: 1, documents: [] };
	}
}

function writeRegistry(registry: DocumentRegistry) {
	if (!hasLocalStorage()) return;
	localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
}

export function listDocuments(): StoredDocument[] {
	return [...readRegistry().documents].sort((a, b) => a.name.localeCompare(b.name));
}

export function getDocument(id: string): StoredDocument | null {
	return readRegistry().documents.find((doc) => doc.id === id) ?? null;
}

export function upsertDocument(doc: StoredDocument) {
	const snapshot = coerceSnapshot(doc.snapshot);
	if (!snapshot) {
		console.warn(`[documents] Refusing to save corrupt snapshot for "${doc.name}" (${doc.id}).`);
		return;
	}
	const registry = readRegistry();
	const normalized: StoredDocument = { ...doc, snapshot };
	const index = registry.documents.findIndex((entry) => entry.id === normalized.id);
	if (index >= 0) registry.documents[index] = normalized;
	else registry.documents.push(normalized);
	writeRegistry(registry);
}

export function deleteDocument(id: string) {
	const registry = readRegistry();
	registry.documents = registry.documents.filter((doc) => doc.id !== id);
	writeRegistry(registry);
}

export function readSession(): SessionState {
	if (!hasLocalStorage()) return { lastDocumentId: null };
	try {
		const raw = localStorage.getItem(SESSION_KEY);
		if (!raw) return { lastDocumentId: null };
		const parsed = JSON.parse(raw) as Partial<SessionState>;
		return {
			lastDocumentId: typeof parsed.lastDocumentId === 'string' ? parsed.lastDocumentId : null
		};
	} catch {
		return { lastDocumentId: null };
	}
}

export function writeSession(session: SessionState) {
	if (!hasLocalStorage()) return;
	localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function resolveDocument(id: string): ResolvedDocument | null {
	return getExampleDocument(id) ?? getDocument(id);
}
