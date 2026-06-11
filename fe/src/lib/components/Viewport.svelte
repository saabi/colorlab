<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { selftest } from '$lib/color/selftest';
	import { m3 } from '$lib/color/math';
	import { track } from '$lib/analytics/umami';
	import { WebGlRenderer } from '$lib/renderer/webgl-renderer';
	import { rebuildMatrices, rebuildShell } from '$lib/renderer/uniforms';
	import { chain, pick } from '$lib/engine/picking';
	import { anchorWorld, buildRamp } from '$lib/engine/theme';
	import { createCamera, panCamera, projectToScreen } from '$lib/engine/camera';
	import GestureReferencePopover from './GestureReferencePopover.svelte';
	import ViewportToolbar from './ViewportToolbar.svelte';

	import type { ExplorerState } from '$lib/engine/types';
	import type { Camera } from '$lib/engine/camera';

	type ThemeArm = 'A' | 'B';
	type TouchTool = 'auto' | 'slice' | 'cylinder' | 'pickA' | 'pickB';
	type CanvasGesture =
		| { kind: 'orbit' }
		| { kind: 'inspect' }
		| { kind: 'pan' }
		| { kind: 'slice-offset'; startY: number; startOff: number }
		| { kind: 'cylinder-radius'; startX: number; startRadius: number }
		| { kind: 'drag-control-point'; index: number };

	let {
		state: explorer = $bindable(),
		camera = $bindable()
	} = $props<{ state: ExplorerState; camera: Camera }>();

	let canvas: HTMLCanvasElement;
	let renderer: WebGlRenderer | null = null;
	let error: string | null = $state(null);
	let dragging = false;
	let gesture: CanvasGesture = { kind: 'orbit' };
	let moved = 0;
	let lastX = 0;
	let lastY = 0;
	let pinching = false;
	let pinchSpan = 0;
	let pinchX = 0;
	let pinchY = 0;
	let capturedPointerId: number | null = null;
	let referenceOpen = $state(false);
	let gestureStatus: string | null = $state(null);
	let touchTool: TouchTool = $state('auto');
	let keys = { space: false, pickA: false, pickB: false };

	const MIN_DIST = 1.2;
	const MAX_DIST = 8;
	const PITCH_LIMIT = Math.PI / 2 - 0.04;
	const RESOLUTIONS = [64, 128, 192, 256] as const;
	const PERF_SAMPLE_COUNT = 12;
	const PERF_MARGIN = 1.1;
	const PERF_COOLDOWN_MS = 1200;

	let drawSamples: number[] = [];
	let lastAutoPerformanceStep = 0;

	const matrices = $derived(rebuildMatrices(explorer.gamut));
	const shellMatrices = $derived(rebuildShell(explorer.shell));
	const cursorMode = $derived(gesture.kind);

	function resetPerformanceSamples() {
		drawSamples = [];
	}

	function reduceTessellationForPerformance(avgMs: number) {
		const index = RESOLUTIONS.indexOf(explorer.N);
		if (index <= 0) return;
		const now = performance.now();
		if (now - lastAutoPerformanceStep < PERF_COOLDOWN_MS) return;
		const nextN = RESOLUTIONS[index - 1];
		explorer.N = nextN;
		lastAutoPerformanceStep = now;
		resetPerformanceSamples();
		gestureStatus = `Auto performance: tessellation ${nextN} (${(1000 / avgMs).toFixed(0)} fps avg)`;
	}

	function recordDrawTime(elapsedMs: number) {
		if (!explorer.autoPerformance) return;
		drawSamples = [...drawSamples.slice(-(PERF_SAMPLE_COUNT - 1)), elapsedMs];
		if (drawSamples.length < PERF_SAMPLE_COUNT) return;
		const avgMs = drawSamples.reduce((sum, value) => sum + value, 0) / drawSamples.length;
		const targetMs = 1000 / explorer.minAverageFps;
		if (avgMs > targetMs * PERF_MARGIN) reduceTessellationForPerformance(avgMs);
	}

	function draw() {
		if (!renderer) return;
		const t0 = performance.now();
		renderer.draw({ state: explorer, matrices, shellMatrices, camera });
		recordDrawTime(performance.now() - t0);
	}

	function clamp(value: number, min: number, max: number) {
		return Math.min(max, Math.max(min, value));
	}

	function refreshBoundary() {
		renderer?.rebuildBoundary(explorer, matrices);
		buildRamp(explorer, matrices);
		draw();
	}

	function zoomCamera(factor: number) {
		camera.dist = Math.min(MAX_DIST, Math.max(MIN_DIST, camera.dist * factor));
		draw();
	}

	function resetCamera() {
		const next = createCamera();
		camera.yaw = next.yaw;
		camera.pitch = next.pitch;
		camera.dist = next.dist;
		camera.target = next.target;
		camera.fov = next.fov;
		gestureStatus = 'Camera reset';
		draw();
	}

	function touchSpan(touches: TouchList) {
		const dx = touches[0].clientX - touches[1].clientX;
		const dy = touches[0].clientY - touches[1].clientY;
		return Math.hypot(dx, dy);
	}

	function touchCenter(touches: TouchList) {
		return {
			x: (touches[0].clientX + touches[1].clientX) / 2,
			y: (touches[0].clientY + touches[1].clientY) / 2
		};
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
		const center = touchCenter(event.touches);
		pinchX = center.x;
		pinchY = center.y;
		releaseCapture();
		gesture = { kind: 'orbit' };
		referenceOpen = false;
	}

	function onTouchMove(event: TouchEvent) {
		if (event.touches.length !== 2) return;
		event.preventDefault();
		const span = touchSpan(event.touches);
		if (pinchSpan > 0) zoomCamera(pinchSpan / span);
		const center = touchCenter(event.touches);
		panCamera(camera, center.x - pinchX, center.y - pinchY, canvas.clientHeight);
		pinchX = center.x;
		pinchY = center.y;
		pinchSpan = span;
		gestureStatus = 'Pan / zoom';
		draw();
	}

	function onTouchEnd(event: TouchEvent) {
		if (event.touches.length < 2 && pinching) {
			pinching = false;
			pinchSpan = 0;
			track('canvas_zoom', { input: 'pinch' });
		}
	}

	function inspectAt(clientX: number, clientY: number) {
		const rect = canvas.getBoundingClientRect();
		const hit = pick(clientX - rect.left, clientY - rect.top, rect.width, rect.height, explorer, matrices, camera);
		explorer.hover = hit ? { ...hit, chain: chain(hit.rgbLin, explorer, matrices) } : null;
		draw();
		return hit;
	}

	function setThemeStopAt(clientX: number, clientY: number, armOverride?: ThemeArm) {
		const activeArm = armOverride ?? explorer.theme.arm;
		if (!activeArm) return false;
		const rect = canvas.getBoundingClientRect();
		const hit = pick(clientX - rect.left, clientY - rect.top, rect.width, rect.height, explorer, matrices, camera);
		if (!hit) return false;
		explorer.theme[activeArm] = { srgbLin: m3.mulV(matrices.toSrgbLin.toSrgb, hit.rgbLin) };
		if (!armOverride) explorer.theme.arm = activeArm === 'A' ? 'B' : null;
		buildRamp(explorer, matrices);
		gestureStatus = `Theme ${activeArm} set`;
		track('theme_anchor_set', {
			arm: activeArm,
			method: armOverride ? (touchTool === 'pickA' || touchTool === 'pickB' ? 'touch' : 'shortcut') : 'panel'
		});
		draw();
		return true;
	}

	let rampRebuildQueued = false;
	function scheduleRampRebuild() {
		if (rampRebuildQueued) return;
		rampRebuildQueued = true;
		requestAnimationFrame(() => {
			rampRebuildQueued = false;
			buildRamp(explorer, matrices);
			draw();
		});
	}

	function getControlPointAtScreen(clientX: number, clientY: number, pointerType: string): number | null {
		const rect = canvas.getBoundingClientRect();
		const radius = pointerType === 'touch' ? 24 : 12;
		let best: number | null = null;
		let bestDist = radius;
		const selected = explorer.theme.selectedCp;
		explorer.theme.controlPoints.forEach((cp: { srgbLin: [number, number, number] }, i: number) => {
			const world = anchorWorld(cp, explorer, matrices);
			const screen = projectToScreen(world, camera, rect.width, rect.height);
			if (!screen) return;
			const dist = Math.hypot(clientX - rect.left - screen[0], clientY - rect.top - screen[1]);
			if (i === selected && dist <= radius) {
				bestDist = -1;
				best = i;
				return;
			}
			if (bestDist >= 0 && dist < bestDist) {
				bestDist = dist;
				best = i;
			}
		});
		return best;
	}

	function addControlPointAt(clientX: number, clientY: number) {
		const rect = canvas.getBoundingClientRect();
		const hit = pick(clientX - rect.left, clientY - rect.top, rect.width, rect.height, explorer, matrices, camera);
		if (!hit) return false;
		const srgbLin = m3.mulV(matrices.toSrgbLin.toSrgb, hit.rgbLin) as [number, number, number];
		explorer.theme.controlPoints = [...explorer.theme.controlPoints, { srgbLin }];
		explorer.theme.selectedCp = explorer.theme.controlPoints.length - 1;
		buildRamp(explorer, matrices);
		gestureStatus = `Control point ${explorer.theme.controlPoints.length} added`;
		track('theme_spline_point', { action: 'add' });
		draw();
		return true;
	}

	function removeControlPoint(index: number) {
		explorer.theme.controlPoints = explorer.theme.controlPoints.filter((_: unknown, i: number) => i !== index);
		const len = explorer.theme.controlPoints.length;
		explorer.theme.selectedCp = len ? Math.min(index, len - 1) : null;
		buildRamp(explorer, matrices);
		gestureStatus = 'Control point removed';
		track('theme_spline_point', { action: 'remove' });
		draw();
	}

	function nudgeSelectedControlPoint(dx: number, dy: number) {
		const index = explorer.theme.selectedCp;
		if (explorer.theme.mode !== 'spline' || index === null) return false;
		const cp = explorer.theme.controlPoints[index];
		if (!cp) return false;

		const rect = canvas.getBoundingClientRect();
		const world = anchorWorld(cp, explorer, matrices);
		const screen = projectToScreen(world, camera, rect.width, rect.height);
		if (!screen) return false;

		const hit = pick(screen[0] + dx, screen[1] + dy, rect.width, rect.height, explorer, matrices, camera);
		if (!hit) return false;

		explorer.theme.controlPoints[index] = {
			srgbLin: m3.mulV(matrices.toSrgbLin.toSrgb, hit.rgbLin) as [number, number, number]
		};
		buildRamp(explorer, matrices);
		gestureStatus = `Control point ${index + 1} nudged`;
		draw();
		return true;
	}

	function chooseGesture(event: PointerEvent): CanvasGesture {
		if (explorer.theme.mode === 'spline' && explorer.theme.arm !== 'spline-add') {
			const idx = getControlPointAtScreen(event.clientX, event.clientY, event.pointerType);
			if (idx !== null) return { kind: 'drag-control-point', index: idx };
		}
		if (event.pointerType === 'touch') {
			if (touchTool === 'slice' && explorer.slice) return { kind: 'slice-offset', startY: event.clientY, startOff: explorer.off };
			if (touchTool === 'cylinder' && explorer.cylSlice) return { kind: 'cylinder-radius', startX: event.clientX, startRadius: explorer.cylRad };
			if (touchTool === 'pickA' || touchTool === 'pickB') return { kind: 'inspect' };
			return inspectAt(event.clientX, event.clientY) ? { kind: 'inspect' } : { kind: 'orbit' };
		}
		if (event.shiftKey || keys.space) return { kind: 'pan' };
		if (event.altKey && explorer.slice) return { kind: 'slice-offset', startY: event.clientY, startOff: explorer.off };
		if ((event.ctrlKey || event.metaKey) && explorer.cylSlice) return { kind: 'cylinder-radius', startX: event.clientX, startRadius: explorer.cylRad };
		return { kind: 'orbit' };
	}

	function updateStatusForGesture() {
		if (gesture.kind === 'pan') gestureStatus = `Pan target ${camera.target.map((v: number) => v.toFixed(2)).join(' ')}`;
		if (gesture.kind === 'slice-offset') gestureStatus = `Slice offset ${explorer.off.toFixed(2)}`;
		if (gesture.kind === 'cylinder-radius') gestureStatus = `Cylinder radius ${explorer.cylRad.toFixed(3)}`;
	}

	function onPointerDown(event: PointerEvent) {
		if (pinching) return;
		if (event.pointerType === 'touch') event.preventDefault();
		referenceOpen = false;
		dragging = true;
		moved = 0;
		lastX = event.clientX;
		lastY = event.clientY;
		capturedPointerId = event.pointerId;
		canvas.setPointerCapture(event.pointerId);
		gesture = chooseGesture(event);
		if (gesture.kind === 'drag-control-point') {
			explorer.theme.selectedCp = gesture.index;
			draw();
		}
	}

	function onPointerUp(event: PointerEvent) {
		if (pinching) return;
		if (event.pointerType === 'touch') event.preventDefault();
		const completedGesture = gesture.kind;
		dragging = false;
		if (moved < 5 && explorer.theme.mode === 'spline') {
			if (explorer.theme.arm === 'spline-add') {
				addControlPointAt(event.clientX, event.clientY);
			} else if (completedGesture !== 'drag-control-point') {
				// click on empty space (or another point): update selection
				explorer.theme.selectedCp = getControlPointAtScreen(event.clientX, event.clientY, event.pointerType);
				draw();
			}
		} else if (moved < 5) {
			let themed = false;
			if (keys.pickA) themed = setThemeStopAt(event.clientX, event.clientY, 'A');
			else if (keys.pickB) themed = setThemeStopAt(event.clientX, event.clientY, 'B');
			else if (event.pointerType === 'touch' && touchTool === 'pickA') themed = setThemeStopAt(event.clientX, event.clientY, 'A');
			else if (event.pointerType === 'touch' && touchTool === 'pickB') themed = setThemeStopAt(event.clientX, event.clientY, 'B');
			else themed = setThemeStopAt(event.clientX, event.clientY);
			if (!themed && event.pointerType === 'touch') inspectAt(event.clientX, event.clientY);
		} else if (completedGesture === 'drag-control-point') {
			track('theme_spline_point', { action: 'drag' });
		} else if (completedGesture === 'pan') {
			track('canvas_pan', { input: event.pointerType || 'mouse' });
		} else if (completedGesture === 'slice-offset') {
			track('canvas_slice_drag', { input: event.pointerType || 'mouse' });
		} else if (completedGesture === 'cylinder-radius') {
			track('canvas_cylinder_drag', { input: event.pointerType || 'mouse' });
		} else if (completedGesture === 'inspect' && event.pointerType === 'touch') {
			track('canvas_inspect', { input: 'touch' });
		}
		gesture = { kind: 'orbit' };
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
			if (gesture.kind === 'drag-control-point') {
				if (explorer.theme.selectedCp !== null) {
					const rect = canvas.getBoundingClientRect();
					const hit = pick(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height, explorer, matrices, camera);
					if (hit) {
						explorer.theme.controlPoints[explorer.theme.selectedCp] = {
							srgbLin: m3.mulV(matrices.toSrgbLin.toSrgb, hit.rgbLin) as [number, number, number]
						};
						scheduleRampRebuild();
					}
				}
				return;
			}
			if (gesture.kind === 'inspect') {
				inspectAt(event.clientX, event.clientY);
				return;
			}
			if (gesture.kind === 'pan') {
				panCamera(camera, dx, dy, canvas.clientHeight);
				updateStatusForGesture();
				draw();
				return;
			}
			if (gesture.kind === 'slice-offset') {
				explorer.off = clamp(gesture.startOff - (event.clientY - gesture.startY) * 0.003, 0, 1);
				updateStatusForGesture();
				refreshBoundary();
				return;
			}
			if (gesture.kind === 'cylinder-radius') {
				explorer.cylRad = clamp(gesture.startRadius + (event.clientX - gesture.startX) * 0.002, 0, 0.8);
				updateStatusForGesture();
				refreshBoundary();
				return;
			}
			camera.yaw -= dx * 0.008;
			camera.pitch = clamp(camera.pitch + dy * 0.006, -PITCH_LIMIT, PITCH_LIMIT);
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
		gesture = { kind: 'orbit' };
	}

	function onWheel(event: WheelEvent) {
		event.preventDefault();
		if (event.ctrlKey) {
			zoomCamera(1 - event.deltaY * 0.01);
		} else {
			zoomCamera(1 + Math.sign(event.deltaY) * 0.08);
		}
	}

	function onDoubleClick(event: MouseEvent) {
		const hit = inspectAt(event.clientX, event.clientY);
		if (hit) {
			camera.target = hit.world;
			gestureStatus = 'Target centered';
			draw();
		} else {
			resetCamera();
		}
	}

	function isEditableTarget(target: EventTarget | null) {
		const el = target as HTMLElement | null;
		return !!el?.closest('input, select, textarea, [contenteditable="true"]');
	}

	function onKeyDown(event: KeyboardEvent) {
		if (isEditableTarget(event.target)) return;
		if (event.code === 'Space') {
			keys.space = true;
			event.preventDefault();
		}
		if (event.key.toLowerCase() === 'a') keys.pickA = true;
		if (event.key.toLowerCase() === 'b') keys.pickB = true;
		if (event.repeat) return;
		if (event.key === 'Escape') {
			referenceOpen = false;
			explorer.theme.arm = null;
			gestureStatus = null;
		}
		if (
			(event.key === 'Delete' || event.key === 'Backspace') &&
			explorer.theme.mode === 'spline' &&
			explorer.theme.selectedCp !== null
		) {
			event.preventDefault();
			removeControlPoint(explorer.theme.selectedCp);
			return;
		}
		if (
			explorer.theme.mode === 'spline' &&
			explorer.theme.selectedCp !== null &&
			['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
		) {
			const step = event.altKey ? 2 : event.shiftKey ? 16 : 6;
			const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
			const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
			if (nudgeSelectedControlPoint(dx, dy)) {
				event.preventDefault();
				if (!event.repeat) track('theme_spline_point', { action: 'nudge' });
			}
			return;
		}
		if (event.key.toLowerCase() === 'r') resetCamera();
		if (event.key.toLowerCase() === 'x') explorer.slice = !explorer.slice;
		if (event.key.toLowerCase() === 'c') explorer.cylSlice = !explorer.cylSlice;
		if (event.key.toLowerCase() === 'g') explorer.lines = !explorer.lines;
		if (event.key.toLowerCase() === 'o') {
			const next = !(explorer.planeOutline && explorer.cylinderOutline);
			explorer.planeOutline = next;
			explorer.cylinderOutline = next;
		}
		if (event.key === '[') explorer.off = clamp(explorer.off - 0.02, 0, 1);
		if (event.key === ']') explorer.off = clamp(explorer.off + 0.02, 0, 1);
		if (event.key === '-') explorer.cylRad = clamp(explorer.cylRad - 0.02, 0, 0.8);
		if (event.key === '=') explorer.cylRad = clamp(explorer.cylRad + 0.02, 0, 0.8);
	}

	function onKeyUp(event: KeyboardEvent) {
		if (event.code === 'Space') keys.space = false;
		if (event.key.toLowerCase() === 'a') keys.pickA = false;
		if (event.key.toLowerCase() === 'b') keys.pickB = false;
	}

	onMount(() => {
		const touchOpts = { passive: false } as AddEventListenerOptions;
		canvas.addEventListener('touchstart', onTouchStart, touchOpts);
		canvas.addEventListener('touchmove', onTouchMove, touchOpts);
		canvas.addEventListener('touchend', onTouchEnd);
		canvas.addEventListener('touchcancel', onTouchEnd);
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);

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
				window.removeEventListener('keydown', onKeyDown);
				window.removeEventListener('keyup', onKeyUp);
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
				window.removeEventListener('keydown', onKeyDown);
				window.removeEventListener('keyup', onKeyUp);
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
		explorer.autoPerformance;
		explorer.minAverageFps;
		explorer.lines;
		explorer.floor;
		explorer.shell;
		explorer.surfaceGridAlpha;
		explorer.outlineDepthTest;
		untrack(() => {
			resetPerformanceSamples();
			draw();
		});
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
		explorer.theme.splineConstraint;
		explorer.theme.splineSpace;
		explorer.theme.controlPoints.length;
		untrack(() => {
			buildRamp(explorer, matrices);
			draw();
		});
	});

	$effect(() => {
		explorer.theme.stops;
		explorer.theme.selectedCp;
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
	<ViewportToolbar bind:state={explorer} bind:touchTool />
	<canvas
		bind:this={canvas}
		aria-label="Gamut explorer WebGL viewport"
		class={`cursor-${cursorMode}`}
		onpointerdown={onPointerDown}
		onpointerup={onPointerUp}
		onpointermove={onPointerMove}
		onpointercancel={onPointerCancel}
		ondblclick={onDoubleClick}
		onwheel={onWheel}
	></canvas>
	{#if error}
		<div class="viewport-placeholder">{error}</div>
	{/if}
	<div class="hint viewport-help">
		<span class="hint-desktop">drag orbit&nbsp;&nbsp;shift drag pan&nbsp;&nbsp;alt drag slice&nbsp;&nbsp;ctrl drag cylinder</span>
		<span class="hint-mobile">drag orbit&nbsp;&nbsp;pinch zoom&nbsp;&nbsp;touch solid inspect</span>
		<GestureReferencePopover bind:open={referenceOpen} />
	</div>
	{#if gestureStatus}
		<div class="gesture-status">{gestureStatus}</div>
	{/if}
</main>
