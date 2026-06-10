import { cross3, dot3, norm3, sub3, type Vec3 } from '$lib/color/math';

export interface Camera {
	yaw: number;
	pitch: number;
	dist: number;
	target: Vec3;
	fov: number;
}

export function createCamera(): Camera {
	return { yaw: 0.7, pitch: 0.42, dist: 2.6, target: [0, -0.05, 0], fov: Math.PI / 4 };
}

export function persp(fovy: number, asp: number, n: number, f: number) {
	const t = 1 / Math.tan(fovy / 2);
	return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]);
}

export function lookAt(eye: Vec3, ct: Vec3, up: Vec3) {
	const z = norm3(sub3(eye, ct));
	const x = norm3(cross3(up, z));
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

export function camRay(px: number, py: number, w: number, h: number, cam: Camera) {
	const eye = camEye(cam);
	const f = norm3(sub3(cam.target, eye));
	const r = norm3(cross3(f, [0, 1, 0]));
	const u = cross3(r, f);
	const t = Math.tan(cam.fov / 2);
	const a = w / h;
	const nx = (px / w) * 2 - 1;
	const ny = 1 - (py / h) * 2;
	const rd = norm3([
		f[0] + nx * t * a * r[0] + ny * t * u[0],
		f[1] + nx * t * a * r[1] + ny * t * u[1],
		f[2] + nx * t * a * r[2] + ny * t * u[2]
	]);
	return { ro: eye, rd };
}
