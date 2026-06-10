// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
	interface Window {
		/** Umami analytics (cookieless), present only when the env-gated script loads. */
		umami?: { track: (event?: string, data?: Record<string, unknown>) => void };
	}
}

export {};


