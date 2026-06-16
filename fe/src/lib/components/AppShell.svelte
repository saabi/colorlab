<script lang="ts">
	import LeftControls from './LeftControls.svelte';
	import RightInspector from './RightInspector.svelte';
	import Viewport from './Viewport.svelte';
	import AppInfo from './AppInfo.svelte';
	import A11yPanel from '$lib/a11y/A11yPanel.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import DocumentBar from './DocumentBar.svelte';
	import GuideNoteEditorHost from './GuideNoteEditorHost.svelte';
	import LanePicker from './LanePicker.svelte';
	import TutorialPopover from './TutorialPopover.svelte';
	import { rebuildMatrices } from '$lib/renderer/uniforms';
	import { createTutorialState } from '$lib/engine/tutorial.svelte';
	import { toSnapshot } from '$lib/documents/snapshot';
	import { decodeSnapshotParam, readShareParam } from '$lib/documents/share';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	import type { AppState } from '$lib/engine/types';
	import type { DocumentSession } from '$lib/documents/session.svelte';
	import type { HistoryController } from '$lib/history/history.svelte';
	import type { TouchTool } from './Viewport.svelte';

	let {
		state: appState = $bindable(),
		session,
		history
	} = $props<{ state: AppState; session: DocumentSession; history: HistoryController }>();
	const explorer = $derived(appState.explorer);
	const camera = $derived(appState.camera);
	const matrices = $derived(rebuildMatrices(explorer.gamut));
	let drawerOpen = $state(false);
	let touchTool: TouchTool = $state('auto');
	const tutorial = createTutorialState(() => explorer);
	let lanePickerOpen = $state(false);
	let readabilityOpen = $state(false);
	let aboutOpen = $state(false);

	// Minimal transient notice. NOTE: intentionally small — the deferred
	// shared-toast task generalizes this together with Viewport's `gestureStatus`.
	let notice = $state<{ text: string; id: number } | null>(null);
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	function notify(text: string) {
		notice = { text, id: Date.now() };
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = null), 2500);
	}

	// A `#s=...` hash carries a shared snapshot. Apply it over whatever the
	// session restored, then strip the token so reloads/saves start clean.
	onMount(() => {
		if (!browser) return;
		const param = readShareParam(window.location.hash);
		if (!param) return;
		void (async () => {
			const { snapshot } = await decodeSnapshotParam(param);
			if (snapshot) {
				await session.importSnapshot(snapshot, { source: 'url', confirm: false });
				notify('Loaded from shared link');
			} else {
				console.warn('[share] Ignoring an invalid or newer shared document in the URL.');
			}
			window.history.replaceState(null, '', window.location.pathname + window.location.search);
		})();
	});

	const TUTORIAL_WELCOMED_KEY = 'colorlab:tutorial-welcomed';
	$effect(() => {
		if (!localStorage.getItem(TUTORIAL_WELCOMED_KEY)) {
			lanePickerOpen = true;
			localStorage.setItem(TUTORIAL_WELCOMED_KEY, '1');
		}
	});

	$effect(() => {
		const snapshot = toSnapshot(appState);
		if (!history.matchesCurrent(snapshot)) history.scheduleCapture('Edit parameters');
	});

	/** Tutorial examples need shell, slice outlines, and ramp markers visible. */
	async function loadTutorialExample(id: string) {
		const ok = await session.loadDocument(id);
		if (!ok) return;
		appState.explorer.hideAids = false;
		appState.explorer.autoRotate = false;
	}

	function isEditableTarget(target: EventTarget | null) {
		const el = target as HTMLElement | null;
		return !!el?.closest('input, select, textarea, [contenteditable="true"]');
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (isEditableTarget(event.target)) return;
		const mod = event.ctrlKey || event.metaKey;
		if (!mod || event.altKey) return;
		const key = event.key.toLowerCase();
		if (key === 'z' && event.shiftKey) {
			event.preventDefault();
			history.redo();
			return;
		}
		if (key === 'z') {
			event.preventDefault();
			history.undo();
			return;
		}
		if (key === 'y') {
			event.preventDefault();
			history.redo();
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<GuideNoteEditorHost bind:explorer={appState.explorer}>
	<div class:drawer-open={drawerOpen} class="app-shell">
		<a class="skip-link" href="#main-viewport">Skip to viewport</a>
		<header class="app-header">
			<button
				type="button"
				class="drawer-toggle"
				aria-label="Open controls"
				aria-expanded={drawerOpen}
				onclick={() => {
					drawerOpen = !drawerOpen;
				}}
			>
				<span></span>
				<span></span>
				<span></span>
			</button>
			<div class="app-brand">
				<img class="app-isotype" src="/logo/isotype.png" alt="" width="32" height="32" />
				<h1>COLOR LAB</h1>
			</div>
			<span class="sub">Gamut Explorer &amp; Ramp Generator</span>
			<DocumentBar
				{session}
				{history}
				{notify}
				onTutorialClick={() => (lanePickerOpen = true)}
				onOpenReadability={() => (readabilityOpen = true)}
				onOpenAbout={() => (aboutOpen = true)}
			/>
			<A11yPanel bind:open={readabilityOpen} />
			<ThemeToggle />
			<AppInfo bind:open={aboutOpen} />
			<span class="badge">WebGL2</span>
		</header>

		<button
			type="button"
			class="drawer-backdrop"
			aria-label="Close controls"
			onclick={() => {
				drawerOpen = false;
			}}
		></button>
		<LeftControls bind:explorer={appState.explorer} {matrices} bind:camera={appState.camera} bind:touchTool />
		<Viewport bind:state={appState.explorer} bind:camera={appState.camera} bind:touchTool />
		<RightInspector state={explorer} />
	</div>
</GuideNoteEditorHost>

{#if notice}
	{#key notice.id}
		<div class="app-notice" role="status" aria-live="polite">{notice.text}</div>
	{/key}
{/if}

{#if lanePickerOpen}
	<LanePicker {tutorial} onClose={() => (lanePickerOpen = false)} />
{/if}
{#if tutorial.progress?.active}
	<TutorialPopover {tutorial} hideAids={explorer.hideAids} loadExample={loadTutorialExample} />
{/if}
