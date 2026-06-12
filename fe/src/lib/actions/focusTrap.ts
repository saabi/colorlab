import type { Action } from 'svelte/action';

type FocusTrapOptions = {
	onEscape?: () => void;
	initialFocus?: boolean;
	returnFocus?: boolean;
};

const FOCUSABLE_SELECTOR = [
	'a[href]',
	'area[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'iframe',
	'object',
	'embed',
	'[contenteditable="true"]',
	'[tabindex]:not([tabindex="-1"])'
].join(',');

function isFocusable(element: HTMLElement) {
	if (element.hasAttribute('disabled')) return false;
	if (element.getAttribute('aria-hidden') === 'true') return false;
	const style = window.getComputedStyle(element);
	return style.display !== 'none' && style.visibility !== 'hidden';
}

function focusableChildren(node: HTMLElement) {
	return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isFocusable);
}

export const focusTrap: Action<HTMLElement, FocusTrapOptions | undefined> = (node, options = {}) => {
	let current = options;
	const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

	function focusInitial() {
		if (current.initialFocus === false) return;
		queueMicrotask(() => {
			if (node.contains(document.activeElement)) return;
			const [first] = focusableChildren(node);
			(first ?? node).focus();
		});
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && current.onEscape) {
			event.preventDefault();
			event.stopPropagation();
			current.onEscape();
			return;
		}

		if (event.key !== 'Tab') return;
		const focusable = focusableChildren(node);
		if (!focusable.length) {
			event.preventDefault();
			node.focus();
			return;
		}

		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = document.activeElement;

		if (event.shiftKey && (active === first || !node.contains(active))) {
			event.preventDefault();
			last.focus();
			return;
		}

		if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}

	node.addEventListener('keydown', onKeydown);
	focusInitial();

	return {
		update(next = {}) {
			current = next;
		},
		destroy() {
			node.removeEventListener('keydown', onKeydown);
			if (current.returnFocus === false) return;
			if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
		}
	};
};
