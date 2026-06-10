<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { createCamera } from '$lib/engine/camera';
	import { selftest } from '$lib/color/selftest';
	import { m3 } from '$lib/color/math';
	import { WebGlRenderer } from '$lib/renderer/webgl-renderer';
	import { rebuildMatrices, rebuildShell } from '$lib/renderer/uniforms';
	import { chain, pick } from '$lib/engine/picking';
	import { buildRamp } from '$lib/engine/theme';
	import ViewportToolbar from './ViewportToolbar.svelte';

	import type { ExplorerState } from '$lib/engine/types';

	let { state: explorer = $bindable() } = $props<{ state: ExplorerState }>();

	let canvas: HTMLCanvasElement;
	let renderer: WebGlRenderer | null = null;
	let error: string | null = $state(null);
	let dragging = false;
	let moved = 0;
	let lastX = 0;
	let lastY = 0;

	const camera = createCamera();
	const matrices = $derived(rebuildMatrices(explorer.gamut));
	const shellMatrices = $derived(rebuildShell(explorer.shell));

	function draw() {
		renderer?.draw({ state: explorer, matrices, shellMatrices, camera });
	}

	function onPointerDown(event: PointerEvent) {
		dragging = true;
		moved = 0;
		lastX = event.clientX;
		lastY = event.clientY;
		canvas.setPointerCapture(event.pointerId);
	}

	function onPointerUp(event: PointerEvent) {
		dragging = false;
		if (moved < 5 && explorer.theme.arm) {
			const rect = canvas.getBoundingClientRect();
			const hit = pick(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height, explorer, matrices, camera);
			if (hit) {
				const arm = explorer.theme.arm;
				explorer.theme[arm] = { srgbLin: m3.mulV(matrices.toSrgbLin.toSrgb, hit.rgbLin) };
				explorer.theme.arm = arm === 'A' ? 'B' : null;
				buildRamp(explorer, matrices);
				draw();
			}
		}
		canvas.releasePointerCapture(event.pointerId);
	}

	function onPointerMove(event: PointerEvent) {
		if (dragging) {
			const dx = event.clientX - lastX;
			const dy = event.clientY - lastY;
			lastX = event.clientX;
			lastY = event.clientY;
			moved += Math.abs(dx) + Math.abs(dy);
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

	function onWheel(event: WheelEvent) {
		event.preventDefault();
		camera.dist = Math.min(8, Math.max(1.2, camera.dist * (1 + Math.sign(event.deltaY) * 0.08)));
		draw();
	}

	onMount(() => {
		try {
			selftest();
			renderer = new WebGlRenderer(canvas);
			const ro = new ResizeObserver(draw);
			ro.observe(canvas);
			renderer.rebuildBoundary(explorer, matrices);
			draw();
			return () => {
				ro.disconnect();
				renderer?.dispose();
				renderer = null;
			};
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
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
		explorer.cylInside;
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
</script>

<main class="viewport">
	<ViewportToolbar bind:state={explorer} />
	<canvas
		bind:this={canvas}
		aria-label="Gamut explorer WebGL viewport"
		onpointerdown={onPointerDown}
		onpointerup={onPointerUp}
		onpointermove={onPointerMove}
		onwheel={onWheel}
	></canvas>
	{#if error}
		<div class="viewport-placeholder">{error}</div>
	{/if}
	<div class="hint">
		drag - orbit&nbsp;&nbsp;wheel - zoom&nbsp;&nbsp;hover solid - inspect chain
	</div>
</main>
