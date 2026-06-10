<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { selftest } from '$lib/color/selftest';
	import { m3 } from '$lib/color/math';
	import { WebGlRenderer } from '$lib/renderer/webgl-renderer';
	import { rebuildMatrices, rebuildShell } from '$lib/renderer/uniforms';
	import { chain, pick } from '$lib/engine/picking';
	import { buildRamp } from '$lib/engine/theme';
	import ViewportToolbar from './ViewportToolbar.svelte';

	import type { ExplorerState } from '$lib/engine/types';

	import type { Camera } from '$lib/engine/camera';

	let {
		state: explorer = $bindable(),
		camera = $bindable()
	} = $props<{ state: ExplorerState; camera: Camera }>();

	let canvas: HTMLCanvasElement;
	let renderer: WebGlRenderer | null = null;
	let error: string | null = $state(null);
	let dragging = false;
	let gesture: 'orbit' | 'inspect' = 'orbit';
	let moved = 0;
	let lastX = 0;
	let lastY = 0;
	let pinching = false;
	let pinchSpan = 0;
	let capturedPointerId: number | null = null;

	const MIN_DIST = 1.2;
	const MAX_DIST = 8;

	const matrices = $derived(rebuildMatrices(explorer.gamut));
	const shellMatrices = $derived(rebuildShell(explorer.shell));

	function draw() {
		renderer?.draw({ state: explorer, matrices, shellMatrices, camera });
	}

	function zoomCamera(factor: number) {
		camera.dist = Math.min(MAX_DIST, Math.max(MIN_DIST, camera.dist * factor));
		draw();
	}

	function touchSpan(touches: TouchList) {
		const dx = touches[0].clientX - touches[1].clientX;
		const dy = touches[0].clientY - touches[1].clientY;
		return Math.hypot(dx, dy);
	}

	function releaseCapture() {
		if (capturedPointerId !== null && canvas?.hasPointerCapture(capturedPointerId)) {
			canvas.releasePointerCapture(capturedPointerId);
		}
		capturedPointerId = null;
		dragging = false;
	}

	function onTouchStart(event: TouchEvent) {
		if (event.touches.length !== 2) return;
		event.preventDefault();
		pinching = true;
		pinchSpan = touchSpan(event.touches);
		releaseCapture();
		gesture = 'orbit';
	}

	function onTouchMove(event: TouchEvent) {
		if (event.touches.length !== 2) return;
		event.preventDefault();
		const span = touchSpan(event.touches);
		if (pinchSpan > 0) zoomCamera(pinchSpan / span);
		pinchSpan = span;
	}

	function onTouchEnd(event: TouchEvent) {
		if (event.touches.length < 2) {
			pinching = false;
			pinchSpan = 0;
		}
	}

	function inspectAt(clientX: number, clientY: number) {
		const rect = canvas.getBoundingClientRect();
		const hit = pick(clientX - rect.left, clientY - rect.top, rect.width, rect.height, explorer, matrices, camera);
		explorer.hover = hit ? { ...hit, chain: chain(hit.rgbLin, explorer, matrices) } : null;
		draw();
		return hit;
	}

	function setThemeStopAt(clientX: number, clientY: number) {
		if (!explorer.theme.arm) return false;
		const rect = canvas.getBoundingClientRect();
		const hit = pick(clientX - rect.left, clientY - rect.top, rect.width, rect.height, explorer, matrices, camera);
		if (!hit) return false;
		const arm = explorer.theme.arm;
		explorer.theme[arm] = { srgbLin: m3.mulV(matrices.toSrgbLin.toSrgb, hit.rgbLin) };
		explorer.theme.arm = arm === 'A' ? 'B' : null;
		buildRamp(explorer, matrices);
		draw();
		return true;
	}

	function onPointerDown(event: PointerEvent) {
		if (pinching) return;
		if (event.pointerType === 'touch') event.preventDefault();
		dragging = true;
		gesture = 'orbit';
		moved = 0;
		lastX = event.clientX;
		lastY = event.clientY;
		capturedPointerId = event.pointerId;
		canvas.setPointerCapture(event.pointerId);
		if (event.pointerType === 'touch') {
			gesture = inspectAt(event.clientX, event.clientY) ? 'inspect' : 'orbit';
		}
	}

	function onPointerUp(event: PointerEvent) {
		if (pinching) return;
		if (event.pointerType === 'touch') event.preventDefault();
		dragging = false;
		if (moved < 5) {
			const themed = setThemeStopAt(event.clientX, event.clientY);
			if (!themed && event.pointerType === 'touch') inspectAt(event.clientX, event.clientY);
		}
		gesture = 'orbit';
		if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
		if (capturedPointerId === event.pointerId) capturedPointerId = null;
	}

	function onPointerMove(event: PointerEvent) {
		if (pinching) return;
		if (dragging) {
			if (event.pointerType === 'touch') event.preventDefault();
			const dx = event.clientX - lastX;
			const dy = event.clientY - lastY;
			lastX = event.clientX;
			lastY = event.clientY;
			moved += Math.abs(dx) + Math.abs(dy);
			if (event.pointerType === 'touch' && gesture === 'inspect') {
				inspectAt(event.clientX, event.clientY);
				return;
			}
			camera.yaw -= dx * 0.008;
			camera.pitch = Math.min(1.45, Math.max(-0.2, camera.pitch + dy * 0.006));
			draw();
			return;
		}
		const rect = canvas.getBoundingClientRect();
		const hit = pick(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height, explorer, matrices, camera);
		explorer.hover = hit ? { ...hit, chain: chain(hit.rgbLin, explorer, matrices) } : null;
		draw();
	}

	function onPointerCancel(event: PointerEvent) {
		if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
		if (capturedPointerId === event.pointerId) capturedPointerId = null;
		dragging = false;
		gesture = 'orbit';
	}

	function onWheel(event: WheelEvent) {
		event.preventDefault();
		if (event.ctrlKey) {
			zoomCamera(1 - event.deltaY * 0.01);
		} else {
			zoomCamera(1 + Math.sign(event.deltaY) * 0.08);
		}
	}

	onMount(() => {
		const touchOpts = { passive: false } as AddEventListenerOptions;
		canvas.addEventListener('touchstart', onTouchStart, touchOpts);
		canvas.addEventListener('touchmove', onTouchMove, touchOpts);
		canvas.addEventListener('touchend', onTouchEnd);
		canvas.addEventListener('touchcancel', onTouchEnd);

		try {
			selftest();
			renderer = new WebGlRenderer(canvas);
			const ro = new ResizeObserver(draw);
			ro.observe(canvas);
			renderer.rebuildBoundary(explorer, matrices);
			draw();
			return () => {
				canvas.removeEventListener('touchstart', onTouchStart);
				canvas.removeEventListener('touchmove', onTouchMove);
				canvas.removeEventListener('touchend', onTouchEnd);
				canvas.removeEventListener('touchcancel', onTouchEnd);
				ro.disconnect();
				renderer?.dispose();
				renderer = null;
			};
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			return () => {
				canvas.removeEventListener('touchstart', onTouchStart);
				canvas.removeEventListener('touchmove', onTouchMove);
				canvas.removeEventListener('touchend', onTouchEnd);
				canvas.removeEventListener('touchcancel', onTouchEnd);
			};
		}
	});

	onDestroy(() => {
		renderer?.dispose();
		renderer = null;
	});

	$effect(() => {
		explorer.spaceMode;
		explorer.gamut;
		explorer.slice;
		explorer.planeMode;
		explorer.off;
		explorer.az;
		explorer.el;
		explorer.eps;
		explorer.cutAbove;
		explorer.cutBelow;
		explorer.cylSlice;
		explorer.cylRad;
		explorer.planeOutline;
		explorer.cylinderOutline;
		untrack(() => {
			explorer.hover = null;
			buildRamp(explorer, matrices);
			renderer?.rebuildBoundary(explorer, matrices);
			draw();
		});
	});

	$effect(() => {
		explorer.theme.steps;
		explorer.theme.mode;
		explorer.theme.dh;
		explorer.theme.dc;
		explorer.theme.cprof;
		explorer.theme.arcLong;
		untrack(() => {
			buildRamp(explorer, matrices);
			draw();
		});
	});

	$effect(() => {
		explorer.N;
		explorer.lines;
		explorer.floor;
		explorer.shell;
		explorer.surfaceGridAlpha;
		draw();
	});

	$effect(() => {
		explorer.cvd;
		explorer.cvdSev;
		untrack(() => {
			if (explorer.hover) explorer.hover.chain = chain(explorer.hover.rgbLin, explorer, matrices);
			draw();
		});
	});

	$effect(() => {
		explorer.theme.stops;
		draw();
	});

	$effect(() => {
		camera.yaw;
		camera.pitch;
		camera.dist;
		camera.target;
		camera.fov;
		draw();
	});
</script>

<main class="viewport">
	<ViewportToolbar bind:state={explorer} />
	<canvas
		bind:this={canvas}
		aria-label="Gamut explorer WebGL viewport"
		onpointerdown={onPointerDown}
		onpointerup={onPointerUp}
		onpointermove={onPointerMove}
		onpointercancel={onPointerCancel}
		onwheel={onWheel}
	></canvas>
	{#if error}
		<div class="viewport-placeholder">{error}</div>
	{/if}
	<div class="hint hint-desktop">
		drag - orbit&nbsp;&nbsp;wheel - zoom&nbsp;&nbsp;hover solid - inspect chain
	</div>
	<div class="hint hint-mobile">
		drag - orbit&nbsp;&nbsp;pinch - zoom&nbsp;&nbsp;touch solid - inspect chain
	</div>
</main>
