import { add3, cross3, dot3, norm3, scale3, sub3, type Vec3 } from '$lib/color/math';

export interface Camera {
	yaw: number;
	pitch: number;
	dist: number;
	target: Vec3;
	fov: number;
}

export const DEFAULT_CAMERA: Camera = { yaw: 0.7, pitch: 0.42, dist: 2.6, target: [0, -0.05, 0], fov: Math.PI / 4 };

export function createCamera(): Camera {
	return {
		yaw: DEFAULT_CAMERA.yaw,
		pitch: DEFAULT_CAMERA.pitch,
		dist: DEFAULT_CAMERA.dist,
		target: [DEFAULT_CAMERA.target[0], DEFAULT_CAMERA.target[1], DEFAULT_CAMERA.target[2]],
		fov: DEFAULT_CAMERA.fov
	};
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
