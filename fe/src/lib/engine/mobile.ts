/** Matches the mobile layout breakpoint in app.css. */
export function isMobileClient(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(max-width: 760px) and (pointer: coarse)').matches;
}
