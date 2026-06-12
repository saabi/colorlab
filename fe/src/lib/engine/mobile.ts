import type { ExplorerState } from './types';

/** Matches the mobile layout breakpoint in app.css. */
export function isMobileLayout(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(max-width: 760px)').matches;
}

/** Narrow layout with a coarse primary pointer (phones / most tablets). */
export function isMobileClient(): boolean {
	if (typeof window === 'undefined') return false;
	return isMobileLayout() && window.matchMedia('(pointer: coarse)').matches;
}

/** Safe tessellation for mobile first paint — user can raise in the Tessellation step. */
export const MOBILE_STARTUP_TESS = 64 as const;

export function capTessellationForMobile(N: ExplorerState['N']): ExplorerState['N'] {
	if (!isMobileLayout()) return N;
	return N > MOBILE_STARTUP_TESS ? MOBILE_STARTUP_TESS : N;
}

export function applyMobileStartupTessellation(explorer: Pick<ExplorerState, 'N'>): void {
	explorer.N = capTessellationForMobile(explorer.N);
}
