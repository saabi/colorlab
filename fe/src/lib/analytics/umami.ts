type UmamiEventData = Record<string, string | number | boolean | null | undefined>;

let injected = false;

export function injectUmami() {
	if (injected || typeof document === 'undefined') return;
	const src = import.meta.env.PUBLIC_UMAMI_SRC;
	const websiteId = import.meta.env.PUBLIC_UMAMI_WEBSITE_ID;
	if (!src || !websiteId) return;

	const s = document.createElement('script');
	s.async = true;
	s.defer = true;
	s.src = src;
	s.setAttribute('data-website-id', websiteId);
	document.head.appendChild(s);
	injected = true;
}

export function track(eventName: string, data?: UmamiEventData) {
	if (typeof window === 'undefined') return;
	window.umami?.track(eventName, data);
}
