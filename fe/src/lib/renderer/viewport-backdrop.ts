import { lsrgb2oklab, oklab2lsrgb } from '$lib/color/pipeline';
import { TRC } from '$lib/color/transfer';

import type { Vec3 } from '$lib/color/math';

/** Default WebGL / viewport surround (matches legacy `#0a0a0b`). */
export const VIEWPORT_CLEAR_DARK_SRGB: Vec3 = [0.039, 0.039, 0.043];

const NEUTRAL_OKLAB_L = 0.5;

function encodeOklabNeutralSrgb(l: number): Vec3 {
	const lin = oklab2lsrgb([l, 0, 0]);
	return [TRC.srgb.enc(lin[0]), TRC.srgb.enc(lin[1]), TRC.srgb.enc(lin[2])];
}

/** Oklab L = 0.5, a* = b* = 0 — perceptually neutral mid-gray surround. */
export const VIEWPORT_CLEAR_NEUTRAL_SRGB: Vec3 = encodeOklabNeutralSrgb(NEUTRAL_OKLAB_L);

export function viewportClearSrgb(neutralBackdrop: boolean): Vec3 {
	return neutralBackdrop ? VIEWPORT_CLEAR_NEUTRAL_SRGB : VIEWPORT_CLEAR_DARK_SRGB;
}

export function viewportClearCss(neutralBackdrop: boolean): string {
	const [r, g, b] = viewportClearSrgb(neutralBackdrop).map((c) => Math.round(c * 255));
	return `rgb(${r} ${g} ${b})`;
}

/** Sanity check for tests: encoded neutral should round-trip to the target Oklab coordinates. */
export function neutralBackdropOklabFromSrgb(srgb: Vec3): Vec3 {
	const lin: Vec3 = [TRC.srgb.dec(srgb[0]), TRC.srgb.dec(srgb[1]), TRC.srgb.dec(srgb[2])];
	return lsrgb2oklab(lin);
}
