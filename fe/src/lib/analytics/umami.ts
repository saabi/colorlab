type UmamiEventData = Record<string, string | number | boolean | null | undefined>;

declare global {
	interface Window {
		umami?: {
			track: (eventName: string, eventData?: UmamiEventData) => void;
		};
	}
}

export function track(eventName: string, data?: UmamiEventData) {
	if (typeof window === 'undefined') return;
	window.umami?.track(eventName, data);
}
