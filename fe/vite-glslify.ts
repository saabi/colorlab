import { compile } from 'glslify';
import path from 'node:path';
import type { Plugin } from 'vite';

const SHADER_EXT = /\.(vert|frag|glsl)$/;

/** Compile imported GLSL shader files via glslify (replaces vite-plugin-glslify for Vite 8). */
export function glslify(): Plugin {
	return {
		name: 'vite-glslify',
		transform(code, id) {
			if (!SHADER_EXT.test(id)) return null;
			return {
				code: `export default \`${compile(code, { basedir: path.dirname(id) })}\``
			};
		},
		handleHotUpdate(ctx) {
			if (!SHADER_EXT.test(ctx.file)) return;
			const defaultRead = ctx.read;
			ctx.read = async () =>
				compile(await defaultRead(), { basedir: path.dirname(ctx.file) });
		}
	};
}
