import type { LayoutLoad } from './$types';

const fallbackTitle = 'COLOR LAB - Gamut Explorer';
const fallbackDescription =
	'Explore color gamuts in 3D with WebGL2, Oklab workflows, WCAG checks, and theme ramp tools.';

function normalizeOrigin(value: string | undefined, requestOrigin: string) {
	const trimmed = value?.trim();
	if (!trimmed) return requestOrigin;

	try {
		return new URL(trimmed).origin;
	} catch {
		return requestOrigin;
	}
}

export const load: LayoutLoad = ({ url }) => {
	const siteUrl = normalizeOrigin(import.meta.env.PUBLIC_SITE_URL, url.origin);
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
