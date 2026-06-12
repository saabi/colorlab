export type FontScale = 100 | 112 | 125 | 150 | 175;
export type SecondaryContrast = 'normal' | 'high' | 'maximum';
export type LineHeight = 125 | 145 | 165 | 185;

export type A11yPreferences = {
	fontScale: FontScale;
	secondaryContrast: SecondaryContrast;
	lineHeight: LineHeight;
};

export const FONT_SCALE_OPTIONS: FontScale[] = [100, 112, 125, 150, 175];
export const SECONDARY_CONTRAST_OPTIONS: SecondaryContrast[] = ['normal', 'high', 'maximum'];
export const LINE_HEIGHT_OPTIONS: LineHeight[] = [125, 145, 165, 185];

export const DEFAULT_A11Y_PREFERENCES: A11yPreferences = {
	fontScale: 100,
	secondaryContrast: 'normal',
	lineHeight: 145
};

const STORAGE_KEY = 'colorlab:a11y';
const BASE_FONT_PX = 13;

export const a11yPreferences = $state<A11yPreferences>({ ...DEFAULT_A11Y_PREFERENCES });

let loaded = false;

function includes<T>(options: readonly T[], value: unknown): value is T {
	return options.includes(value as T);
}

function sanitize(raw: unknown): A11yPreferences {
	const prefs = typeof raw === 'object' && raw !== null ? (raw as Partial<A11yPreferences>) : {};
	return {
		fontScale: includes(FONT_SCALE_OPTIONS, prefs.fontScale) ? prefs.fontScale : DEFAULT_A11Y_PREFERENCES.fontScale,
		secondaryContrast: includes(SECONDARY_CONTRAST_OPTIONS, prefs.secondaryContrast) ? prefs.secondaryContrast : DEFAULT_A11Y_PREFERENCES.secondaryContrast,
		lineHeight: includes(LINE_HEIGHT_OPTIONS, prefs.lineHeight) ? prefs.lineHeight : DEFAULT_A11Y_PREFERENCES.lineHeight
	};
}

function assign(next: A11yPreferences) {
	a11yPreferences.fontScale = next.fontScale;
	a11yPreferences.secondaryContrast = next.secondaryContrast;
	a11yPreferences.lineHeight = next.lineHeight;
}

export function applyA11yPreferences(prefs = a11yPreferences) {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	root.style.fontSize = `calc(${BASE_FONT_PX}px * ${prefs.fontScale / 100})`;
	root.style.setProperty('--ui-line-height', `${prefs.lineHeight / 100}`);
	root.dataset.a11ySecondary = prefs.secondaryContrast;
}

function persist() {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...a11yPreferences }));
}

export function loadA11yPreferences() {
	if (loaded || typeof localStorage === 'undefined') {
		applyA11yPreferences();
		return;
	}
	loaded = true;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) assign(sanitize(JSON.parse(raw)));
	} catch {
		assign(DEFAULT_A11Y_PREFERENCES);
	}
	applyA11yPreferences();
}

export function setA11yPreference<K extends keyof A11yPreferences>(key: K, value: A11yPreferences[K]) {
	a11yPreferences[key] = value;
	persist();
	applyA11yPreferences();
}

export function resetA11yPreferences() {
	assign(DEFAULT_A11Y_PREFERENCES);
	persist();
	applyA11yPreferences();
}
