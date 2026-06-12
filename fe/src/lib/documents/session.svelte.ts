import { MOBILE_STARTUP_TESS } from '$lib/engine/mobile';
import { listExampleDocuments } from './examples';
import { applySnapshot, cloneSnapshot, defaultSnapshot, snapshotsEqual, toSnapshot } from './snapshot';
import { track } from '$lib/analytics/umami';
import {
	deleteDocument,
	listDocuments,
	resolveDocument,
	readSession,
	upsertDocument,
	writeSession
} from './storage';

import type { AppState } from '$lib/engine/types';
import type { DocumentSource, ParameterSnapshot, StoredDocument } from './types';

export const UNTITLED_SELECT_ID = '__untitled__';

export function createDocumentSession(
	getAppState: () => AppState,
	options: { onAppliedSnapshot?: (snapshot: ParameterSnapshot) => void } = {}
) {
	let activeId = $state<string | null>(null);
	let activeName = $state('Untitled');
	let activeSource = $state<DocumentSource>('user');
	let savedSnapshot = $state<ParameterSnapshot>(defaultSnapshot());
	let userDocuments = $state<StoredDocument[]>(listDocuments());
	const exampleDocuments = listExampleDocuments();
	let useMobileDefaults = false;

	let confirmOpen = $state(false);
	let confirmMessage = $state('');
	let confirmResolve: ((discard: boolean) => void) | null = null;

	const isDirty = $derived(!snapshotsEqual(toSnapshot(getAppState()), savedSnapshot));
	const activeSelectId = $derived(activeId ?? UNTITLED_SELECT_ID);
	const canSave = $derived(isDirty || activeId === null);
	const canSaveAs = true;
	const canRename = $derived(activeSource === 'user' && activeId !== null);
	const canDelete = $derived(activeSource === 'user' && activeId !== null);

	function refreshUserDocuments() {
		userDocuments = listDocuments();
	}

	function setBaseline(snapshot: ParameterSnapshot) {
		savedSnapshot = cloneSnapshot(snapshot);
	}

	function warnDuplicateName(name: string) {
		if (userDocuments.some((doc) => doc.name === name && doc.id !== activeId)) {
			console.warn(`[documents] A parameter set named "${name}" already exists.`);
		}
	}

	function createUserDocument(name: string, snapshot: ParameterSnapshot) {
		const id = crypto.randomUUID();
		const doc: StoredDocument = {
			id,
			name,
			source: 'user',
			updatedAt: Date.now(),
			snapshot
		};
		upsertDocument(doc);
		refreshUserDocuments();
		activeId = id;
		activeName = name;
		activeSource = 'user';
		setBaseline(snapshot);
		writeSession({ lastDocumentId: id });
		return true;
	}

	function applyDocument(doc: NonNullable<ReturnType<typeof resolveDocument>>, tracked = false) {
		const snapshot = cloneSnapshot(doc.snapshot);
		if (useMobileDefaults) snapshot.explorer.N = MOBILE_STARTUP_TESS;
		applySnapshot(getAppState(), snapshot);
		setBaseline(snapshot);
		options.onAppliedSnapshot?.(snapshot);
		activeId = doc.id;
		activeName = doc.name;
		activeSource = doc.source;
		writeSession({ lastDocumentId: doc.id });
		if (tracked) track('document_load', { source: doc.source });
	}

	function applyDefaults(mobile = useMobileDefaults) {
		const snapshot = defaultSnapshot();
		if (mobile) snapshot.explorer.N = MOBILE_STARTUP_TESS;
		applySnapshot(getAppState(), snapshot);
		setBaseline(snapshot);
		options.onAppliedSnapshot?.(snapshot);
		activeId = null;
		activeName = 'Untitled';
		activeSource = 'user';
		writeSession({ lastDocumentId: null });
	}

	function init(options: { mobile?: boolean } = {}) {
		useMobileDefaults = options.mobile ?? false;
		refreshUserDocuments();
		const { lastDocumentId } = readSession();
		if (lastDocumentId) {
			const doc = resolveDocument(lastDocumentId);
			if (doc) {
				applyDocument(doc);
				return;
			}
		}
		applyDefaults(useMobileDefaults);
	}

	function confirmDiscardIfDirty(message: string) {
		if (!isDirty) return Promise.resolve(true);
		confirmMessage = message;
		confirmOpen = true;
		return new Promise<boolean>((resolve) => {
			confirmResolve = resolve;
		});
	}

	function confirmDiscard() {
		confirmOpen = false;
		confirmResolve?.(true);
		confirmResolve = null;
	}

	function confirmCancel() {
		confirmOpen = false;
		confirmResolve?.(false);
		confirmResolve = null;
	}

	async function loadDocument(id: string) {
		if (id === activeSelectId) return true;

		if (id === UNTITLED_SELECT_ID) {
			const ok = await confirmDiscardIfDirty('Discard unsaved changes and open "Untitled"?');
			if (!ok) return false;
			applyDefaults(useMobileDefaults);
			return true;
		}

		const doc = resolveDocument(id);
		if (!doc) return false;
		const ok = await confirmDiscardIfDirty(`Discard unsaved changes and open "${doc.name}"?`);
		if (!ok) return false;
		applyDocument(doc, true);
		return true;
	}

	async function newDocument() {
		const ok = await confirmDiscardIfDirty('Discard unsaved changes and create a new document?');
		if (!ok) return false;
		applyDefaults(useMobileDefaults);
		track('document_new', { mobile: useMobileDefaults });
		return true;
	}

	async function save(name?: string) {
		const snapshot = toSnapshot(getAppState());
		if (activeSource === 'example' || activeId === null) {
			const docName = name?.trim();
			if (!docName) return false;
			warnDuplicateName(docName);
			const source = activeSource === 'example' ? 'example' : 'new';
			const saved = createUserDocument(docName, snapshot);
			if (saved) track('document_save', { source });
			return saved;
		}

		const doc: StoredDocument = {
			id: activeId,
			name: activeName,
			source: 'user',
			updatedAt: Date.now(),
			snapshot
		};
		upsertDocument(doc);
		refreshUserDocuments();
		setBaseline(snapshot);
		writeSession({ lastDocumentId: activeId });
		track('document_save', { source: 'existing' });
		return true;
	}

	async function saveAs(name: string) {
		const docName = name.trim();
		if (!docName) return false;
		warnDuplicateName(docName);
		track('document_save_as', { from: activeId === null ? 'untitled' : activeSource });
		return createUserDocument(docName, toSnapshot(getAppState()));
	}

	async function rename(name: string) {
		if (!canRename || !activeId) return false;
		const docName = name.trim();
		if (!docName) return false;
		warnDuplicateName(docName);
		const doc: StoredDocument = {
			id: activeId,
			name: docName,
			source: 'user',
			updatedAt: Date.now(),
			snapshot: toSnapshot(getAppState())
		};
		upsertDocument(doc);
		refreshUserDocuments();
		activeName = docName;
		return true;
	}

	function deleteActive() {
		if (!canDelete || !activeId) return false;
		const id = activeId;
		deleteDocument(id);
		refreshUserDocuments();
		applyDefaults(useMobileDefaults);
		track('document_delete', { source: 'user' });
		return true;
	}

	return {
		get activeId() {
			return activeId;
		},
		get activeName() {
			return activeName;
		},
		get activeSource() {
			return activeSource;
		},
		get activeSelectId() {
			return activeSelectId;
		},
		get isDirty() {
			return isDirty;
		},
		get canSave() {
			return canSave;
		},
		get canSaveAs() {
			return canSaveAs;
		},
		get canRename() {
			return canRename;
		},
		get canDelete() {
			return canDelete;
		},
		get userDocuments() {
			return userDocuments;
		},
		get exampleDocuments() {
			return exampleDocuments;
		},
		get confirmOpen() {
			return confirmOpen;
		},
		get confirmMessage() {
			return confirmMessage;
		},
		init,
		loadDocument,
		newDocument,
		save,
		saveAs,
		rename,
		deleteActive,
		confirmDiscard,
		confirmCancel
	};
}

export type DocumentSession = ReturnType<typeof createDocumentSession>;
