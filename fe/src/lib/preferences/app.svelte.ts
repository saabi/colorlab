import type { ExplorerState, MinAverageFps } from '$lib/engine/types';

export type UiTheme = 'dark' | 'light';

export const UI_THEME_OPTIONS: UiTheme[] = ['dark', 'light'];

/**
 * Display gamut = what the user's monitor can show (device preference, not document
 * intent). Phase 1 references a curated subset of the built-in gamuts; this widens to a
 * tagged union for custom profiles later (see color-context-display-gamut-plan.md).
 */
export type DisplayGamutId = 'srgb' | 'p3' | 'rec2020';

export const DISPLAY_GAMUT_OPTIONS: DisplayGamutId[] = ['srgb', 'p3', 'rec2020'];

export const DISPLAY_GAMUT_LABELS: Record<DisplayGamutId, string> = {
	srgb: 'sRGB',
	p3: 'Display P3',
	rec2020: 'Rec.2020'
};

export type AppPreferences = Pick<
	ExplorerState,
	'autoRotate' | 'autoPerformance' | 'minAverageFps' | 'observerModel' | 'chromaticityDiagram' | 'neutralBackdrop'
> & {
	theme: UiTheme;
	displayGamut: DisplayGamutId;
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
	autoRotate: true,
	autoPerformance: true,
	minAverageFps: 30,
	observerModel: 'stockman-sharpe-2deg',
	chromaticityDiagram: 'cie1931-xy',
	neutralBackdrop: false,
	theme: 'dark',
	displayGamut: 'srgb'
};

const STORAGE_KEY = 'colorlab:preferences';
const MIN_FPS_OPTIONS: MinAverageFps[] = [15, 30, 60];

function includesMinFps(value: unknown): value is MinAverageFps {
	return MIN_FPS_OPTIONS.includes(value as MinAverageFps);
}

function includesUiTheme(value: unknown): value is UiTheme {
	return UI_THEME_OPTIONS.includes(value as UiTheme);
}

function includesDisplayGamut(value: unknown): value is DisplayGamutId {
	return DISPLAY_GAMUT_OPTIONS.includes(value as DisplayGamutId);
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
		theme: includesUiTheme(prefs.theme) ? prefs.theme : DEFAULT_APP_PREFERENCES.theme,
		displayGamut: includesDisplayGamut(prefs.displayGamut)
			? prefs.displayGamut
			: DEFAULT_APP_PREFERENCES.displayGamut
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

export function setDisplayGamut(displayGamut: DisplayGamutId) {
	persistAppPreferences({ ...readAppPreferences(), displayGamut });
}
