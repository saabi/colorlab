import { m3gl, type Mat3 } from '$lib/color/math';
import { CVD } from '$lib/color/cvd';
import { CUBE_ROT, CUBE_ROTi, LMS2RGB, RGB2LMS, REC709_Y } from '$lib/color/pipeline';
import { planeND } from '$lib/engine/plane';
import { camEye, lookAt, persp, type Camera } from '$lib/engine/camera';
import { FS_SOLID, VS_SOLID } from './shaders';

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
	private program: WebGLProgram;
	private vao: WebGLVertexArrayObject;
	private dpr = 1;

	constructor(private canvas: HTMLCanvasElement) {
		const gl = canvas.getContext('webgl2', { antialias: true });
		if (!gl) throw new Error('WebGL2 unavailable');
		this.gl = gl;
		this.program = this.compile(VS_SOLID, FS_SOLID);
		this.vao = this.createSolidVao();
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
			gl.useProgram(this.program);
			gl.bindVertexArray(this.vao);
			this.uploadSolidUniforms(input.state, input.shellMatrices, proj, view, 1, 96);
			gl.disable(gl.DEPTH_TEST);
			gl.depthMask(false);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 6 * 96 * 96);
			gl.disable(gl.BLEND);
			gl.enable(gl.DEPTH_TEST);
			gl.depthMask(true);
		}

		gl.useProgram(this.program);
		gl.bindVertexArray(this.vao);
		this.uploadSolidUniforms(input.state, input.matrices, proj, view, 0, input.state.N);
		gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 6 * input.state.N * input.state.N);
		gl.bindVertexArray(null);
	}

	dispose() {
		const { gl } = this;
		gl.deleteProgram(this.program);
		gl.deleteVertexArray(this.vao);
	}

	private createSolidVao() {
		const { gl } = this;
		const vao = gl.createVertexArray();
		if (!vao) throw new Error('Unable to create WebGL vertex array');
		gl.bindVertexArray(vao);
		const bufQuad = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, bufQuad);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		gl.bindVertexArray(null);
		return vao;
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
		gl.attachShader(program, mk(gl.VERTEX_SHADER, vsrc));
		gl.attachShader(program, mk(gl.FRAGMENT_SHADER, fsrc));
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
		}
		return program;
	}

	private U(name: string) {
		return this.gl.getUniformLocation(this.program, name);
	}

	private uploadMat3(name: string, value: Mat3) {
		this.gl.uniformMatrix3fv(this.U(name), false, m3gl(value));
	}

	private uploadSolidUniforms(
		state: ExplorerState,
		M: DerivedMatrices,
		proj: Float32Array,
		view: Float32Array,
		ghost: 0 | 1,
		N: number
	) {
		const { gl } = this;
		const { n, d } = planeND(state);
		gl.uniformMatrix4fv(this.U('uProj'), false, proj);
		gl.uniformMatrix4fv(this.U('uView'), false, view);
		gl.uniform1i(this.U('uN'), N);
		gl.uniform1i(this.U('uSpaceMode'), state.spaceMode);
		this.uploadMat3('uRgbToXyz', M.rgb2xyz);
		this.uploadMat3('uXyzToRgb', M.xyz2rgb);
		this.uploadMat3('uOkM1', M.okM1);
		this.uploadMat3('uOkM2', M.okM2);
		this.uploadMat3('uOkM1i', M.okM1i);
		this.uploadMat3('uOkM2i', M.okM2i);
		gl.uniform3fv(this.U('uWhite'), M.white);
		gl.uniform3fv(this.U('uLumaW'), REC709_Y);
		this.uploadMat3('uCubeRot', CUBE_ROT);
		this.uploadMat3('uCubeRoti', CUBE_ROTi);
		gl.uniform3fv(this.U('uPlaneN'), n);
		gl.uniform1f(this.U('uPlaneD'), d);
		gl.uniform1f(this.U('uSliceEps'), state.eps);
		gl.uniform1f(this.U('uSliceOn'), state.slice ? 1 : 0);
		gl.uniform1f(this.U('uCutAbove'), state.cutAbove ? 1 : 0);
		gl.uniform1f(this.U('uCutBelow'), state.cutBelow ? 1 : 0);
		gl.uniform1f(this.U('uLines'), state.lines ? 1 : 0);
		gl.uniform1f(this.U('uGhost'), ghost);
		gl.uniform1f(this.U('uCvdSev'), CVD[state.cvd] ? state.cvdSev : 0);
		this.uploadMat3('uCvd', CVD[state.cvd] || [1, 0, 0, 0, 1, 0, 0, 0, 1]);
		this.uploadMat3('uRgb2Lms', RGB2LMS);
		this.uploadMat3('uLms2Rgb', LMS2RGB);
	}
}
