<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { selftest } from '$lib/color/selftest';
	import { m3 } from '$lib/color/math';
	import { track } from '$lib/analytics/umami';
	import { getHistoryContext } from '$lib/history/context';
	import { WebGlRenderer } from '$lib/renderer/webgl-renderer';
	import { rebuildMatrices, rebuildShell } from '$lib/renderer/uniforms';
	import { chain, pick } from '$lib/engine/picking';
	import { getObserverModel } from '$lib/color/fundamentals';
	import { activePipeline, anchorWorld, buildRamp } from '$lib/engine/theme';
	import { MAX_CAMERA_DIST, MAX_CAMERA_PITCH, MIN_CAMERA_DIST, panCamera, projectToScreen, resetCamera as resetCameraState } from '$lib/engine/camera';
	import GestureReferencePopover from './GestureReferencePopover.svelte';
	import ViewportToolbar from './ViewportToolbar.svelte';
	import PaletteStrip from './PaletteStrip.svelte';
	import TeachingNote from './TeachingNote.svelte';

	import type { ExplorerState, RampList, SpaceMode, ThemeAnchor } from '$lib/engine/types';
	import type { Camera } from '$lib/engine/camera';
	import type { MorphState } from '$lib/renderer/webgl-renderer';

	export type TouchTool = 'auto' | 'slice' | 'cylinder' | 'add';
	/** A source point under the cursor: which list it belongs to and its index there. */
	type PointHit = { list: number; index: number };
	type CanvasGesture =
		| { kind: 'orbit' }
		| { kind: 'inspect' }
		| { kind: 'pan' }
		| { kind: 'slice-offset'; startY: number; startOff: number }
		| { kind: 'cylinder-radius'; startX: number; startRadius: number }
		| { kind: 'drag-control-point'; point: PointHit };

	let {
		state: explorer = $bindable(),
		camera = $bindable(),
		touchTool = $bindable('auto')
	} = $props<{ state: ExplorerState; camera: Camera; touchTool: TouchTool }>();

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
	let keys = { space: false, addPoint: false };

	const RESOLUTIONS = [64, 128, 192, 256, 512] as const;
	const AUTO_ROTATE_RAD_PER_SEC = 0.09;
	const PERF_SAMPLE_COUNT = 12;
	const PERF_MARGIN = 1.1;
	const PERF_COOLDOWN_MS = 1200;
	const PERF_ACTIVE_STREAM_MS = 250;

	let drawSubmitSamples: number[] = [];
	let drawCadenceSamples: number[] = [];
	let frameCadenceSamples: number[] = [];
	let lastDrawStart = 0;
	let lastFrameTs = 0;
	let frameSamplePending = false;
	let performanceSampleToken = 0;
	let lastAutoPerformanceStep = 0;
	let autoRotateFrame = 0;
	let autoRotatePrev = 0;
	let autoRotateYawOffset = 0;
	let lastCameraSignature = '';
	let reducedMotion = false;

	let morph = $state<MorphState | null>(null);
	let morphRafId = 0;
	let morphPrev = 0;
	let prevSpaceMode: SpaceMode = explorer.spaceMode;
	const MORPH_DURATION_MS = 400;

	const history = getHistoryContext();
	const matrices = $derived(rebuildMatrices(explorer.gamut, explorer.observerModel, explorer.observerLoadedTrigger));
	const shellMatrices = $derived(explorer.hideAids ? null : rebuildShell(explorer.shell, explorer.observerModel, explorer.observerLoadedTrigger));

	$effect(() => {
		const model = explorer.observerModel;
		getObserverModel(model).then(() => {
			explorer.observerLoadedTrigger += 1;
		});
	});
	// All point edits/selection/picking target the active source list.
	const themePoints = $derived(explorer.theme.lists[explorer.theme.activeList]?.anchors ?? []) as ThemeAnchor[];
	const activeRampPipeline = $derived(activePipeline(explorer.theme));
	function setThemePoints(next: ThemeAnchor[]) {
		explorer.theme.lists[explorer.theme.activeList].anchors = next;
	}
	// The exported palette: the 2-D grid when present (Expand, or multiple lists),
	// else the 1-D active ramp as one row.
	const paletteRows = $derived(
		explorer.theme.grid.length
			? explorer.theme.grid
			: explorer.theme.stops.length
				? [explorer.theme.stops]
				: []
	);
	// Idle hover state (mouse only); drives the cursor. Hit-test order:
	// source point (move) -> solid surface (crosshair) -> background (grab/orbit).
	let hoverPoint = $state<PointHit | null>(null);
	let hoverSolid = $state(false);
	let hoverPickPending = false;
	let viewportUpdateQueued = false;
	let pendingBoundaryRebuild = false;
	let pendingSpectralRebuild = false;
	let pendingRampRebuild = false;
	let pendingHoverClear = false;
	const cursorMode = $derived(hoverPoint !== null ? 'point' : hoverSolid ? 'inspect' : gesture.kind);

	function resetPerformanceSamples() {
		drawSubmitSamples = [];
		drawCadenceSamples = [];
		frameCadenceSamples = [];
		lastDrawStart = 0;
		lastFrameTs = 0;
		frameSamplePending = false;
		performanceSampleToken += 1;
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

	function sampleAverage(samples: number[]) {
		return samples.reduce((sum, value) => sum + value, 0) / samples.length;
	}

	function appendSample(samples: number[], value: number) {
		return [...samples.slice(-(PERF_SAMPLE_COUNT - 1)), value];
	}

	function recordDrawPerformance(startMs: number, elapsedMs: number) {
		if (!explorer.autoPerformance) return;
		const targetMs = 1000 / explorer.minAverageFps;

		drawSubmitSamples = appendSample(drawSubmitSamples, elapsedMs);
		if (drawSubmitSamples.length >= PERF_SAMPLE_COUNT) {
			const avgSubmitMs = sampleAverage(drawSubmitSamples);
			if (avgSubmitMs > targetMs * PERF_MARGIN) {
				reduceTessellationForPerformance(avgSubmitMs);
				return;
			}
		}

		if (dragging || pinching) {
			const cadenceMs = lastDrawStart > 0 ? startMs - lastDrawStart : 0;
			if (cadenceMs > 0 && cadenceMs < PERF_ACTIVE_STREAM_MS) {
				drawCadenceSamples = appendSample(drawCadenceSamples, cadenceMs);
				if (drawCadenceSamples.length >= PERF_SAMPLE_COUNT) {
					const avgCadenceMs = sampleAverage(drawCadenceSamples);
					if (avgCadenceMs > targetMs * PERF_MARGIN) reduceTessellationForPerformance(avgCadenceMs);
				}
			}
		}
		lastDrawStart = startMs;
	}

	function scheduleFrameCadenceSample() {
		if (!explorer.autoPerformance || frameSamplePending || (!dragging && !pinching)) return;
		frameSamplePending = true;
		const token = performanceSampleToken;
		requestAnimationFrame((frameTs) => {
			if (token !== performanceSampleToken) return;
			frameSamplePending = false;
			if (!explorer.autoPerformance) return;
			const targetMs = 1000 / explorer.minAverageFps;
			const cadenceMs = lastFrameTs > 0 ? frameTs - lastFrameTs : 0;
			lastFrameTs = frameTs;
			if (cadenceMs <= 0 || cadenceMs >= PERF_ACTIVE_STREAM_MS) return;
			frameCadenceSamples = appendSample(frameCadenceSamples, cadenceMs);
			if (frameCadenceSamples.length < PERF_SAMPLE_COUNT) return;
			const avgFrameMs = sampleAverage(frameCadenceSamples);
			if (avgFrameMs > targetMs * PERF_MARGIN) reduceTessellationForPerformance(avgFrameMs);
		});
	}

	function draw() {
		if (!renderer) return;
		const t0 = performance.now();
		renderer.draw({ state: explorer, matrices, shellMatrices, camera: effectiveCamera(), morph: morph ?? undefined });
		recordDrawPerformance(t0, performance.now() - t0);
		scheduleFrameCadenceSample();
	}

	function scheduleViewportUpdate({
		boundary = false,
		spectral = false,
		ramp = false,
		clearHover = false
	}: {
		boundary?: boolean;
		spectral?: boolean;
		ramp?: boolean;
		clearHover?: boolean;
	} = {}) {
		pendingBoundaryRebuild ||= boundary;
		pendingSpectralRebuild ||= spectral;
		pendingRampRebuild ||= ramp;
		pendingHoverClear ||= clearHover;
		if (viewportUpdateQueued) return;
		viewportUpdateQueued = true;
		requestAnimationFrame(() => {
			viewportUpdateQueued = false;
			const rebuildBoundary = pendingBoundaryRebuild;
			const rebuildSpectral = pendingSpectralRebuild;
			const rebuildRamp = pendingRampRebuild;
			const clearHoverState = pendingHoverClear;
			pendingBoundaryRebuild = false;
			pendingSpectralRebuild = false;
			pendingRampRebuild = false;
			pendingHoverClear = false;
			if (clearHoverState) explorer.hover = null;
			if (rebuildRamp) buildRamp(explorer, matrices);
			if (rebuildBoundary) renderer?.rebuildBoundary(explorer, matrices);
			if (rebuildSpectral) renderer?.rebuildSpectralOverlay(explorer, matrices);
			draw();
		});
	}

	function effectiveCamera(): Camera {
		if (autoRotateYawOffset === 0) return camera;
		return {
			...camera,
			yaw: camera.yaw + autoRotateYawOffset,
			target: [camera.target[0], camera.target[1], camera.target[2]]
		};
	}

	function cameraSignature() {
		return `${camera.yaw}|${camera.pitch}|${camera.dist}|${camera.target.join(',')}|${camera.fov}`;
	}

	function clearAutoRotateOffset() {
		autoRotateYawOffset = 0;
	}

	function bakeAutoRotateOffset() {
		if (autoRotateYawOffset === 0) return;
		camera.yaw += autoRotateYawOffset;
		autoRotateYawOffset = 0;
	}

	function cancelMorph() {
		if (morphRafId) cancelAnimationFrame(morphRafId);
		morphRafId = 0;
		morphPrev = 0;
		morph = null;
	}

	function startMorph(from: SpaceMode, to: SpaceMode) {
		cancelMorph();
		morph = { from, to, t: 0 };
		const step = (ts: number) => {
			const dt = morphPrev > 0 ? (ts - morphPrev) / MORPH_DURATION_MS : 0;
			morphPrev = ts;
			const next = Math.min(1, (morph?.t ?? 0) + dt);
			if (morph) morph.t = next;
			if (next >= 1) {
				morph = null;
				morphRafId = 0;
				morphPrev = 0;
				renderer?.rebuildBoundary(explorer, matrices);
				renderer?.rebuildSpectralOverlay(explorer, matrices);
				draw();
			} else {
				draw();
				morphRafId = requestAnimationFrame(step);
			}
		};
		morphRafId = requestAnimationFrame(step);
	}

	function stopAutoRotateLoop() {
		if (autoRotateFrame) cancelAnimationFrame(autoRotateFrame);
		autoRotateFrame = 0;
		autoRotatePrev = 0;
	}

	function autoRotateLoop(ts: number) {
		autoRotateFrame = requestAnimationFrame(autoRotateLoop);
		if (!renderer || !explorer.autoRotate || reducedMotion || dragging || pinching) {
			autoRotatePrev = ts;
			return;
		}
		const dt = autoRotatePrev > 0 ? (ts - autoRotatePrev) / 1000 : 0;
		autoRotatePrev = ts;
		if (dt <= 0 || dt > 0.25) return;
		autoRotateYawOffset -= dt * AUTO_ROTATE_RAD_PER_SEC;
		draw();
	}

	function startAutoRotateLoop() {
		stopAutoRotateLoop();
		autoRotateFrame = requestAnimationFrame(autoRotateLoop);
	}

	function clamp(value: number, min: number, max: number) {
		return Math.min(max, Math.max(min, value));
	}

	function zoomCamera(factor: number) {
		camera.dist = Math.min(MAX_CAMERA_DIST, Math.max(MIN_CAMERA_DIST, camera.dist * factor));
		draw();
	}

	function resetCamera() {
		clearAutoRotateOffset();
		resetCameraState(camera);
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
		bakeAutoRotateOffset();
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
		const hit = pick(clientX - rect.left, clientY - rect.top, rect.width, rect.height, explorer, matrices, effectiveCamera());
		explorer.hover = hit ? { ...hit, chain: chain(hit.rgbLin, explorer, matrices) } : null;
		draw();
		return hit;
	}

	function scheduleRampRebuild() {
		scheduleViewportUpdate({ ramp: true });
	}

	// Hit-test every list's points so any anchor in the explorer can be grabbed;
	// the selected point of the active list wins ties within the radius.
	function getControlPointAtScreen(clientX: number, clientY: number, pointerType: string): PointHit | null {
		const rect = canvas.getBoundingClientRect();
		const radius = pointerType === 'touch' ? 24 : 12;
		const viewCamera = effectiveCamera();
		let best: PointHit | null = null;
		let bestDist = radius;
		const activeList = explorer.theme.activeList;
		const selected = explorer.theme.selectedPoint;
		explorer.theme.lists.forEach((list: RampList, li: number) => {
			list.anchors.forEach((cp: ThemeAnchor, pi: number) => {
				const world = anchorWorld(cp, explorer, matrices);
				const screen = projectToScreen(world, viewCamera, rect.width, rect.height);
				if (!screen) return;
				const dist = Math.hypot(clientX - rect.left - screen[0], clientY - rect.top - screen[1]);
				if (li === activeList && pi === selected && dist <= radius) {
					bestDist = -1;
					best = { list: li, index: pi };
					return;
				}
				if (bestDist >= 0 && dist < bestDist) {
					bestDist = dist;
					best = { list: li, index: pi };
				}
			});
		});
		return best;
	}

	/** Grabbing a point from another list makes that list active and selects the point. */
	function focusPoint(point: PointHit) {
		explorer.theme.activeList = point.list;
		explorer.theme.selectedPoint = point.index;
	}

	function addControlPointAt(clientX: number, clientY: number) {
		const rect = canvas.getBoundingClientRect();
		const hit = pick(clientX - rect.left, clientY - rect.top, rect.width, rect.height, explorer, matrices, effectiveCamera());
		if (!hit) return false;
		const srgbLin = m3.mulV(matrices.toSrgbLin.toSrgb, hit.rgbLin) as [number, number, number];
		history?.hintLabel('Add point');
		const next = [...themePoints, { srgbLin }];
		setThemePoints(next);
		explorer.theme.selectedPoint = next.length - 1;
		buildRamp(explorer, matrices);
		gestureStatus = `Control point ${next.length} added`;
		track('theme_spline_point', { action: 'add' });
		draw();
		return true;
	}

	function removeControlPoint(index: number) {
		history?.hintLabel('Remove point');
		const next = themePoints.filter((_: unknown, i: number) => i !== index);
		setThemePoints(next);
		explorer.theme.selectedPoint = next.length ? Math.min(index, next.length - 1) : null;
		buildRamp(explorer, matrices);
		gestureStatus = 'Control point removed';
		track('theme_spline_point', { action: 'remove' });
		draw();
	}

	function nudgeSelectedControlPoint(dx: number, dy: number) {
		const index = explorer.theme.selectedPoint;
		if (index === null) return false;
		const cp = themePoints[index];
		if (!cp) return false;

		const rect = canvas.getBoundingClientRect();
		const world = anchorWorld(cp, explorer, matrices);
		const screen = projectToScreen(world, effectiveCamera(), rect.width, rect.height);
		if (!screen) return false;

		const hit = pick(screen[0] + dx, screen[1] + dy, rect.width, rect.height, explorer, matrices, effectiveCamera());
		if (!hit) return false;

		history?.hintLabel('Move point');
		themePoints[index] = {
			srgbLin: m3.mulV(matrices.toSrgbLin.toSrgb, hit.rgbLin) as [number, number, number]
		};
		buildRamp(explorer, matrices);
		gestureStatus = `Control point ${index + 1} nudged`;
		draw();
		return true;
	}

	function chooseGesture(event: PointerEvent): CanvasGesture {
		// Any existing source point — from any list — can be grabbed and dragged.
		if (explorer.theme.arm !== 'add') {
			const point = getControlPointAtScreen(event.clientX, event.clientY, event.pointerType);
			if (point !== null) return { kind: 'drag-control-point', point };
		}
		if (event.pointerType === 'touch') {
			if (touchTool === 'slice' && explorer.slice) return { kind: 'slice-offset', startY: event.clientY, startOff: explorer.off };
			if (touchTool === 'cylinder' && explorer.cylSlice) return { kind: 'cylinder-radius', startX: event.clientX, startRadius: explorer.cylRad };
			if (touchTool === 'add') return { kind: 'inspect' };
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
		hoverPoint = null;
		hoverSolid = false;
		dragging = true;
		moved = 0;
		lastX = event.clientX;
		lastY = event.clientY;
		capturedPointerId = event.pointerId;
		canvas.setPointerCapture(event.pointerId);
		gesture = chooseGesture(event);
		if (gesture.kind === 'orbit' || gesture.kind === 'pan') bakeAutoRotateOffset();
		if (gesture.kind === 'drag-control-point') {
			focusPoint(gesture.point);
			draw();
		}
	}

	function onPointerUp(event: PointerEvent) {
		if (pinching) return;
		if (event.pointerType === 'touch') event.preventDefault();
		const completedGesture = gesture.kind;
		dragging = false;
		if (moved < 5) {
			// Unified click handling: armed/A-key/touch-tool clicks append a point to
			// the active list; a plain click selects or clears.
			if (explorer.theme.arm === 'add' || keys.addPoint || (event.pointerType === 'touch' && touchTool === 'add')) {
				addControlPointAt(event.clientX, event.clientY);
			} else if (completedGesture !== 'drag-control-point') {
				// Click selects an existing source point (switching lists if needed);
				// empty space clears selection (and inspects on touch).
				const point = getControlPointAtScreen(event.clientX, event.clientY, event.pointerType);
				if (point !== null) focusPoint(point);
				else {
					explorer.theme.selectedPoint = null;
					if (event.pointerType === 'touch') inspectAt(event.clientX, event.clientY);
				}
				draw();
			}
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
		if (!dragging) {
			// Idle hover hit-test (mouse only): point -> solid -> background. The
			// solid pick doubles as the live inspect feeding the right sidebar.
			if (event.pointerType === 'touch') return;
			hoverPoint = explorer.theme.showPoints
				? getControlPointAtScreen(event.clientX, event.clientY, event.pointerType)
				: null;
			if (!hoverPickPending) {
				// pick() is a full analytic ray test; bound it to one per frame.
				hoverPickPending = true;
				const cx = event.clientX;
				const cy = event.clientY;
				requestAnimationFrame(() => {
					hoverPickPending = false;
					if (dragging || pinching) return;
					const rect = canvas.getBoundingClientRect();
					const hit = pick(cx - rect.left, cy - rect.top, rect.width, rect.height, explorer, matrices, effectiveCamera());
					hoverSolid = !!hit && hoverPoint === null;
					explorer.hover = hit ? { ...hit, chain: chain(hit.rgbLin, explorer, matrices) } : null;
					draw();
				});
			}
			return;
		}
		if (dragging) {
			if (event.pointerType === 'touch') event.preventDefault();
			const dx = event.clientX - lastX;
			const dy = event.clientY - lastY;
			lastX = event.clientX;
			lastY = event.clientY;
			moved += Math.abs(dx) + Math.abs(dy);
			if (gesture.kind === 'drag-control-point') {
				if (explorer.theme.selectedPoint !== null) {
					const rect = canvas.getBoundingClientRect();
					const hit = pick(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height, explorer, matrices, effectiveCamera());
					if (hit) {
						themePoints[explorer.theme.selectedPoint] = {
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
				return;
			}
			if (gesture.kind === 'cylinder-radius') {
				explorer.cylRad = clamp(gesture.startRadius + (event.clientX - gesture.startX) * 0.002, 0, 0.8);
				updateStatusForGesture();
				return;
			}
			camera.yaw -= dx * 0.008;
			camera.pitch = clamp(camera.pitch + dy * 0.006, -MAX_CAMERA_PITCH, MAX_CAMERA_PITCH);
			draw();
			return;
		}
	}

	function onPointerCancel(event: PointerEvent) {
		if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
		if (capturedPointerId === event.pointerId) capturedPointerId = null;
		dragging = false;
		gesture = { kind: 'orbit' };
	}

	function onWheel(event: WheelEvent) {
		event.preventDefault();
		bakeAutoRotateOffset();
		if (event.ctrlKey) {
			zoomCamera(1 - event.deltaY * 0.01);
		} else {
			zoomCamera(1 + Math.sign(event.deltaY) * 0.08);
		}
	}

	function onDoubleClick(event: MouseEvent) {
		const hit = inspectAt(event.clientX, event.clientY);
		bakeAutoRotateOffset();
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
		if (event.key.toLowerCase() === 'a') keys.addPoint = true;
		if (event.repeat) return;
		if (event.key === 'Escape') {
			referenceOpen = false;
			explorer.theme.arm = null;
			gestureStatus = null;
		}
		if (
			(event.key === 'Delete' || event.key === 'Backspace') &&
			explorer.theme.selectedPoint !== null
		) {
			event.preventDefault();
			removeControlPoint(explorer.theme.selectedPoint);
			return;
		}
		if (
			explorer.theme.selectedPoint !== null &&
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
		if (event.key.toLowerCase() === 'a') keys.addPoint = false;
	}

	onMount(() => {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
			renderer.rebuildSpectralOverlay(explorer, matrices);
			draw();
			startAutoRotateLoop();
			return () => {
				stopAutoRotateLoop();
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
				stopAutoRotateLoop();
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
		stopAutoRotateLoop();
		cancelMorph();
		renderer?.dispose();
		renderer = null;
	});

	$effect(() => {
		explorer.gamut;
		explorer.observerModel;
		explorer.observerLoadedTrigger;
		const currentMode = explorer.spaceMode;
		untrack(() => {
			const from = prevSpaceMode;
			prevSpaceMode = currentMode;
			if (from !== currentMode && !reducedMotion) {
				startMorph(from, currentMode);
				scheduleViewportUpdate({ ramp: true, clearHover: true });
			} else {
				cancelMorph();
				scheduleViewportUpdate({ boundary: true, spectral: true, ramp: true, clearHover: true });
			}
		});
	});

	$effect(() => {
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
		const clipAffectsRamp = explorer.theme.lists.some(
			(list: RampList) =>
				list.pipeline.interpolateOn &&
				(list.pipeline.main.constraint !== 'free' || (list.pipeline.expandOn && list.pipeline.extension.constraint !== 'free'))
		);
		explorer.planeOutline;
		explorer.cylinderOutline;
		untrack(() => {
			scheduleViewportUpdate({ boundary: true, ramp: clipAffectsRamp, clearHover: true });
		});
	});

	$effect(() => {
		explorer.chromaticityOverlay;
		untrack(() => {
			scheduleViewportUpdate({ spectral: true });
		});
	});

	$effect(() => {
		JSON.stringify(explorer.theme.lists.map((list: RampList) => list.pipeline));
		untrack(() => {
			scheduleViewportUpdate({ ramp: true });
		});
	});

	$effect(() => {
		explorer.N;
		untrack(() => {
			resetPerformanceSamples();
			scheduleViewportUpdate({ boundary: true });
		});
	});

	$effect(() => {
		explorer.autoPerformance;
		explorer.minAverageFps;
		explorer.lines;
		explorer.floor;
		explorer.shell;
		explorer.surfaceGridAlpha;
		explorer.solidAlpha;
		explorer.outlineDepthTest;
		explorer.hideAids;
		explorer.theme.showPoints;
		explorer.theme.showCurve;
		explorer.theme.showStops;
		explorer.theme.showPalette;
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
			renderer?.rebuildSpectralOverlay(explorer, matrices);
			draw();
		});
	});

	$effect(() => {
		activeRampPipeline.main.constraint;
		activeRampPipeline.main.projection;
		activeRampPipeline.main.projectionParams.alpha;
		activeRampPipeline.main.projectionParams.focusL;
		activeRampPipeline.main.projectionParams.neutral;
		activeRampPipeline.splineSpace;
		activeRampPipeline.extension.constraint;
		activeRampPipeline.extension.projection;
		activeRampPipeline.extension.projectionParams.alpha;
		activeRampPipeline.extension.projectionParams.focusL;
		activeRampPipeline.extension.projectionParams.neutral;
		explorer.theme.gamutMap;
		explorer.theme.gamutMapParams.alpha;
		explorer.theme.gamutMapParams.focusL;
		explorer.theme.activeList;
		// Track list count and every list's length (add/remove in any list rebuilds).
		JSON.stringify(explorer.theme.lists.map((list: RampList) => list.anchors.length));
		untrack(() => {
			buildRamp(explorer, matrices);
			draw();
		});
	});

	$effect(() => {
		explorer.theme.stops;
		explorer.theme.selectedPoint;
		draw();
	});

	$effect(() => {
		const sig = cameraSignature();
		untrack(() => {
			if (lastCameraSignature && sig !== lastCameraSignature) clearAutoRotateOffset();
			lastCameraSignature = sig;
			draw();
		});
	});
</script>

<main id="main-viewport" class="viewport" tabindex="-1">
	<ViewportToolbar bind:state={explorer} bind:touchTool />
	<canvas
		bind:this={canvas}
		aria-label="Gamut explorer WebGL viewport. Keyboard shortcuts include R to reset camera, Shift plus drag or Space plus drag to pan, X for slice, C for cylinder, G for grid, O for outlines, bracket keys for slice offset, minus and equals for cylinder radius, A to add a ramp point, arrow keys to nudge the selected point, Delete to remove it, and Escape to cancel."
		class={`cursor-${cursorMode}`}
		data-tutorial="viewport-canvas"
		onpointerdown={onPointerDown}
		onpointerup={onPointerUp}
		onpointermove={onPointerMove}
		onpointercancel={onPointerCancel}
		ondblclick={onDoubleClick}
		onwheel={onWheel}
	></canvas>
	{#if explorer.guideNote && explorer.guideNotePlacement === 'overlay'}
		<TeachingNote
			bind:note={explorer.guideNote}
			bind:placement={explorer.guideNotePlacement}
			bind:dismissed={explorer.guideNoteDismissed}
			variant="overlay"
		/>
	{/if}
	{#if explorer.pinPalette && paletteRows.length}
		<div class="pin-overlay">
			<PaletteStrip rows={paletteRows} swatch={16} cvd={explorer.cvd} cvdSev={explorer.cvdSev} ariaLabel="Pinned exported palette" />
		</div>
	{/if}
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
