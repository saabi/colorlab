declare module 'glslify' {
	export interface GlslifyCompileOptions {
		basedir?: string;
		[key: string]: unknown;
	}

	export function compile(source: string, options?: GlslifyCompileOptions): string;
}
