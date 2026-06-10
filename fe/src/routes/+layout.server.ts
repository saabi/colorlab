import { env } from '$env/dynamic/public';
import type { LayoutServerLoad } from './$types';

const fallbackTitle = 'COLOR LAB - Gamut Explorer';
const fallbackDescription =
	'Explore color gamuts in 3D with WebGL2, Oklab workflows, WCAG checks, and theme ramp tools.';

function normalizeOrigin(value: string | undefined) {
	const trimmed = value?.trim();
	if (!trimmed) return null;

	try {
		return new URL(trimmed).origin;
	} catch {
		return null;
	}
}

function firstForwardedValue(value: string | null) {
	return value?.split(',')[0]?.trim() || null;
}

function getRequestOrigin(request: Request, fallback: string) {
	const host = firstForwardedValue(request.headers.get('x-forwarded-host')) ?? request.headers.get('host');
	if (!host) return fallback;

	const forwardedProto = firstForwardedValue(request.headers.get('x-forwarded-proto'));
	const proto =
		forwardedProto ??
		(request.headers.get('x-forwarded-ssl') === 'on' ? 'https' : new URL(fallback).protocol.slice(0, -1));

	return `${proto}://${host}`;
}

export const load: LayoutServerLoad = ({ request, url }) => {
	const siteUrl = normalizeOrigin(env.PUBLIC_SITE_URL) ?? getRequestOrigin(request, url.origin);
	const imageUrl = `${siteUrl}/pwa-screenshot-wide.png`;

	return {
		meta: {
			title: fallbackTitle,
			description: fallbackDescription,
			siteUrl,
			imageUrl,
			imageWidth: '1916',
			imageHeight: '956'
		}
	};
};
