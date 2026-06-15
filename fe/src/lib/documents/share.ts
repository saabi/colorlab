import { parseSnapshot, type ParseSnapshotResult } from './parse';

import type { ParameterSnapshot } from './types';

// Shared state is a transport over the existing snapshot serialization — it never
// bypasses the canonical load path. Decoded payloads always go through
// `parseSnapshot` (detect → migrate → coerce) before touching live state.

/** Hash-fragment key carrying an encoded snapshot, e.g. `#s=...`. */
export const SHARE_HASH_KEY = 's';

/** Pretty JSON for file download / human inspection. */
export function snapshotToJsonString(snapshot: ParameterSnapshot): string {
	return JSON.stringify(snapshot, null, 2);
}

const INVALID: ParseSnapshotResult = {
	snapshot: null,
	fromVersion: null,
	migrated: false,
	rejectReason: 'invalid'
};

/** Parse a JSON document (file contents) into a snapshot via the canonical path. */
export function snapshotFromJsonString(text: string): ParseSnapshotResult {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return INVALID;
	}
	return parseSnapshot(raw);
}

// --- base64url (binary-safe, no padding) ---

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(text: string): Uint8Array {
	const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

// --- gzip via the platform CompressionStream (no dependency) ---

async function runStream(bytes: Uint8Array, transform: CompressionStream | DecompressionStream) {
	const writer = transform.writable.getWriter();
	const writeDone = writer.write(bytes as BufferSource).then(() => writer.close());
	const reader = transform.readable.getReader();
	const chunks: Uint8Array[] = [];
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value) chunks.push(value);
	}
	await writeDone;
	const total = chunks.reduce((n, c) => n + c.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}

function gzip(bytes: Uint8Array) {
	return runStream(bytes, new CompressionStream('gzip'));
}

function gunzip(bytes: Uint8Array) {
	return runStream(bytes, new DecompressionStream('gzip'));
}

/** Encode a snapshot into a compact, URL-safe token. */
export async function encodeSnapshotParam(snapshot: ParameterSnapshot): Promise<string> {
	const json = JSON.stringify(snapshot);
	const zipped = await gzip(new TextEncoder().encode(json));
	return base64UrlEncode(zipped);
}

/** Decode a share token back through the canonical snapshot load path. */
export async function decodeSnapshotParam(param: string): Promise<ParseSnapshotResult> {
	let raw: unknown;
	try {
		const bytes = await gunzip(base64UrlDecode(param));
		raw = JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		return INVALID;
	}
	return parseSnapshot(raw);
}

/** Build a full share URL carrying the snapshot in the hash fragment. */
export async function buildShareUrl(
	snapshot: ParameterSnapshot,
	baseUrl: string
): Promise<string> {
	const param = await encodeSnapshotParam(snapshot);
	const url = new URL(baseUrl);
	url.hash = `${SHARE_HASH_KEY}=${param}`;
	return url.toString();
}

/** Extract the share token from a `location.hash`, or null when absent. */
export function readShareParam(hash: string): string | null {
	const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
	if (!fragment) return null;
	return new URLSearchParams(fragment).get(SHARE_HASH_KEY);
}

/** Extract the share token from a full URL string, or null when absent/unparsable. */
export function shareParamFromUrl(url: string): string | null {
	try {
		return readShareParam(new URL(url).hash);
	} catch {
		return null;
	}
}

/** True when a string is a Color Lab share link (carries a `#s=` token). */
export function looksLikeShareLink(text: string): boolean {
	return shareParamFromUrl(text.trim()) !== null;
}

/** Soft cap on a fetched remote document, guarding against huge/wrong responses. */
export const MAX_IMPORT_BYTES = 5_000_000;

/** Network/transport-level failure reasons, distinct from snapshot-level `rejectReason`. */
export type UrlImportReason = 'network' | 'http' | 'too-large';

export type UrlImportResult = ParseSnapshotResult & { reason?: UrlImportReason };

/**
 * Resolve a user-entered URL to a snapshot. A Color Lab share link is decoded
 * locally (its payload lives in the hash, which a fetch would never see); any
 * other URL is fetched and parsed as a JSON document. `fetchImpl` is injectable
 * for testing. The result always carries a snapshot or a reason it could not.
 */
export async function resolveSnapshotFromUrl(
	url: string,
	fetchImpl: typeof fetch = fetch
): Promise<UrlImportResult> {
	const trimmed = url.trim();

	const token = shareParamFromUrl(trimmed);
	if (token !== null) return decodeSnapshotParam(token);

	let response: Response;
	try {
		response = await fetchImpl(trimmed);
	} catch {
		return { snapshot: null, fromVersion: null, migrated: false, reason: 'network' };
	}
	if (!response.ok) {
		return { snapshot: null, fromVersion: null, migrated: false, reason: 'http' };
	}

	const text = await response.text();
	if (text.length > MAX_IMPORT_BYTES) {
		return { snapshot: null, fromVersion: null, migrated: false, reason: 'too-large' };
	}
	return snapshotFromJsonString(text);
}
