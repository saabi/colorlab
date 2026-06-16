import type { ExplorerState, MinAverageFps } from '$lib/engine/types';

export type UiTheme = 'dark' | 'light';

export const UI_THEME_OPTIONS: UiTheme[] = ['dark', 'light'];

export type AppPreferences = Pick<
	ExplorerState,
	'autoRotate' | 'autoPerformance' | 'minAverageFps' | 'observerModel' | 'chromaticityDiagram' | 'neutralBackdrop'
> & {
	theme: UiTheme;
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
	autoRotate: true,
	autoPerformance: true,
	minAverageFps: 30,
	observerModel: 'stockman-sharpe-2deg',
	chromaticityDiagram: 'cie1931-xy',
	neutralBackdrop: false,
	theme: 'dark'
};

const STORAGE_KEY = 'colorlab:preferences';
const MIN_FPS_OPTIONS: MinAverageFps[] = [15, 30, 60];

function includesMinFps(value: unknown): value is MinAverageFps {
	return MIN_FPS_OPTIONS.includes(value as MinAverageFps);
}

function includesUiTheme(value: unknown): value is UiTheme {
	return UI_THEME_OPTIONS.includes(value as UiTheme);
}

export function applyUiTheme(theme: UiTheme) {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	if (theme === 'light') root.dataset.theme = 'light';
	else delete root.dataset.theme;
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
			typeof prefs.chromaticityDiagram === 'string'
				? prefs.chromaticityDiagram
				: DEFAULT_APP_PREFERENCES.chromaticityDiagram,
		neutralBackdrop:
			typeof prefs.neutralBackdrop === 'boolean'
				? prefs.neutralBackdrop
				: DEFAULT_APP_PREFERENCES.neutralBackdrop,
		theme: includesUiTheme(prefs.theme) ? prefs.theme : DEFAULT_APP_PREFERENCES.theme
	};
}

export function applyAppPreferences(explorer: ExplorerState, prefs: AppPreferences) {
	explorer.autoRotate = prefs.autoRotate;
	explorer.autoPerformance = prefs.autoPerformance;
	explorer.minAverageFps = prefs.minAverageFps;
	explorer.observerModel = prefs.observerModel;
	explorer.chromaticityDiagram = prefs.chromaticityDiagram;
	explorer.neutralBackdrop = prefs.neutralBackdrop;
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
	const prefs = readAppPreferences();
	applyAppPreferences(explorer, prefs);
	applyUiTheme(prefs.theme);
}

export function persistAppPreferences(prefs: Partial<AppPreferences>) {
	if (typeof localStorage === 'undefined') return;
	const merged = sanitizeAppPreferences({ ...readAppPreferences(), ...prefs });
	localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

export function setUiTheme(theme: UiTheme) {
	applyUiTheme(theme);
	const prefs = readAppPreferences();
	persistAppPreferences({ ...prefs, theme });
}

export function toggleUiTheme(): UiTheme {
	const next: UiTheme = readAppPreferences().theme === 'dark' ? 'light' : 'dark';
	setUiTheme(next);
	return next;
}
