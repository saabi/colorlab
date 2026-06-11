import { add3, cross3, dot3, norm3, scale3, sub3, type Vec3 } from '$lib/color/math';

export interface Camera {
	yaw: number;
	pitch: number;
	dist: number;
	target: Vec3;
	fov: number;
}

export const DEFAULT_CAMERA: Camera = { yaw: 0.7, pitch: 0.42, dist: 2.6, target: [0, -0.05, 0], fov: Math.PI / 4 };
export const MIN_CAMERA_DIST = 1.2;
export const MAX_CAMERA_DIST = 8;
export const MAX_CAMERA_PITCH = Math.PI / 2 - 0.04;
export const MIN_CAMERA_FOV = Math.PI / 8;
export const MAX_CAMERA_FOV = Math.PI / 2;

export function createCamera(): Camera {
	return {
		yaw: DEFAULT_CAMERA.yaw,
		pitch: DEFAULT_CAMERA.pitch,
		dist: DEFAULT_CAMERA.dist,
		target: [DEFAULT_CAMERA.target[0], DEFAULT_CAMERA.target[1], DEFAULT_CAMERA.target[2]],
		fov: DEFAULT_CAMERA.fov
	};
}

export function resetCamera(camera: Camera) {
	const next = createCamera();
	camera.yaw = next.yaw;
	camera.pitch = next.pitch;
	camera.dist = next.dist;
	camera.target = next.target;
	camera.fov = next.fov;
}

export function persp(fovy: number, asp: number, n: number, f: number) {
	const t = 1 / Math.tan(fovy / 2);
	return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]);
}

export function lookAt(eye: Vec3, ct: Vec3, up: Vec3) {
	const z = norm3(sub3(eye, ct));
	const upRef = Math.abs(dot3(z, up)) > 0.98 ? ([0, 0, 1] as Vec3) : up;
	const x = norm3(cross3(upRef, z));
	const y = cross3(z, x);
	return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot3(x, eye), -dot3(y, eye), -dot3(z, eye), 1]);
}

export function camEye(cam: Camera): Vec3 {
	const cp = Math.cos(cam.pitch);
	const sp = Math.sin(cam.pitch);
	const cy = Math.cos(cam.yaw);
	const sy = Math.sin(cam.yaw);
	return [
		cam.target[0] + cam.dist * cp * sy,
		cam.target[1] + cam.dist * sp,
		cam.target[2] + cam.dist * cp * cy
	];
}

export function cameraBasis(cam: Camera) {
	const eye = camEye(cam);
	const forward = norm3(sub3(cam.target, eye));
	const worldUp: Vec3 = [0, 1, 0];
	const upRef: Vec3 = Math.abs(dot3(forward, worldUp)) > 0.98 ? [0, 0, 1] : worldUp;
	const right = norm3(cross3(forward, upRef));
	const up = cross3(right, forward);
	return { eye, forward, right, up };
}

export function panCamera(cam: Camera, dx: number, dy: number, viewportHeight: number) {
	const { right, up } = cameraBasis(cam);
	const worldPerPixel = (2 * cam.dist * Math.tan(cam.fov / 2)) / Math.max(viewportHeight, 1);
	const move = add3(scale3(right, -dx * worldPerPixel), scale3(up, dy * worldPerPixel));
	cam.target = add3(cam.target, move);
}

// Column-major 4x4 * 4x4 (matching persp/lookAt storage).
function mulMat4(a: Float32Array, b: Float32Array): Float32Array {
	const o = new Float32Array(16);
	for (let c = 0; c < 4; c += 1) {
		for (let r = 0; r < 4; r += 1) {
			let s = 0;
			for (let k = 0; k < 4; k += 1) s += a[k * 4 + r] * b[c * 4 + k];
			o[c * 4 + r] = s;
		}
	}
	return o;
}

// Project a world point to canvas pixels, or null if behind the camera.
export function projectToScreen(world: Vec3, cam: Camera, w: number, h: number): [number, number] | null {
	const proj = persp(cam.fov, w / h, 0.05, 40);
	const view = lookAt(camEye(cam), cam.target, [0, 1, 0]);
	const m = mulMat4(proj, view);
	const v = [world[0], world[1], world[2], 1];
	const clip = [0, 0, 0, 0];
	for (let r = 0; r < 4; r += 1) {
		let s = 0;
		for (let k = 0; k < 4; k += 1) s += m[k * 4 + r] * v[k];
		clip[r] = s;
	}
	if (clip[3] <= 0) return null;
	return [((clip[0] / clip[3] + 1) / 2) * w, ((1 - clip[1] / clip[3]) / 2) * h];
}

export function camRay(px: number, py: number, w: number, h: number, cam: Camera) {
	const { eye, forward, right, up } = cameraBasis(cam);
	const t = Math.tan(cam.fov / 2);
	const a = w / h;
	const nx = (px / w) * 2 - 1;
	const ny = 1 - (py / h) * 2;
	const rd = norm3([
		forward[0] + nx * t * a * right[0] + ny * t * up[0],
		forward[1] + nx * t * a * right[1] + ny * t * up[1],
		forward[2] + nx * t * a * right[2] + ny * t * up[2]
	]);
	return { ro: eye, rd };
}
