import type { ExplorerState, MinAverageFps } from '$lib/engine/types';

export type AppPreferences = Pick<ExplorerState, 'autoRotate' | 'autoPerformance' | 'minAverageFps' | 'observerModel' | 'chromaticityDiagram'>;

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
	autoRotate: true,
	autoPerformance: true,
	minAverageFps: 30,
	observerModel: 'stockman-sharpe-2deg',
	chromaticityDiagram: 'cie1931-xy'
};

const STORAGE_KEY = 'colorlab:preferences';
const MIN_FPS_OPTIONS: MinAverageFps[] = [15, 30, 60];

function includesMinFps(value: unknown): value is MinAverageFps {
	return MIN_FPS_OPTIONS.includes(value as MinAverageFps);
}

export function sanitizeAppPreferences(raw: unknown): AppPreferences {
	const prefs = typeof raw === 'object' && raw !== null ? (raw as Partial<AppPreferences>) : {};
	return {
		autoRotate:
			typeof prefs.autoRotate === 'boolean' ? prefs.autoRotate : DEFAULT_APP_PREFERENCES.autoRotate,
		autoPerformance:
			typeof prefs.autoPerformance === 'boolean'
				? prefs.autoPerformance
				: DEFAULT_APP_PREFERENCES.autoPerformance,
		minAverageFps: includesMinFps(prefs.minAverageFps)
			? prefs.minAverageFps
			: DEFAULT_APP_PREFERENCES.minAverageFps,
		observerModel:
			typeof prefs.observerModel === 'string' ? prefs.observerModel : DEFAULT_APP_PREFERENCES.observerModel,
		chromaticityDiagram:
			typeof prefs.chromaticityDiagram === 'string' ? prefs.chromaticityDiagram : DEFAULT_APP_PREFERENCES.chromaticityDiagram
	};
}

export function applyAppPreferences(explorer: ExplorerState, prefs: AppPreferences) {
	explorer.autoRotate = prefs.autoRotate;
	explorer.autoPerformance = prefs.autoPerformance;
	explorer.minAverageFps = prefs.minAverageFps;
	explorer.observerModel = prefs.observerModel;
	explorer.chromaticityDiagram = prefs.chromaticityDiagram;
}

export function readAppPreferences(): AppPreferences {
	if (typeof localStorage === 'undefined') return { ...DEFAULT_APP_PREFERENCES };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_APP_PREFERENCES };
		return sanitizeAppPreferences(JSON.parse(raw));
	} catch {
		return { ...DEFAULT_APP_PREFERENCES };
	}
}

export function loadAppPreferences(explorer: ExplorerState) {
	applyAppPreferences(explorer, readAppPreferences());
}

export function persistAppPreferences(explorer: AppPreferences) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(explorer));
}
