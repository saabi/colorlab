import { cross3, dot3, m3, m3gl, norm3, type Mat3, type Vec3 } from '$lib/color/math';
import { CVD, simulateCvdSrgb } from '$lib/color/cvd';
import { CUBE_ROT, CUBE_ROTi, LMS2RGB, RGB2LMS, REC709_Y, lsrgb2oklab, waveToXyz, xyz2lab } from '$lib/color/pipeline';
import { TRC } from '$lib/color/transfer';
import { planeND } from '$lib/engine/plane';
import { camEye, lookAt, persp, type Camera } from '$lib/engine/camera';
import { FS_FLOOR, FS_LINE, FS_MARK, FS_SOLID, FS_SPLINE, VS_FLOOR, VS_LINE, VS_MARK, VS_SOLID, VS_SPLINE } from './shaders';

import type { ExplorerState, SpaceMode } from '$lib/engine/types';
import type { DerivedMatrices } from './uniforms';

export type MorphState = { from: SpaceMode; to: SpaceMode; t: number };

interface DrawInput {
	state: ExplorerState;
	matrices: DerivedMatrices;
	shellMatrices: DerivedMatrices | null;
	camera: Camera;
	morph?: MorphState;
}

function smoothstep(edge0: number, edge1: number, x: number) {
	const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

export class WebGlRenderer {
	private gl: WebGL2RenderingContext;
	private solidProgram: WebGLProgram;
	private floorProgram: WebGLProgram;
	private lineProgram: WebGLProgram;
	private markProgram: WebGLProgram;
	private solidVao: WebGLVertexArrayObject;
	private solidBuffer: WebGLBuffer;
	private floorVao: WebGLVertexArrayObject;
	private floorBuffer: WebGLBuffer;
	private lineVao: WebGLVertexArrayObject;
	private lineBuffer: WebGLBuffer;
	private lineVertCount = 0;
	private splineProgram: WebGLProgram;
	private splineVao: WebGLVertexArrayObject;
	private splineBuffer: WebGLBuffer;
	private spectralVao: WebGLVertexArrayObject;
	private spectralBuffer: WebGLBuffer;
	private spectralIndexBuffer: WebGLBuffer;
	private spectralSurfaceIndexCount = 0;
	private spectralRimOffset = 0;
	private spectralRimCount = 0;
	private spectralPurplesOffset = 0;
	private dpr = 1;

	private static readonly SPECTRAL_NM_MIN = 402;
	private static readonly SPECTRAL_NM_MAX = 682;
	private static readonly SPECTRAL_NM_STEP = 2;

	constructor(private canvas: HTMLCanvasElement) {
		const gl = canvas.getContext('webgl2', { antialias: true });
		if (!gl) throw new Error('WebGL2 unavailable');
		this.gl = gl;
		this.solidProgram = this.compile(VS_SOLID, FS_SOLID);
		this.floorProgram = this.compile(VS_FLOOR, FS_FLOOR);
		this.lineProgram = this.compile(VS_LINE, FS_LINE);
		this.markProgram = this.compile(VS_MARK, FS_MARK);
		this.splineProgram = this.compile(VS_SPLINE, FS_SPLINE);
		const spline = this.createSplineVao();
		this.splineVao = spline.vao;
		this.splineBuffer = spline.buffer;
		const spectral = this.createSpectralVao();
		this.spectralVao = spectral.vao;
		this.spectralBuffer = spectral.buffer;
		this.spectralIndexBuffer = spectral.indexBuffer;
		const solid = this.createSolidVao();
		this.solidVao = solid.vao;
		this.solidBuffer = solid.buffer;
		const floor = this.createFloorVao();
		this.floorVao = floor.vao;
		this.floorBuffer = floor.buffer;
		const line = this.createLineVao();
		this.lineVao = line.vao;
		this.lineBuffer = line.buffer;
	}

	resize() {
		this.dpr = Math.min(window.devicePixelRatio || 1, 2);
		const w = Math.max(1, Math.round(this.canvas.clientWidth * this.dpr));
		const h = Math.max(1, Math.round(this.canvas.clientHeight * this.dpr));
		if (this.canvas.width !== w || this.canvas.height !== h) {
			this.canvas.width = w;
			this.canvas.height = h;
		}
	}

	draw(input: DrawInput) {
		const { gl } = this;
		this.resize();
		gl.viewport(0, 0, this.canvas.width, this.canvas.height);
		gl.clearColor(0.039, 0.039, 0.043, 1);
		gl.enable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		const aspect = this.canvas.width / this.canvas.height;
		const proj = persp(input.camera.fov, aspect, 0.05, 40);
		const view = lookAt(camEye(input.camera), input.camera.target, [0, 1, 0]);

		const morph = input.morph;
		const morphFrom = morph?.from ?? input.state.spaceMode;
		const morphTo = morph?.to ?? input.state.spaceMode;
		const morphT = morph?.t ?? 1.0;

		if (input.shellMatrices) {
			gl.useProgram(this.solidProgram);
			gl.bindVertexArray(this.solidVao);
			this.uploadSolidUniforms(input.state, input.shellMatrices, proj, view, 1, 96, 0, 0, 0, 0, 0, morphFrom, morphTo, morphT);
			gl.disable(gl.DEPTH_TEST);
			gl.depthMask(false);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 6 * 96 * 96);
			gl.disable(gl.BLEND);
			gl.enable(gl.DEPTH_TEST);
			gl.depthMask(true);
		}

		gl.useProgram(this.solidProgram);
		gl.bindVertexArray(this.solidVao);
		this.uploadSolidUniforms(input.state, input.matrices, proj, view, 0, input.state.N, 0, 0, 0, 0, 0, morphFrom, morphTo, morphT);
		const solidAlpha = input.state.solidAlpha;
		const solidInstances = 6 * input.state.N * input.state.N;
		if (solidAlpha < 1) {
			// Translucent solid: a depth pre-pass records the nearest surface, then the
			// color pass (LEQUAL, no depth write) blends exactly one front layer — back
			// faces and stacked layers are depth-rejected, so no out-of-order blending
			// artifacts regardless of mesh winding or concave cuts. Ramp aids are drawn
			// later with depth testing off (see below) so they stay visible through it.
			gl.colorMask(false, false, false, false);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, solidInstances);
			gl.colorMask(true, true, true, true);
			gl.uniform1f(this.U(this.solidProgram, 'uAlpha'), solidAlpha);
			gl.depthFunc(gl.LEQUAL);
			gl.depthMask(false);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, solidInstances);
			gl.disable(gl.BLEND);
			gl.depthMask(true);
			gl.depthFunc(gl.LESS);
		} else {
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, solidInstances);
		}

		if (input.state.lines && !input.state.hideAids) {
			gl.depthMask(false);
			gl.depthFunc(gl.LEQUAL);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			gl.enable(gl.POLYGON_OFFSET_FILL);
			gl.polygonOffset(-1, -1);
			this.uploadSolidUniforms(
				input.state,
				input.matrices,
				proj,
				view,
				0,
				input.state.N,
					1,
					1,
					0,
					input.state.surfaceGridAlpha,
					1,
					morphFrom, morphTo, morphT
				);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 6 * input.state.N * input.state.N);
			if (input.state.slice || input.state.cylSlice) {
				this.uploadSolidUniforms(input.state, input.matrices, proj, view, 0, input.state.N, 1, 1, 1, 0, 0, morphFrom, morphTo, morphT);
				gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 6 * input.state.N * input.state.N);
			}
			gl.disable(gl.POLYGON_OFFSET_FILL);
			gl.disable(gl.BLEND);
			gl.depthFunc(gl.LESS);
			gl.depthMask(true);
		}

		if (input.state.floor) {
			gl.useProgram(this.floorProgram);
			gl.bindVertexArray(this.floorVao);
			gl.uniformMatrix4fv(this.U(this.floorProgram, 'uProj'), false, proj);
			gl.uniformMatrix4fv(this.U(this.floorProgram, 'uView'), false, view);
			gl.uniform1f(this.U(this.floorProgram, 'uY'), -0.502);
			gl.depthMask(false);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			gl.disable(gl.BLEND);
			gl.depthMask(true);
		}

		if (this.spectralRimCount > 0 && !input.state.hideAids && input.state.chromaticityOverlay !== 'off' && !morph) {
			gl.useProgram(this.splineProgram);
			gl.bindVertexArray(this.spectralVao);
			gl.uniformMatrix4fv(this.U(this.splineProgram, 'uProj'), false, proj);
			gl.uniformMatrix4fv(this.U(this.splineProgram, 'uView'), false, view);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE);
			if (this.spectralSurfaceIndexCount > 0) {
				gl.enable(gl.DEPTH_TEST);
				gl.depthMask(false);
				gl.drawElements(gl.TRIANGLES, this.spectralSurfaceIndexCount, gl.UNSIGNED_SHORT, 0);
				gl.depthMask(true);
			}
			gl.disable(gl.DEPTH_TEST);
			gl.depthMask(false);
			gl.drawArrays(gl.LINE_STRIP, this.spectralRimOffset, this.spectralRimCount);
			gl.drawArrays(gl.LINES, this.spectralPurplesOffset, 2);
			gl.depthMask(true);
			gl.enable(gl.DEPTH_TEST);
			gl.disable(gl.BLEND);
			gl.bindVertexArray(null);
		}

		// With a translucent solid its pre-pass depth would occlude markers/curves
		// inside it; draw all ramp aids depth-test-off so they show through the glass.
		const aidsThroughGlass = solidAlpha < 1;
		if (aidsThroughGlass) gl.disable(gl.DEPTH_TEST);

		if (input.state.hover && !morph) {
			gl.useProgram(this.markProgram);
			gl.uniformMatrix4fv(this.U(this.markProgram, 'uProj'), false, proj);
			gl.uniformMatrix4fv(this.U(this.markProgram, 'uView'), false, view);
			gl.uniform1f(this.U(this.markProgram, 'uSize'), 11);
			gl.uniform3fv(this.U(this.markProgram, 'uPos'), input.state.hover.world);
			gl.uniform3fv(this.U(this.markProgram, 'uCol'), input.state.hover.inGamut ? [0.37, 0.72, 0.77] : [0.88, 0.33, 0.24]);
			gl.uniform3fv(this.U(this.markProgram, 'uBorder'), [1, 1, 1]);
			gl.drawArrays(gl.POINTS, 0, 1);
		}

		// Generated ramp swatches: placed stops, and (when expanded) every palette cell.
		// Each layer is independently toggleable from its producing pipeline step.
		const t = input.state.theme;
		const drawSwatches = (swatches: { world: [number, number, number]; srgbLin: [number, number, number] }[], size: number) => {
			gl.useProgram(this.markProgram);
			gl.uniformMatrix4fv(this.U(this.markProgram, 'uProj'), false, proj);
			gl.uniformMatrix4fv(this.U(this.markProgram, 'uView'), false, view);
			gl.uniform1f(this.U(this.markProgram, 'uSize'), size);
			for (const s of swatches) {
				const sim = simulateCvdSrgb(s.srgbLin, input.state.cvd, input.state.cvdSev);
				const c = sim.map((v) => TRC.srgb.enc(Math.min(Math.max(v, 0), 1)));
				const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
				const border = 1 - smoothstep(0.42, 0.72, y);
				gl.uniform3fv(this.U(this.markProgram, 'uPos'), s.world);
				gl.uniform3fv(this.U(this.markProgram, 'uCol'), c);
				gl.uniform3fv(this.U(this.markProgram, 'uBorder'), [border, border, border]);
				gl.drawArrays(gl.POINTS, 0, 1);
			}
		};
		// The master "hide overlay aids" toggle suppresses ramp overlays too;
		// per-step show* flags give finer control when aids are shown.
		// Overlays are suppressed during morph (world positions are stale until rebuilt).
		const aids = !input.state.hideAids && !morph;
		// Placed stops draw for every list (each list is its own ramp).
		if (aids && t.showStops) {
			for (const row of t.rows) if (row.length) drawSwatches(row, 11);
		}
		// Expanded palette cells. Without Expand the grid is just the lists' ramps,
		// already drawn above as stops + curves — skip to avoid double markers.
		if (aids && t.showPalette && t.expandOn && t.grid.length) {
			for (const row of t.grid) drawSwatches(row, 7);
			// Each grid row is its own ramp: draw a faint polyline through its stops.
			gl.useProgram(this.splineProgram);
			gl.bindVertexArray(this.splineVao);
			gl.bindBuffer(gl.ARRAY_BUFFER, this.splineBuffer);
			gl.uniformMatrix4fv(this.U(this.splineProgram, 'uProj'), false, proj);
			gl.uniformMatrix4fv(this.U(this.splineProgram, 'uView'), false, view);
			const DIM = 0.45;
			for (const row of t.grid) {
				if (row.length < 2) continue;
				const data = new Float32Array(row.length * 6);
				for (let i = 0; i < row.length; i += 1) {
					const sim = simulateCvdSrgb(row[i].srgbLin, input.state.cvd, input.state.cvdSev);
					const o = i * 6;
					data[o] = row[i].world[0];
					data[o + 1] = row[i].world[1];
					data[o + 2] = row[i].world[2];
					data[o + 3] = TRC.srgb.enc(Math.min(Math.max(sim[0], 0), 1)) * DIM;
					data[o + 4] = TRC.srgb.enc(Math.min(Math.max(sim[1], 0), 1)) * DIM;
					data[o + 5] = TRC.srgb.enc(Math.min(Math.max(sim[2], 0), 1)) * DIM;
				}
				gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
				gl.drawArrays(gl.LINE_STRIP, 0, row.length);
			}
			gl.bindVertexArray(null);
		}

		// Draw source-point markers and interpolated curves for every list; which
		// layers actually render is gated per-layer inside drawSpline.
		if (aids && (t.lists.some((l) => l.length) || t.curves.some((c) => c.length > 1))) {
			this.drawSpline(input, proj, view);
		}

		if (aidsThroughGlass) gl.enable(gl.DEPTH_TEST);

		if (this.lineVertCount > 0 && !input.state.hideAids && input.state.slice && (input.state.planeOutline || input.state.cylinderOutline) && !morph) {
			gl.useProgram(this.lineProgram);
			gl.bindVertexArray(this.lineVao);
			gl.uniformMatrix4fv(this.U(this.lineProgram, 'uProj'), false, proj);
			gl.uniformMatrix4fv(this.U(this.lineProgram, 'uView'), false, view);
			gl.uniform3fv(this.U(this.lineProgram, 'uCol'), [0.94, 0.94, 0.96]);
			if (!input.state.outlineDepthTest) gl.disable(gl.DEPTH_TEST);
			gl.drawArrays(gl.LINES, 0, this.lineVertCount);
			if (!input.state.outlineDepthTest) gl.enable(gl.DEPTH_TEST);
		}
		gl.bindVertexArray(null);
	}

	rebuildBoundary(state: ExplorerState, matrices: DerivedMatrices) {
		this.lineVertCount = 0;
		if (!state.slice || (!state.planeOutline && !state.cylinderOutline)) return;
		const { gl } = this;
		const { n, d } = planeND(state);
		const ref: Vec3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
		const u = norm3(cross3(n, ref));
		const v = cross3(n, u);
		const segs: number[] = [];
		if (state.planeOutline) {
			if (!state.cylSlice && (state.spaceMode === 0 || state.spaceMode === 1 || state.spaceMode === 5)) {
				this.buildAffinePlaneOutline(state, matrices, n, d, u, v, segs);
			} else {
				this.buildFacePlaneOutline(state, matrices, n, d, segs);
			}
		}
		if (state.cylSlice && state.cylinderOutline) {
			const R = state.cylRad;
			if (Math.abs(n[1]) >= 1e-4) {
				const pts: Vec3[] = [];
				const steps = 64;
				for (let i = 0; i <= steps; i += 1) {
					const th = (i * 2 * Math.PI) / steps;
					const cx = R * Math.cos(th);
					const cz = R * Math.sin(th);
					const cy = (d - R * (n[0] * Math.cos(th) + n[2] * Math.sin(th))) / n[1];
					pts.push([cx, cy, cz]);
				}
				for (let i = 0; i < steps; i += 1) {
					segs.push(...pts[i], ...pts[i + 1]);
				}
			} else {
				const dist = Math.abs(d);
				if (R > dist) {
					const h = Math.sqrt(R * R - d * d);
					const px = d * n[0];
					const pz = d * n[2];
					const vx = -n[2];
					const vz = n[0];
					const q1x = px + h * vx;
					const q1z = pz + h * vz;
					const q2x = px - h * vx;
					const q2z = pz - h * vz;
					segs.push(q1x, -0.5, q1z, q1x, 0.5, q1z);
					segs.push(q2x, -0.5, q2z, q2x, 0.5, q2z);
				}
			}
		}
		gl.bindVertexArray(this.lineVao);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(segs), gl.DYNAMIC_DRAW);
		gl.bindVertexArray(null);
		this.lineVertCount = segs.length / 3;
	}

	private buildAffinePlaneOutline(
		state: ExplorerState,
		matrices: DerivedMatrices,
		n: Vec3,
		d: number,
		u: Vec3,
		v: Vec3,
		segs: number[]
	) {
		const verts: Vec3[] = [];
		for (let r = 0; r <= 1; r += 1) {
			for (let g = 0; g <= 1; g += 1) {
				for (let b = 0; b <= 1; b += 1) verts.push(this.rgbToWorld([r, g, b], state, matrices));
			}
		}
		const edges = [
			[0, 1],
			[0, 2],
			[0, 4],
			[1, 3],
			[1, 5],
			[2, 3],
			[2, 6],
			[3, 7],
			[4, 5],
			[4, 6],
			[5, 7],
			[6, 7]
		];
		const pts: Vec3[] = [];
		const add = (p: Vec3) => {
			if (!pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 1e-5)) pts.push(p);
		};
		for (const [ia, ib] of edges) {
			const a = verts[ia];
			const b = verts[ib];
			const sa = dot3(a, n) - d;
			const sb = dot3(b, n) - d;
			if (Math.abs(sa) < 1e-6) add(a);
			if (Math.abs(sb) < 1e-6) add(b);
			if (sa * sb < 0) {
				const t = sa / (sa - sb);
				add([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
			}
		}
		if (pts.length < 2) return;
		const c: Vec3 = [
			pts.reduce((sum, p) => sum + p[0], 0) / pts.length,
			pts.reduce((sum, p) => sum + p[1], 0) / pts.length,
			pts.reduce((sum, p) => sum + p[2], 0) / pts.length
		];
		pts.sort((a, b) => {
			const aa = Math.atan2(dot3([a[0] - c[0], a[1] - c[1], a[2] - c[2]], v), dot3([a[0] - c[0], a[1] - c[1], a[2] - c[2]], u));
			const bb = Math.atan2(dot3([b[0] - c[0], b[1] - c[1], b[2] - c[2]], v), dot3([b[0] - c[0], b[1] - c[1], b[2] - c[2]], u));
			return aa - bb;
		});
		for (let i = 0; i < pts.length; i += 1) segs.push(...pts[i], ...pts[(i + 1) % pts.length]);
	}

	private buildFacePlaneOutline(state: ExplorerState, matrices: DerivedMatrices, n: Vec3, d: number, segs: number[]) {
		const N = 112;
		const sample = (face: number, i: number, j: number) => {
			const rgb = this.faceRgb(face, i / N, j / N);
			const world = this.rgbToWorld(rgb, state, matrices);
			return { world, s: dot3(world, n) - d };
		};
		const insideCylinder = (p: Vec3) => {
			if (!state.cylSlice) return true;
			const r = Math.hypot(p[0], p[2]);
			return r <= state.cylRad + 1e-4;
		};
		const edgePoint = (a: { world: Vec3; s: number }, b: { world: Vec3; s: number }) => {
			const t = Math.abs(a.s - b.s) < 1e-9 ? 0.5 : a.s / (a.s - b.s);
			return [
				a.world[0] + (b.world[0] - a.world[0]) * t,
				a.world[1] + (b.world[1] - a.world[1]) * t,
				a.world[2] + (b.world[2] - a.world[2]) * t
			] as Vec3;
		};
		for (let face = 0; face < 6; face += 1) {
			let prevRow = Array.from({ length: N + 1 }, (_, i) => sample(face, i, 0));
			for (let j = 0; j < N; j += 1) {
				const nextRow = Array.from({ length: N + 1 }, (_, i) => sample(face, i, j + 1));
				for (let i = 0; i < N; i += 1) {
					const p00 = prevRow[i];
					const p10 = prevRow[i + 1];
					const p01 = nextRow[i];
					const p11 = nextRow[i + 1];
					const pts: Vec3[] = [];
					if (p00.s * p10.s <= 0 && p00.s !== p10.s) pts.push(edgePoint(p00, p10));
					if (p10.s * p11.s <= 0 && p10.s !== p11.s) pts.push(edgePoint(p10, p11));
					if (p01.s * p11.s <= 0 && p01.s !== p11.s) pts.push(edgePoint(p01, p11));
					if (p00.s * p01.s <= 0 && p00.s !== p01.s) pts.push(edgePoint(p00, p01));
					for (let k = 0; k + 1 < pts.length; k += 2) {
						const mid: Vec3 = [(pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2, (pts[k][2] + pts[k + 1][2]) / 2];
						if (insideCylinder(mid)) segs.push(...pts[k], ...pts[k + 1]);
					}
				}
				prevRow = nextRow;
			}
		}
	}

	private drawSpline(input: DrawInput, proj: Float32Array, view: Float32Array) {
		const { gl } = this;
		const t = input.state.theme;
		if (t.showCurve && t.curves.some((c) => c.length > 1)) {
			gl.useProgram(this.splineProgram);
			gl.bindVertexArray(this.splineVao);
			gl.bindBuffer(gl.ARRAY_BUFFER, this.splineBuffer);
			gl.uniformMatrix4fv(this.U(this.splineProgram, 'uProj'), false, proj);
			gl.uniformMatrix4fv(this.U(this.splineProgram, 'uView'), false, view);
			for (const curve of t.curves) {
				if (curve.length < 2) continue;
				const data = new Float32Array(curve.length * 6);
				for (let i = 0; i < curve.length; i += 1) {
					const s = curve[i];
					const sim = simulateCvdSrgb(s.srgbLin, input.state.cvd, input.state.cvdSev);
					const o = i * 6;
					data[o] = s.world[0];
					data[o + 1] = s.world[1];
					data[o + 2] = s.world[2];
					data[o + 3] = TRC.srgb.enc(Math.min(Math.max(sim[0], 0), 1));
					data[o + 4] = TRC.srgb.enc(Math.min(Math.max(sim[1], 0), 1));
					data[o + 5] = TRC.srgb.enc(Math.min(Math.max(sim[2], 0), 1));
				}
				gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
				gl.drawArrays(gl.LINE_STRIP, 0, curve.length);
			}
			gl.bindVertexArray(null);
		}

		if (t.showPoints && t.lists.some((l) => l.length)) {
			gl.useProgram(this.markProgram);
			gl.uniformMatrix4fv(this.U(this.markProgram, 'uProj'), false, proj);
			gl.uniformMatrix4fv(this.U(this.markProgram, 'uView'), false, view);
			// Source points read larger than generated stops/cells to signal interactivity.
			gl.uniform1f(this.U(this.markProgram, 'uSize'), 16);
			t.lists.forEach((cps, li) => {
				for (let i = 0; i < cps.length; i += 1) {
					const world = this.worldForSrgbMorph(cps[i].srgbLin, input.state, input.matrices, input.morph);
					const sim = simulateCvdSrgb(cps[i].srgbLin, input.state.cvd, input.state.cvdSev);
					const c = sim.map((v) => TRC.srgb.enc(Math.min(Math.max(v, 0), 1)));
					// Selection ring only applies inside the active list.
					const selected = li === t.activeList && i === t.selectedPoint;
					gl.uniform3fv(this.U(this.markProgram, 'uPos'), world);
					gl.uniform3fv(this.U(this.markProgram, 'uCol'), c);
					gl.uniform3fv(this.U(this.markProgram, 'uBorder'), selected ? [1, 0.85, 0.3] : [1, 1, 1]);
					gl.drawArrays(gl.POINTS, 0, 1);
				}
			});
		}
	}

	private faceRgb(face: number, u: number, v: number): Vec3 {
		if (face === 0) return [0, u, v];
		if (face === 1) return [1, u, v];
		if (face === 2) return [u, 0, v];
		if (face === 3) return [u, 1, v];
		if (face === 4) return [u, v, 0];
		return [u, v, 1];
	}

	private rgbToWorldMode(rgb: Vec3, mode: SpaceMode, matrices: DerivedMatrices): Vec3 {
		if (mode === 0) return m3.mulV(CUBE_ROT, [rgb[0] - 0.5, rgb[1] - 0.5, rgb[2] - 0.5]);
		if (mode === 5) {
			const p = m3.mulV(CUBE_ROT, [rgb[0] - 0.5, rgb[1] - 0.5, rgb[2] - 0.5]);
			return [p[0], REC709_Y[0] * rgb[0] + REC709_Y[1] * rgb[1] + REC709_Y[2] * rgb[2] - 0.5, p[2]];
		}
		const xyz = m3.mulV(matrices.rgb2xyz, rgb);
		if (mode === 1) return [xyz[0] - 0.48, xyz[1] - 0.5, xyz[2] - 0.54];
		if (mode === 2) {
			const lab = xyz2lab(xyz);
			return [lab[1] * 0.01, (lab[0] - 50) * 0.01, lab[2] * 0.01];
		}
		const ok = lsrgb2oklab(m3.mulV(matrices.toSrgbLin.toSrgb, rgb));
		return [ok[1] * 2.2, ok[0] - 0.5, ok[2] * 2.2];
	}

	private rgbToWorld(rgb: Vec3, state: ExplorerState, matrices: DerivedMatrices): Vec3 {
		return this.rgbToWorldMode(rgb, state.spaceMode, matrices);
	}

	private worldForSrgbMorph(srgbLin: Vec3, state: ExplorerState, matrices: DerivedMatrices, morph?: MorphState): Vec3 {
		const gamutRgb = m3.mulV(matrices.toSrgbLin.fromSrgb, srgbLin);
		if (!morph) return this.rgbToWorldMode(gamutRgb, state.spaceMode, matrices);
		const mt = morph.t * morph.t * (3 - 2 * morph.t);
		const pFrom = this.rgbToWorldMode(gamutRgb, morph.from, matrices);
		const pTo = this.rgbToWorldMode(gamutRgb, morph.to, matrices);
		return [
			pFrom[0] + (pTo[0] - pFrom[0]) * mt,
			pFrom[1] + (pTo[1] - pFrom[1]) * mt,
			pFrom[2] + (pTo[2] - pFrom[2]) * mt
		];
	}

	rebuildSpectralOverlay(state: ExplorerState, matrices: DerivedMatrices) {
		this.spectralSurfaceIndexCount = 0;
		this.spectralRimOffset = 0;
		this.spectralRimCount = 0;
		this.spectralPurplesOffset = 0;
		if (state.chromaticityOverlay === 'off') return;

		const { gl } = this;
		const { SPECTRAL_NM_MIN: NM_MIN, SPECTRAL_NM_MAX: NM_MAX, SPECTRAL_NM_STEP: NM_STEP } = WebGlRenderer;
		const NW = Math.floor((NM_MAX - NM_MIN) / NM_STEP) + 1;
		const withSurface = state.chromaticityOverlay === 'spectral-surface';
		const NV = withSurface ? 13 : 1;
		const SURFACE_DIM = 0.20;
		const RIM_BRIGHT = 0.75;

		// Precompute per-wavelength chromaticity XYZ and display (sRGB gamma) color.
		const chromaXyzArr: Vec3[] = [];
		const displayGammaArr: Vec3[] = [];
		for (let i = 0; i < NW; i++) {
			const nm = NM_MIN + i * NM_STEP;
			const xyz = waveToXyz(nm) as Vec3;
			const S = xyz[0] + xyz[1] + xyz[2];
			const cx: Vec3 = S > 1e-7 ? [xyz[0] / S, xyz[1] / S, xyz[2] / S] : [0, 0, 0];
			chromaXyzArr.push(cx);
			// XYZ→sRGB-linear is gamut-independent: toSrgbLin.toSrgb * xyz2rgb = inv(sRGB_M).
			const srgbLin = m3.mulV(matrices.toSrgbLin.toSrgb, m3.mulV(matrices.xyz2rgb, cx));
			const cvd = simulateCvdSrgb(
				[Math.max(0, srgbLin[0]), Math.max(0, srgbLin[1]), Math.max(0, srgbLin[2])],
				state.cvd, state.cvdSev
			);
			displayGammaArr.push([
				TRC.srgb.enc(Math.min(cvd[0], 1)),
				TRC.srgb.enc(Math.min(cvd[1], 1)),
				TRC.srgb.enc(Math.min(cvd[2], 1))
			]);
		}

		const totalVerts = NW * NV + 2;
		const verts = new Float32Array(totalVerts * 6);

		for (let j = 0; j < NV; j++) {
			const v = NV === 1 ? 1.0 : j / (NV - 1);
			const dim = NV === 1 ? RIM_BRIGHT : v * SURFACE_DIM;
			for (let i = 0; i < NW; i++) {
				const cx = chromaXyzArr[i];
				const scaledXyz: Vec3 = [cx[0] * v, cx[1] * v, cx[2] * v];
				const w = this.xyzToWorld(scaledXyz, state, matrices);
				const g = displayGammaArr[i];
				const o = (j * NW + i) * 6;
				verts[o] = w[0]; verts[o + 1] = w[1]; verts[o + 2] = w[2];
				verts[o + 3] = g[0] * dim; verts[o + 4] = g[1] * dim; verts[o + 5] = g[2] * dim;
			}
		}

		// Line of purples: 2 extra verts connecting short- and long-wavelength endpoints.
		const rimRow = (NV - 1) * NW;
		const PD = NV === 1 ? RIM_BRIGHT * 0.8 : SURFACE_DIM;
		for (let k = 0; k < 2; k++) {
			const src = (k === 0 ? rimRow : rimRow + NW - 1) * 6;
			const dst = (NW * NV + k) * 6;
			verts[dst] = verts[src]; verts[dst + 1] = verts[src + 1]; verts[dst + 2] = verts[src + 2];
			// Muted magenta-gray for the line of purples (not a spectral colour).
			verts[dst + 3] = 0.55 * PD; verts[dst + 4] = 0.32 * PD; verts[dst + 5] = 0.55 * PD;
		}

		this.spectralRimOffset = rimRow;
		this.spectralRimCount = NW;
		this.spectralPurplesOffset = NW * NV;

		const idxCount = withSurface ? (NW - 1) * (NV - 1) * 6 : 0;
		const indices = new Uint16Array(idxCount);
		if (withSurface) {
			let p = 0;
			for (let j = 0; j < NV - 1; j++) {
				for (let i = 0; i < NW - 1; i++) {
					const tl = j * NW + i, tr = tl + 1, bl = (j + 1) * NW + i, br = bl + 1;
					indices[p++] = tl; indices[p++] = tr; indices[p++] = bl;
					indices[p++] = tr; indices[p++] = br; indices[p++] = bl;
				}
			}
			this.spectralSurfaceIndexCount = idxCount;
		}

		gl.bindVertexArray(this.spectralVao);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.spectralBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.spectralIndexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);
		gl.bindVertexArray(null);
	}

	private xyzToWorld(xyz: Vec3, state: ExplorerState, matrices: DerivedMatrices): Vec3 {
		if (state.spaceMode === 1) return [xyz[0] - 0.48, xyz[1] - 0.5, xyz[2] - 0.54];
		if (state.spaceMode === 2) {
			const lab = xyz2lab(xyz);
			return [lab[1] * 0.01, (lab[0] - 50) * 0.01, lab[2] * 0.01];
		}
		const rgb = m3.mulV(matrices.xyz2rgb, xyz);
		if (state.spaceMode === 0) return m3.mulV(CUBE_ROT, [rgb[0] - 0.5, rgb[1] - 0.5, rgb[2] - 0.5]);
		if (state.spaceMode === 5) {
			const p = m3.mulV(CUBE_ROT, [rgb[0] - 0.5, rgb[1] - 0.5, rgb[2] - 0.5]);
			return [p[0], REC709_Y[0] * rgb[0] + REC709_Y[1] * rgb[1] + REC709_Y[2] * rgb[2] - 0.5, p[2]];
		}
		// spaceMode 3 (Oklab): XYZ → sRGB-linear → Oklab.
		const srgbLin = m3.mulV(matrices.toSrgbLin.toSrgb, rgb);
		const ok = lsrgb2oklab(srgbLin);
		return [ok[1] * 2.2, ok[0] - 0.5, ok[2] * 2.2];
	}

	dispose() {
		const { gl } = this;
		gl.deleteProgram(this.solidProgram);
		gl.deleteProgram(this.floorProgram);
		gl.deleteProgram(this.lineProgram);
		gl.deleteProgram(this.markProgram);
		gl.deleteProgram(this.splineProgram);
		gl.deleteVertexArray(this.solidVao);
		gl.deleteVertexArray(this.floorVao);
		gl.deleteVertexArray(this.lineVao);
		gl.deleteVertexArray(this.splineVao);
		gl.deleteVertexArray(this.spectralVao);
		gl.deleteBuffer(this.solidBuffer);
		gl.deleteBuffer(this.floorBuffer);
		gl.deleteBuffer(this.lineBuffer);
		gl.deleteBuffer(this.splineBuffer);
		gl.deleteBuffer(this.spectralBuffer);
		gl.deleteBuffer(this.spectralIndexBuffer);
	}

	private createSolidVao() {
		const { gl } = this;
		const vao = gl.createVertexArray();
		if (!vao) throw new Error('Unable to create WebGL vertex array');
		gl.bindVertexArray(vao);
		const bufQuad = gl.createBuffer();
		if (!bufQuad) throw new Error('Unable to create WebGL solid buffer');
		gl.bindBuffer(gl.ARRAY_BUFFER, bufQuad);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		gl.bindVertexArray(null);
		return { vao, buffer: bufQuad };
	}

	private createFloorVao() {
		const { gl } = this;
		const vao = gl.createVertexArray();
		if (!vao) throw new Error('Unable to create WebGL vertex array');
		gl.bindVertexArray(vao);
		const bufFloor = gl.createBuffer();
		if (!bufFloor) throw new Error('Unable to create WebGL floor buffer');
		gl.bindBuffer(gl.ARRAY_BUFFER, bufFloor);
		const FE = 6;
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-FE, -FE, FE, -FE, -FE, FE, FE, FE]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		gl.bindVertexArray(null);
		return { vao, buffer: bufFloor };
	}

	private createLineVao() {
		const { gl } = this;
		const vao = gl.createVertexArray();
		const buffer = gl.createBuffer();
		if (!vao || !buffer) throw new Error('Unable to create WebGL line buffers');
		gl.bindVertexArray(vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, 4, gl.DYNAMIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
		gl.bindVertexArray(null);
		return { vao, buffer };
	}

	private createSpectralVao() {
		const { gl } = this;
		const vao = gl.createVertexArray();
		const buffer = gl.createBuffer();
		const indexBuffer = gl.createBuffer();
		if (!vao || !buffer || !indexBuffer) throw new Error('Unable to create WebGL spectral buffers');
		gl.bindVertexArray(vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, 4, gl.DYNAMIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, 2, gl.DYNAMIC_DRAW);
		gl.bindVertexArray(null);
		return { vao, buffer, indexBuffer };
	}

	private createSplineVao() {
		const { gl } = this;
		const vao = gl.createVertexArray();
		const buffer = gl.createBuffer();
		if (!vao || !buffer) throw new Error('Unable to create WebGL spline buffers');
		gl.bindVertexArray(vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, 4, gl.DYNAMIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
		gl.bindVertexArray(null);
		return { vao, buffer };
	}

	private compile(vsrc: string, fsrc: string) {
		const { gl } = this;
		const mk = (type: number, source: string) => {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Unable to create shader');
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile failed');
			}
			return shader;
		};
		const program = gl.createProgram();
		if (!program) throw new Error('Unable to create WebGL program');
		const vertex = mk(gl.VERTEX_SHADER, vsrc);
		const fragment = mk(gl.FRAGMENT_SHADER, fsrc);
		gl.attachShader(program, vertex);
		gl.attachShader(program, fragment);
		gl.linkProgram(program);
		gl.deleteShader(vertex);
		gl.deleteShader(fragment);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
		}
		return program;
	}

	private U(program: WebGLProgram, name: string) {
		return this.gl.getUniformLocation(program, name);
	}

	private uploadMat3(program: WebGLProgram, name: string, value: Mat3) {
		this.gl.uniformMatrix3fv(this.U(program, name), false, m3gl(value));
	}

	private meshWarpForSpace(spaceMode: ExplorerState['spaceMode']) {
		if (spaceMode === 3) return 2.0;
		if (spaceMode === 2) return 1.7;
		return 1.0;
	}

	private uploadSolidUniforms(
		state: ExplorerState,
		M: DerivedMatrices,
		proj: Float32Array,
		view: Float32Array,
		ghost: 0 | 1,
		N: number,
		lines: 0 | 1,
		gridOnly: 0 | 1,
		capGridOnly: 0 | 1,
		clippedGridAlpha: number,
		unclipped: 0 | 1,
		morphFrom: SpaceMode = state.spaceMode,
		morphTo: SpaceMode = state.spaceMode,
		morphT = 1.0
	) {
		const { gl } = this;
		const { n, d } = planeND(state);
		const p = this.solidProgram;
		gl.uniformMatrix4fv(this.U(p, 'uProj'), false, proj);
		gl.uniformMatrix4fv(this.U(p, 'uView'), false, view);
		gl.uniform1i(this.U(p, 'uN'), N);
		gl.uniform1i(this.U(p, 'uSpaceMode'), state.spaceMode);
		gl.uniform1i(this.U(p, 'uFromSpaceMode'), morphFrom);
		gl.uniform1i(this.U(p, 'uToSpaceMode'), morphTo);
		gl.uniform1f(this.U(p, 'uMorphT'), morphT);
		gl.uniform1f(this.U(p, 'uMeshWarp'), this.meshWarpForSpace(morphFrom));
		this.uploadMat3(p, 'uRgbToXyz', M.rgb2xyz);
		this.uploadMat3(p, 'uXyzToRgb', M.xyz2rgb);
		this.uploadMat3(p, 'uOkM1', M.okM1);
		this.uploadMat3(p, 'uOkM2', M.okM2);
		this.uploadMat3(p, 'uOkM1i', M.okM1i);
		this.uploadMat3(p, 'uOkM2i', M.okM2i);
		gl.uniform3fv(this.U(p, 'uWhite'), M.white);
		gl.uniform3fv(this.U(p, 'uLumaW'), REC709_Y);
		this.uploadMat3(p, 'uCubeRot', CUBE_ROT);
		this.uploadMat3(p, 'uCubeRoti', CUBE_ROTi);
		gl.uniform3fv(this.U(p, 'uPlaneN'), n);
		gl.uniform1f(this.U(p, 'uPlaneD'), d);
		gl.uniform1f(this.U(p, 'uSliceEps'), state.eps);
		gl.uniform3fv(this.U(p, 'uMaskPlaneN'), n);
		gl.uniform1f(this.U(p, 'uMaskPlaneD'), d);
		gl.uniform1f(this.U(p, 'uMaskSliceEps'), state.eps);
		gl.uniform1f(this.U(p, 'uMaskSliceOn'), state.slice ? 1 : 0);
		gl.uniform1f(this.U(p, 'uMaskCutAbove'), state.cutAbove ? 1 : 0);
		gl.uniform1f(this.U(p, 'uMaskCutBelow'), state.cutBelow ? 1 : 0);
		gl.uniform1f(this.U(p, 'uMaskCylSlice'), state.cylSlice ? 1 : 0);
		gl.uniform1f(this.U(p, 'uMaskCylRad'), state.cylRad);
		gl.uniform1f(this.U(p, 'uSliceOn'), !unclipped && state.slice ? 1 : 0);
		gl.uniform1f(this.U(p, 'uCutAbove'), !unclipped && state.cutAbove ? 1 : 0);
		gl.uniform1f(this.U(p, 'uCutBelow'), !unclipped && state.cutBelow ? 1 : 0);
		gl.uniform1f(this.U(p, 'uCylSlice'), !unclipped && state.cylSlice ? 1 : 0);
		gl.uniform1f(this.U(p, 'uCylRad'), state.cylRad);
		gl.uniform1f(this.U(p, 'uLines'), lines);
		gl.uniform1f(this.U(p, 'uGhost'), ghost);
		gl.uniform1f(this.U(p, 'uGridOnly'), gridOnly);
		gl.uniform1f(this.U(p, 'uCapGridOnly'), capGridOnly);
		gl.uniform1f(this.U(p, 'uClippedGridAlpha'), clippedGridAlpha);
		gl.uniform1f(this.U(p, 'uAlpha'), 1);
		gl.uniform1f(this.U(p, 'uCvdSev'), CVD[state.cvd] ? state.cvdSev : 0);
		this.uploadMat3(p, 'uCvd', CVD[state.cvd] || [1, 0, 0, 0, 1, 0, 0, 0, 1]);
		this.uploadMat3(p, 'uRgb2Lms', RGB2LMS);
		this.uploadMat3(p, 'uLms2Rgb', LMS2RGB);
	}
}
