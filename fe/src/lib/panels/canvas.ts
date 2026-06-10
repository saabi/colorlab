export function fitCanvas(canvas: HTMLCanvasElement) {
	const d = Math.min(window.devicePixelRatio || 1, 2);
	const w = canvas.clientWidth;
	const h = canvas.clientHeight;
	if (canvas.width !== Math.round(w * d) || canvas.height !== Math.round(h * d)) {
		canvas.width = Math.round(w * d);
		canvas.height = Math.round(h * d);
	}
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('2D canvas unavailable');
	ctx.setTransform(d, 0, 0, d, 0, 0);
	return { ctx, w, h };
}
