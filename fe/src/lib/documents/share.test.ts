import { describe, expect, it, vi } from 'vitest';

import { defaultSnapshot, toSnapshot } from './snapshot';
import {
	buildShareUrl,
	decodeSnapshotParam,
	encodeSnapshotParam,
	looksLikeShareLink,
	MAX_IMPORT_BYTES,
	readShareParam,
	resolveSnapshotFromUrl,
	shareParamFromUrl,
	snapshotFromJsonString,
	snapshotToJsonString,
	SHARE_HASH_KEY
} from './share';
import { createAppState } from '$lib/engine/state.svelte';
import { CURRENT_SNAPSHOT_VERSION } from './types';

describe('share — JSON file transport', () => {
	it('round-trips a snapshot through pretty JSON', () => {
		const snap = defaultSnapshot();
		const result = snapshotFromJsonString(snapshotToJsonString(snap));
		expect(result.snapshot).not.toBeNull();
		expect(result.snapshot).toEqual(snap);
		expect(result.rejectReason).toBeUndefined();
	});

	it('rejects malformed JSON', () => {
		const result = snapshotFromJsonString('{ not json');
		expect(result.snapshot).toBeNull();
		expect(result.rejectReason).toBe('invalid');
	});

	it('rejects a snapshot from a newer schema', () => {
		const snap = defaultSnapshot();
		const future = { ...snap, schemaVersion: CURRENT_SNAPSHOT_VERSION + 1 };
		const result = snapshotFromJsonString(JSON.stringify(future));
		expect(result.snapshot).toBeNull();
		expect(result.rejectReason).toBe('newer');
	});

	it('coerces an edited snapshot (drops unknown keys, keeps valid state)', () => {
		const snap = defaultSnapshot() as unknown as Record<string, unknown>;
		const polluted = JSON.stringify({ ...snap, bogusTopLevel: 42 });
		const result = snapshotFromJsonString(polluted);
		expect(result.snapshot).not.toBeNull();
		expect(result.snapshot as unknown as Record<string, unknown>).not.toHaveProperty('bogusTopLevel');
	});
});

describe('share — URL transport', () => {
	it('round-trips a snapshot through the encoded param', async () => {
		const snap = toSnapshot(createAppState());
		const param = await encodeSnapshotParam(snap);
		expect(param).not.toContain('+');
		expect(param).not.toContain('/');
		expect(param).not.toContain('=');
		const decoded = await decodeSnapshotParam(param);
		expect(decoded.snapshot).toEqual(snap);
	});

	it('produces a meaningfully compressed payload', async () => {
		const snap = defaultSnapshot();
		const param = await encodeSnapshotParam(snap);
		const rawLen = JSON.stringify(snap).length;
		expect(param.length).toBeLessThan(rawLen);
	});

	it('builds and reads back a share URL hash', async () => {
		const snap = defaultSnapshot();
		const url = await buildShareUrl(snap, 'https://example.com/app');
		expect(url.startsWith('https://example.com/app#')).toBe(true);
		const param = readShareParam(new URL(url).hash);
		expect(param).not.toBeNull();
		const decoded = await decodeSnapshotParam(param as string);
		expect(decoded.snapshot).toEqual(snap);
	});

	it('returns null when the hash carries no share token', () => {
		expect(readShareParam('')).toBeNull();
		expect(readShareParam('#other=1')).toBeNull();
		expect(readShareParam(`#${SHARE_HASH_KEY}=`)).toBe('');
	});

	it('fails closed on a corrupt token', async () => {
		const decoded = await decodeSnapshotParam('not-a-valid-token!!');
		expect(decoded.snapshot).toBeNull();
		expect(decoded.rejectReason).toBe('invalid');
	});
});

describe('share — URL parsing helpers', () => {
	it('extracts a token from a full share URL', async () => {
		const url = await buildShareUrl(defaultSnapshot(), 'https://example.com/app');
		const token = shareParamFromUrl(url);
		expect(token).not.toBeNull();
		expect(looksLikeShareLink(url)).toBe(true);
	});

	it('returns null / false for non-share URLs and garbage', () => {
		expect(shareParamFromUrl('https://example.com/data.json')).toBeNull();
		expect(shareParamFromUrl('not a url')).toBeNull();
		expect(looksLikeShareLink('https://example.com/data.json')).toBe(false);
		expect(looksLikeShareLink('   ')).toBe(false);
	});
});

describe('share — resolveSnapshotFromUrl', () => {
	it('decodes a share link without touching the network', async () => {
		const snap = defaultSnapshot();
		const url = await buildShareUrl(snap, 'https://example.com/app');
		const fetchSpy = vi.fn();
		const result = await resolveSnapshotFromUrl(url, fetchSpy as unknown as typeof fetch);
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(result.snapshot).toEqual(snap);
	});

	it('fetches and parses a remote JSON document', async () => {
		const snap = defaultSnapshot();
		const fetchImpl = vi.fn(async () => new Response(JSON.stringify(snap), { status: 200 }));
		const result = await resolveSnapshotFromUrl('https://example.com/doc.json', fetchImpl as unknown as typeof fetch);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(result.snapshot).toEqual(snap);
	});

	it('reports a non-OK HTTP status', async () => {
		const fetchImpl = vi.fn(async () => new Response('nope', { status: 404 }));
		const result = await resolveSnapshotFromUrl('https://example.com/missing.json', fetchImpl as unknown as typeof fetch);
		expect(result.snapshot).toBeNull();
		expect(result.reason).toBe('http');
	});

	it('reports a network/CORS failure', async () => {
		const fetchImpl = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		});
		const result = await resolveSnapshotFromUrl('https://blocked.example/doc.json', fetchImpl as unknown as typeof fetch);
		expect(result.snapshot).toBeNull();
		expect(result.reason).toBe('network');
	});

	it('rejects an oversized response', async () => {
		const big = 'x'.repeat(MAX_IMPORT_BYTES + 1);
		const fetchImpl = vi.fn(async () => new Response(big, { status: 200 }));
		const result = await resolveSnapshotFromUrl('https://example.com/huge.json', fetchImpl as unknown as typeof fetch);
		expect(result.snapshot).toBeNull();
		expect(result.reason).toBe('too-large');
	});

	it('maps a malformed remote body to invalid', async () => {
		const fetchImpl = vi.fn(async () => new Response('{ not json', { status: 200 }));
		const result = await resolveSnapshotFromUrl('https://example.com/bad.json', fetchImpl as unknown as typeof fetch);
		expect(result.snapshot).toBeNull();
		expect(result.rejectReason).toBe('invalid');
	});
});
