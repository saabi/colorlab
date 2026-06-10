import { cross3, m3gl, norm3, type Mat3, type Vec3 } from '$lib/color/math';
import { CVD, simulateCvdSrgb } from '$lib/color/cvd';
import { CUBE_ROT, CUBE_ROTi, LMS2RGB, RGB2LMS, REC709_Y } from '$lib/color/pipeline';
import { TRC } from '$lib/color/transfer';
import { planeND } from '$lib/engine/plane';
import { camEye, lookAt, persp, type Camera } from '$lib/engine/camera';
import { solidField } from '$lib/engine/picking';
import { FS_FLOOR, FS_LINE, FS_MARK, FS_SOLID, VS_FLOOR, VS_LINE, VS_MARK, VS_SOLID } from './shaders';

import type { ExplorerState } from '$lib/engine/types';
import type { DerivedMatrices } from './uniforms';

interface DrawInput {
	state: ExplorerState;
	matrices: DerivedMatrices;
	shellMatrices: DerivedMatrices | null;
	camera: Camera;
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
	private dpr = 1;

	constructor(private canvas: HTMLCanvasElement) {
		const gl = canvas.getContext('webgl2', { antialias: true });
		if (!gl) throw new Error('WebGL2 unavailable');
		this.gl = gl;
		this.solidProgram = this.compile(VS_SOLID, FS_SOLID);
		this.floorProgram = this.compile(VS_FLOOR, FS_FLOOR);
		this.lineProgram = this.compile(VS_LINE, FS_LINE);
		this.markProgram = this.compile(VS_MARK, FS_MARK);
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

		if (input.shellMatrices) {
			gl.useProgram(this.solidProgram);
			gl.bindVertexArray(this.solidVao);
			this.uploadSolidUniforms(input.state, input.shellMatrices, proj, view, 1, 96, 0, 0, 0, 0, 0, 0);
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
		this.uploadSolidUniforms(input.state, input.matrices, proj, view, 0, input.state.N, 0, 0, 0, 0, 0, 0);
		gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 6 * input.state.N * input.state.N);

		if (input.state.lines) {
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
				input.state.surfaceGrid === 'white' ? 1 : 0,
				input.state.surfaceGrid === 'hidden' ? 1 : 0,
				1
			);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 6 * input.state.N * input.state.N);
			if (input.state.slice || input.state.cylSlice) {
				this.uploadSolidUniforms(input.state, input.matrices, proj, view, 0, input.state.N, 1, 1, 1, 0, 0, 0);
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

		if (input.state.hover) {
			gl.useProgram(this.markProgram);
			gl.uniformMatrix4fv(this.U(this.markProgram, 'uProj'), false, proj);
			gl.uniformMatrix4fv(this.U(this.markProgram, 'uView'), false, view);
			gl.uniform3fv(this.U(this.markProgram, 'uPos'), input.state.hover.world);
			gl.uniform3fv(this.U(this.markProgram, 'uCol'), input.state.hover.inGamut ? [0.37, 0.72, 0.77] : [0.88, 0.33, 0.24]);
			gl.drawArrays(gl.POINTS, 0, 1);
		}

		if (input.state.theme.stops.length) {
			gl.useProgram(this.markProgram);
			gl.uniformMatrix4fv(this.U(this.markProgram, 'uProj'), false, proj);
			gl.uniformMatrix4fv(this.U(this.markProgram, 'uView'), false, view);
			for (const s of input.state.theme.stops) {
				const sim = simulateCvdSrgb(s.srgbLin, input.state.cvd, input.state.cvdSev);
				const c = sim.map((v) => TRC.srgb.enc(Math.min(Math.max(v, 0), 1)));
				gl.uniform3fv(this.U(this.markProgram, 'uPos'), s.world);
				gl.uniform3fv(this.U(this.markProgram, 'uCol'), c);
				gl.drawArrays(gl.POINTS, 0, 1);
			}
		}

		if (this.lineVertCount > 0 && input.state.slice && input.state.outline) {
			gl.useProgram(this.lineProgram);
			gl.bindVertexArray(this.lineVao);
			gl.uniformMatrix4fv(this.U(this.lineProgram, 'uProj'), false, proj);
			gl.uniformMatrix4fv(this.U(this.lineProgram, 'uView'), false, view);
			gl.uniform3fv(this.U(this.lineProgram, 'uCol'), [0.94, 0.94, 0.96]);
			gl.disable(gl.DEPTH_TEST);
			gl.drawArrays(gl.LINES, 0, this.lineVertCount);
			gl.enable(gl.DEPTH_TEST);
		}
		gl.bindVertexArray(null);
	}

	rebuildBoundary(state: ExplorerState, matrices: DerivedMatrices) {
		this.lineVertCount = 0;
		if (!state.slice || !state.outline) return;
		const { gl } = this;
		const { n, d } = planeND(state);
		const ref: Vec3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
		const u = norm3(cross3(n, ref));
		const v = cross3(n, u);
		const p0: Vec3 = [n[0] * d, n[1] * d, n[2] * d];
		const G = 110;
		const EXT = 1.5;
		const segs: number[] = [];
		const at = (a: number, b: number): Vec3 => [
			p0[0] + a * u[0] + b * v[0],
			p0[1] + a * u[1] + b * v[1],
			p0[2] + a * u[2] + b * v[2]
		];
		const inside = (a: number, b: number) => {
			const res = solidField(at(a, b), state, matrices);
			return res.v <= 0;
		};
		const bisect = (a1: number, b1: number, a2: number, b2: number) => {
			for (let i = 0; i < 10; i += 1) {
				const am = (a1 + a2) / 2;
				const bm = (b1 + b2) / 2;
				if (inside(am, bm)) {
					a1 = am;
					b1 = bm;
				} else {
					a2 = am;
					b2 = bm;
				}
			}
			return [(a1 + a2) / 2, (b1 + b2) / 2];
		};
		const cell = (2 * EXT) / G;
		const grid = new Uint8Array((G + 1) * (G + 1));
		for (let j = 0; j <= G; j += 1) {
			for (let i = 0; i <= G; i += 1) grid[j * (G + 1) + i] = inside(-EXT + i * cell, -EXT + j * cell) ? 1 : 0;
		}
		for (let j = 0; j < G; j += 1) {
			for (let i = 0; i < G; i += 1) {
				const a0 = -EXT + i * cell;
				const b0 = -EXT + j * cell;
				const c00 = grid[j * (G + 1) + i];
				const c10 = grid[j * (G + 1) + i + 1];
				const c01 = grid[(j + 1) * (G + 1) + i];
				const c11 = grid[(j + 1) * (G + 1) + i + 1];
				const code = c00 | (c10 << 1) | (c01 << 2) | (c11 << 3);
				if (code === 0 || code === 15) continue;
				const pts: number[][] = [];
				if (c00 !== c10) pts.push(bisect(c00 ? a0 : a0 + cell, b0, c00 ? a0 + cell : a0, b0));
				if (c00 !== c01) pts.push(bisect(a0, c00 ? b0 : b0 + cell, a0, c00 ? b0 + cell : b0));
				if (c10 !== c11) pts.push(bisect(a0 + cell, c10 ? b0 : b0 + cell, a0 + cell, c10 ? b0 + cell : b0));
				if (c01 !== c11) pts.push(bisect(c01 ? a0 : a0 + cell, b0 + cell, c01 ? a0 + cell : a0, b0 + cell));
				for (let k = 0; k + 1 < pts.length; k += 2) segs.push(...at(pts[k][0], pts[k][1]), ...at(pts[k + 1][0], pts[k + 1][1]));
			}
		}
		if (state.cylSlice) {
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

	dispose() {
		const { gl } = this;
		gl.deleteProgram(this.solidProgram);
		gl.deleteProgram(this.floorProgram);
		gl.deleteProgram(this.lineProgram);
		gl.deleteProgram(this.markProgram);
		gl.deleteVertexArray(this.solidVao);
		gl.deleteVertexArray(this.floorVao);
		gl.deleteVertexArray(this.lineVao);
		gl.deleteBuffer(this.solidBuffer);
		gl.deleteBuffer(this.floorBuffer);
		gl.deleteBuffer(this.lineBuffer);
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
		gridWhite: 0 | 1,
		gridHidden: 0 | 1,
		unclipped: 0 | 1
	) {
		const { gl } = this;
		const { n, d } = planeND(state);
		const p = this.solidProgram;
		gl.uniformMatrix4fv(this.U(p, 'uProj'), false, proj);
		gl.uniformMatrix4fv(this.U(p, 'uView'), false, view);
		gl.uniform1i(this.U(p, 'uN'), N);
		gl.uniform1i(this.U(p, 'uSpaceMode'), state.spaceMode);
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
		gl.uniform1f(this.U(p, 'uMaskCylInside'), state.cylInside ? 1 : 0);
		gl.uniform1f(this.U(p, 'uMaskCylRad'), state.cylRad);
		gl.uniform1f(this.U(p, 'uSliceOn'), !unclipped && state.slice ? 1 : 0);
		gl.uniform1f(this.U(p, 'uCutAbove'), !unclipped && state.cutAbove ? 1 : 0);
		gl.uniform1f(this.U(p, 'uCutBelow'), !unclipped && state.cutBelow ? 1 : 0);
		gl.uniform1f(this.U(p, 'uCylSlice'), !unclipped && state.cylSlice ? 1 : 0);
		gl.uniform1f(this.U(p, 'uCylInside'), state.cylInside ? 1 : 0);
		gl.uniform1f(this.U(p, 'uCylRad'), state.cylRad);
		gl.uniform1f(this.U(p, 'uLines'), lines);
		gl.uniform1f(this.U(p, 'uGhost'), ghost);
		gl.uniform1f(this.U(p, 'uGridOnly'), gridOnly);
		gl.uniform1f(this.U(p, 'uCapGridOnly'), capGridOnly);
		gl.uniform1f(this.U(p, 'uGridWhite'), gridWhite);
		gl.uniform1f(this.U(p, 'uGridHidden'), gridHidden);
		gl.uniform1f(this.U(p, 'uCvdSev'), CVD[state.cvd] ? state.cvdSev : 0);
		this.uploadMat3(p, 'uCvd', CVD[state.cvd] || [1, 0, 0, 0, 1, 0, 0, 0, 1]);
		this.uploadMat3(p, 'uRgb2Lms', RGB2LMS);
		this.uploadMat3(p, 'uLms2Rgb', LMS2RGB);
	}
}
