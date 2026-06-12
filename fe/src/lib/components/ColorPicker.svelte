<script lang="ts">
	import { INTERP_SPACES, INTERP_SPACE_KEYS, type InterpSpaceKey } from '$lib/color/interp';
	import { TRC } from '$lib/color/transfer';
	import { srgbHex } from '$lib/engine/theme';

	import type { Vec3 } from '$lib/color/math';

	const PLANE_SIZE = 120;
	const BAR_W = 20;
	const BAR_H = 120;
	const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
	const clamp01 = (v: number) => clamp(v, 0, 1);
	const tuple = (v: Vec3): Vec3 => [v[0], v[1], v[2]];

	let { value, onchange }: { value: Vec3; onchange: (srgbLin: Vec3) => void } = $props();
	let spaceKey = $state<InterpSpaceKey>('okhsv');
	let barAxis = $state(0);
	let coords = $state<Vec3>([0, 0, 0]);
	let hexText = $state('#000000');
	let planeCanvas: HTMLCanvasElement;
	let barCanvas: HTMLCanvasElement;
	let raf = 0;

	const space = $derived(INTERP_SPACES[spaceKey]);
	const planeAxes = $derived(([0, 1, 2] as const).filter((axis) => axis !== barAxis));
	const xAxis = $derived(planeAxes[0]);
	const yAxis = $derived(planeAxes[1]);
	const markerLeft = $derived(`${coordToUnit(coords[xAxis], xAxis) * 100}%`);
	const markerTop = $derived(`${(1 - coordToUnit(coords[yAxis], yAxis)) * 100}%`);
	const barMarkerTop = $derived(`${(1 - coordToUnit(coords[barAxis], barAxis)) * 100}%`);
	const liveText = $derived(`Selected color ${srgbHex(value).toUpperCase()}`);

	function defaultBarAxis(key: InterpSpaceKey) {
		return INTERP_SPACES[key].cyclic ?? 0;
	}

	function coordToUnit(value: number, axis: number) {
		const channel = space.channels[axis];
		return clamp((value - channel.min) / (channel.max - channel.min), 0, 1);
	}

	function unitToCoord(unit: number, axis: number) {
		const channel = space.channels[axis];
		return channel.min + clamp01(unit) * (channel.max - channel.min);
	}

	function rgbToCss(srgbLin: Vec3, inGamut: boolean) {
		const rgb = srgbLin.map((v) => Math.round(TRC.srgb.enc(clamp01(v)) * 255));
		if (inGamut) return rgb;
		return rgb.map((v) => Math.round(v * 0.48 + 18));
	}

	function isInGamut(srgbLin: Vec3) {
		return srgbLin.every((v) => Number.isFinite(v) && v >= -0.00001 && v <= 1.00001);
	}

	function colorAt(nextCoords: Vec3) {
		const raw = space.toSrgbLin(nextCoords);
		const inGamut = isInGamut(raw);
		return { raw, inGamut, clamped: raw.map(clamp01) as Vec3 };
	}

	function commit(nextCoords: Vec3) {
		coords = tuple(nextCoords);
		onchange(colorAt(coords).clamped);
	}

	function scheduleDraw() {
		if (raf) cancelAnimationFrame(raf);
		raf = requestAnimationFrame(() => {
			raf = 0;
			drawPlane();
			drawBar();
		});
	}

	function drawPlane() {
		const ctx = planeCanvas?.getContext('2d', { willReadFrequently: false });
		if (!ctx) return;
		if (planeCanvas.width !== PLANE_SIZE) planeCanvas.width = PLANE_SIZE;
		if (planeCanvas.height !== PLANE_SIZE) planeCanvas.height = PLANE_SIZE;
		const image = ctx.createImageData(PLANE_SIZE, PLANE_SIZE);
		const data = image.data;
		for (let y = 0; y < PLANE_SIZE; y += 1) {
			for (let x = 0; x < PLANE_SIZE; x += 1) {
				const next = tuple(coords);
				next[xAxis] = unitToCoord(x / (PLANE_SIZE - 1), xAxis);
				next[yAxis] = unitToCoord(1 - y / (PLANE_SIZE - 1), yAxis);
				const color = colorAt(next);
				const rgb = rgbToCss(color.raw, color.inGamut);
				const i = (y * PLANE_SIZE + x) * 4;
				data[i] = rgb[0];
				data[i + 1] = rgb[1];
				data[i + 2] = rgb[2];
				data[i + 3] = 255;
			}
		}
		ctx.putImageData(image, 0, 0);
	}

	function drawBar() {
		const ctx = barCanvas?.getContext('2d', { willReadFrequently: false });
		if (!ctx) return;
		if (barCanvas.width !== BAR_W) barCanvas.width = BAR_W;
		if (barCanvas.height !== BAR_H) barCanvas.height = BAR_H;
		const image = ctx.createImageData(BAR_W, BAR_H);
		const data = image.data;
		for (let y = 0; y < BAR_H; y += 1) {
			const next = tuple(coords);
			next[barAxis] = unitToCoord(1 - y / (BAR_H - 1), barAxis);
			const color = colorAt(next);
			const rgb = rgbToCss(color.raw, color.inGamut);
			for (let x = 0; x < BAR_W; x += 1) {
				const i = (y * BAR_W + x) * 4;
				data[i] = rgb[0];
				data[i + 1] = rgb[1];
				data[i + 2] = rgb[2];
				data[i + 3] = 255;
			}
		}
		ctx.putImageData(image, 0, 0);
	}

	function setSpace(next: InterpSpaceKey) {
		spaceKey = next;
		barAxis = defaultBarAxis(next);
		coords = INTERP_SPACES[next].fromSrgbLin(value);
		scheduleDraw();
	}

	function setBarAxis(next: number) {
		barAxis = next;
		scheduleDraw();
	}

	function setPlaneFromPointer(event: PointerEvent) {
		const rect = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect();
		const next = tuple(coords);
		next[xAxis] = unitToCoord((event.clientX - rect.left) / rect.width, xAxis);
		next[yAxis] = unitToCoord(1 - (event.clientY - rect.top) / rect.height, yAxis);
		commit(next);
	}

	function setBarFromPointer(event: PointerEvent) {
		const rect = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect();
		const next = tuple(coords);
		next[barAxis] = unitToCoord(1 - (event.clientY - rect.top) / rect.height, barAxis);
		commit(next);
	}

	function pointerStart(event: PointerEvent, handler: (event: PointerEvent) => void) {
		(event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
		handler(event);
	}

	function keyStep(event: KeyboardEvent) {
		return event.shiftKey ? 0.1 : event.altKey ? 0.005 : 0.01;
	}

	function setAxisFromUnit(axis: number, unit: number) {
		const next = tuple(coords);
		next[axis] = unitToCoord(unit, axis);
		commit(next);
	}

	function nudgeAxis(axis: number, delta: number) {
		setAxisFromUnit(axis, coordToUnit(coords[axis], axis) + delta);
	}

	function onPlaneKeydown(event: KeyboardEvent) {
		const step = keyStep(event);
		if (event.key === 'ArrowLeft') nudgeAxis(xAxis, -step);
		else if (event.key === 'ArrowRight') nudgeAxis(xAxis, step);
		else if (event.key === 'ArrowUp') nudgeAxis(yAxis, step);
		else if (event.key === 'ArrowDown') nudgeAxis(yAxis, -step);
		else if (event.key === 'Home') setAxisFromUnit(xAxis, 0);
		else if (event.key === 'End') setAxisFromUnit(xAxis, 1);
		else if (event.key === 'PageUp') nudgeAxis(yAxis, 0.1);
		else if (event.key === 'PageDown') nudgeAxis(yAxis, -0.1);
		else return;
		event.preventDefault();
	}

	function onBarKeydown(event: KeyboardEvent) {
		const step = keyStep(event);
		if (event.key === 'ArrowUp') nudgeAxis(barAxis, step);
		else if (event.key === 'ArrowDown') nudgeAxis(barAxis, -step);
		else if (event.key === 'PageUp') nudgeAxis(barAxis, 0.1);
		else if (event.key === 'PageDown') nudgeAxis(barAxis, -0.1);
		else if (event.key === 'Home') setAxisFromUnit(barAxis, 0);
		else if (event.key === 'End') setAxisFromUnit(barAxis, 1);
		else return;
		event.preventDefault();
	}

	function parseHex(text: string): Vec3 | null {
		const hex = text.trim().replace(/^#/, '');
		const expanded =
			hex.length === 3
				? hex
						.split('')
						.map((c) => c + c)
						.join('')
				: hex;
		if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;
		return [0, 2, 4].map((i) => TRC.srgb.dec(parseInt(expanded.slice(i, i + 2), 16) / 255)) as Vec3;
	}

	function editHex(text: string) {
		hexText = text;
		const rgb = parseHex(text);
		if (rgb) onchange(rgb);
	}

	$effect(() => {
		coords = space.fromSrgbLin(value);
		hexText = srgbHex(value).toUpperCase();
		scheduleDraw();
	});
</script>

<div class="picker">
	<div class="picker-controls">
		<label>
			<span>Space</span>
			<select value={spaceKey} onchange={(event) => setSpace((event.currentTarget as HTMLSelectElement).value as InterpSpaceKey)}>
				{#each INTERP_SPACE_KEYS as key}
					<option value={key}>{INTERP_SPACES[key].label}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Bar</span>
			<select value={barAxis} onchange={(event) => setBarAxis(Number((event.currentTarget as HTMLSelectElement).value))}>
				{#each space.channels as channel, i}
					<option value={i}>{channel.name}</option>
				{/each}
			</select>
		</label>
	</div>
	<div class="picker-main">
		<div class="plane-wrap">
			<canvas
				bind:this={planeCanvas}
				class="plane"
				tabindex="0"
				aria-label={`${space.channels[xAxis].name} by ${space.channels[yAxis].name} color plane. Use arrow keys to adjust, Shift for larger steps, Alt for finer steps, Home and End for the horizontal axis, Page Up and Page Down for the vertical axis.`}
				aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown Home End PageUp PageDown"
				onpointerdown={(event) => pointerStart(event, setPlaneFromPointer)}
				onpointermove={(event) => {
					if (event.buttons & 1) setPlaneFromPointer(event);
				}}
				onkeydown={onPlaneKeydown}
			></canvas>
			<span class="plane-marker" style={`left: ${markerLeft}; top: ${markerTop}`}></span>
		</div>
		<div class="bar-wrap">
			<canvas
				bind:this={barCanvas}
				class="bar"
				tabindex="0"
				aria-label={`${space.channels[barAxis].name} color bar. Use up and down arrows to adjust, Shift for larger steps, Alt for finer steps, Home for minimum, and End for maximum.`}
				aria-keyshortcuts="ArrowUp ArrowDown Shift+ArrowUp Shift+ArrowDown Alt+ArrowUp Alt+ArrowDown Home End PageUp PageDown"
				onpointerdown={(event) => pointerStart(event, setBarFromPointer)}
				onpointermove={(event) => {
					if (event.buttons & 1) setBarFromPointer(event);
				}}
				onkeydown={onBarKeydown}
			></canvas>
			<span class="bar-marker" style={`top: ${barMarkerTop}`}></span>
		</div>
	</div>
	<div class="hex-row">
		<span class="swatch" style={`background: ${srgbHex(value)}`}></span>
		<input
			aria-label="Hex color"
			spellcheck="false"
			value={hexText}
			oninput={(event) => editHex((event.currentTarget as HTMLInputElement).value)}
			onblur={() => (hexText = srgbHex(value).toUpperCase())}
		/>
	</div>
	<p class="picker-live" aria-live="polite">{liveText}</p>
</div>

<style>
	.picker {
		display: grid;
		gap: 8px;
		padding: 8px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: color-mix(in srgb, var(--panel) 88%, black);
	}
	.picker-controls {
		display: grid;
		grid-template-columns: 1fr 92px;
		gap: 8px;
	}
	label {
		display: grid;
		gap: 3px;
		color: var(--muted);
		font-size: 0.769rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	select,
	input {
		width: 100%;
		min-width: 0;
	}
	.picker-main {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 20px;
		gap: 8px;
		align-items: stretch;
	}
	.plane-wrap,
	.bar-wrap {
		position: relative;
		min-width: 0;
		touch-action: none;
	}
	.plane {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		border-radius: 4px;
		border: 1px solid rgba(255, 255, 255, 0.16);
		image-rendering: auto;
		cursor: crosshair;
	}
	.bar {
		display: block;
		width: 20px;
		height: 100%;
		border-radius: 4px;
		border: 1px solid rgba(255, 255, 255, 0.16);
		cursor: ns-resize;
	}
	.plane:focus-visible,
	.bar:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.plane-marker,
	.bar-marker {
		position: absolute;
		pointer-events: none;
		transform: translate(-50%, -50%);
	}
	.plane-marker {
		width: 13px;
		height: 13px;
		border: 2px solid white;
		border-radius: 999px;
		box-shadow:
			0 0 0 1px black,
			0 1px 4px rgba(0, 0, 0, 0.45);
	}
	.bar-marker {
		left: 50%;
		width: 26px;
		height: 3px;
		border-radius: 999px;
		background: white;
		box-shadow: 0 0 0 1px black;
		transform: translate(-50%, -50%);
	}
	.hex-row {
		display: grid;
		grid-template-columns: 22px 1fr;
		gap: 8px;
		align-items: center;
	}
	.swatch {
		width: 22px;
		height: 22px;
		border-radius: 4px;
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.3),
			0 0 0 1px rgba(0, 0, 0, 0.35);
	}
	.picker-live {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}
</style>
