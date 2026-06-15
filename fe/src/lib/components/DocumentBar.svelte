<script lang="ts">
	import ConfirmDialog from './ConfirmDialog.svelte';
	import NamePromptDialog from './NamePromptDialog.svelte';
	import ShareDialog from './ShareDialog.svelte';
	import ImportDialog from './ImportDialog.svelte';
	import AppInfo from './AppInfo.svelte';
	import A11yPanel from '$lib/a11y/A11yPanel.svelte';
	import { track } from '$lib/analytics/umami';
	import { getGuideNoteContext } from '$lib/guide-note/context';
	import { UNTITLED_SELECT_ID } from '$lib/documents/session.svelte';
	import { snapshotToJsonString } from '$lib/documents/share';

	import type { DocumentSession } from '$lib/documents/session.svelte';
	import type { HistoryController } from '$lib/history/history.svelte';

	let {
		session,
		history,
		notify,
		onTutorialClick
	} = $props<{
		session: DocumentSession;
		history: HistoryController;
		notify?: (text: string) => void;
		onTutorialClick?: () => void;
	}>();

	let selectValue = $state(UNTITLED_SELECT_ID);
	let moreOpen = $state(false);
	let moreRoot: HTMLDivElement | undefined = $state();

	let namePromptOpen = $state(false);
	let namePromptTitle = $state('');
	let namePromptInitial = $state('');
	let namePromptMode = $state<'save' | 'saveAs' | 'rename'>('save');

	let deleteConfirmOpen = $state(false);
	let shareOpen = $state(false);
	let importOpen = $state(false);

	const guideNote = getGuideNoteContext();

	const switcherTitle = $derived(
		`${session.activeName}${session.isDirty ? ' (unsaved)' : ''}`
	);

	$effect(() => {
		selectValue = session.activeSelectId;
	});

	function closeMore() {
		moreOpen = false;
	}

	function toggleMore() {
		moreOpen = !moreOpen;
	}

	function onDocumentPointerDown(event: PointerEvent) {
		if (!moreOpen || !moreRoot) return;
		if (!moreRoot.contains(event.target as Node)) closeMore();
	}

	function onDocumentKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') closeMore();
	}

	function openNamePrompt(mode: 'save' | 'saveAs' | 'rename', title: string, initialValue = '') {
		namePromptMode = mode;
		namePromptTitle = title;
		namePromptInitial = initialValue;
		namePromptOpen = true;
		closeMore();
	}

	async function onNameSubmit(name: string) {
		namePromptOpen = false;
		if (namePromptMode === 'save') await session.save(name);
		else if (namePromptMode === 'saveAs') await session.saveAs(name);
		else await session.rename(name);
	}

	async function onSwitcherChange() {
		const id = selectValue;
		const previous = session.activeSelectId;
		const ok = await session.loadDocument(id);
		if (!ok) selectValue = previous;
	}

	async function onSave() {
		const saved = await session.save();
		if (!saved) openNamePrompt('save', 'Save parameter set as');
	}

	async function onNew() {
		await session.newDocument();
	}

	function onSaveToFile() {
		const json = snapshotToJsonString(session.currentSnapshot());
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const safe =
			session.activeName.trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'document';
		const a = document.createElement('a');
		a.href = url;
		a.download = `colorlab-${safe}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
		track('document_save', { mode: 'file' });
		notify?.('Saved to file');
		closeMore();
	}
</script>

<svelte:document onpointerdown={onDocumentPointerDown} onkeydown={onDocumentKeyDown} />

<div class="document-bar">
	<div class="document-switcher-wrap">
		<select
			class="document-switcher"
			bind:value={selectValue}
			onchange={onSwitcherChange}
			aria-label="Current parameter set"
			title={switcherTitle}
		>
			<option value={UNTITLED_SELECT_ID}>Untitled</option>
			<optgroup label="Examples">
				{#each session.exampleDocuments as doc (doc.id)}
					<option value={doc.id}>{doc.name}</option>
				{/each}
			</optgroup>
			{#if session.userDocuments.length}
				<optgroup label="My documents">
					{#each session.userDocuments as doc (doc.id)}
						<option value={doc.id}>{doc.name}</option>
					{/each}
				</optgroup>
			{/if}
		</select>
		{#if session.isDirty}
			<span class="document-dirty" aria-hidden="true">*</span>
		{/if}
	</div>

	<div class="document-actions">
		<button
			type="button"
			class="document-btn document-btn-icon"
			disabled={!history.canUndo}
			aria-label="Undo"
			title={history.undoLabel ? `Undo ${history.undoLabel}` : 'Undo'}
			onclick={() => history.undo()}
		>↶</button>
		<button
			type="button"
			class="document-btn document-btn-icon"
			disabled={!history.canRedo}
			aria-label="Redo"
			title={history.redoLabel ? `Redo ${history.redoLabel}` : 'Redo'}
			onclick={() => history.redo()}
		>↷</button>
		<button type="button" class="document-btn" onclick={onNew}>New</button>
		<button type="button" class="document-btn" data-tutorial="docbar-save" disabled={!session.canSave} onclick={onSave}>Save</button>

		<div class="document-more" bind:this={moreRoot}>
			<button
				type="button"
				class="document-btn document-btn-more"
				aria-expanded={moreOpen}
				aria-haspopup="menu"
				onclick={toggleMore}
			>
				<span class="document-more-label">More</span>
				<span class="document-more-icon-label" aria-hidden="true">⋯</span>
			</button>
			{#if moreOpen}
				<div class="document-more-menu" role="menu">
					<button
						type="button"
						role="menuitem"
						class="document-more-item document-more-item-mobile"
						onclick={() => {
							void onNew();
							closeMore();
						}}
					>
						<span class="document-more-icon" aria-hidden="true">✚</span>
						New
					</button>
					<button
						type="button"
						role="menuitem"
						class="document-more-item document-more-item-mobile"
						disabled={!session.canSave}
						onclick={() => {
							void onSave();
							closeMore();
						}}
					>
						<span class="document-more-icon" aria-hidden="true">❏</span>
						Save
					</button>
					<button
						type="button"
						role="menuitem"
						class="document-more-item"
						disabled={!session.canSaveAs}
						onclick={() => {
							openNamePrompt('saveAs', 'Save parameter set as');
						}}
					>
						<span class="document-more-icon" aria-hidden="true">⧉</span>
						Save As…
					</button>
					<button
						type="button"
						role="menuitem"
						class="document-more-item"
						onclick={onSaveToFile}
					>
						<span class="document-more-icon" aria-hidden="true">↧</span>
						Save to file…
					</button>
					<div class="document-more-sep" role="separator"></div>
					<button
						type="button"
						role="menuitem"
						class="document-more-item"
						onclick={() => {
							shareOpen = true;
							closeMore();
						}}
					>
						<span class="document-more-icon" aria-hidden="true">↗</span>
						Share…
					</button>
					<button
						type="button"
						role="menuitem"
						class="document-more-item"
						onclick={() => {
							importOpen = true;
							closeMore();
						}}
					>
						<span class="document-more-icon" aria-hidden="true">↥</span>
						Import…
					</button>
					<div class="document-more-sep" role="separator"></div>
					<button
						type="button"
						role="menuitem"
						class="document-more-item"
						onclick={() => {
							guideNote?.openEditor();
							closeMore();
						}}
					>
						<span class="document-more-icon" aria-hidden="true">✎</span>
						Guide note…
					</button>
					<button
						type="button"
						role="menuitem"
						class="document-more-item"
						disabled={!session.canRename}
						onclick={() => {
							openNamePrompt('rename', 'Rename parameter set', session.activeName);
						}}
					>
						<span class="document-more-icon" aria-hidden="true">✐</span>
						Rename…
					</button>
					<button
						type="button"
						role="menuitem"
						class="document-more-item document-more-item-danger"
						disabled={!session.canDelete}
						onclick={() => {
							deleteConfirmOpen = true;
							closeMore();
						}}
					>
						<span class="document-more-icon" aria-hidden="true">✕</span>
						Delete…
					</button>
					{#if onTutorialClick}
						<button
							type="button"
							role="menuitem"
							class="document-more-item document-more-item-mobile"
							onclick={() => {
								onTutorialClick();
								closeMore();
							}}
						>
							<span class="document-more-icon" aria-hidden="true">▷</span>
							Tutorial
						</button>
					{/if}
					<div class="document-more-mobile-tools">
						<A11yPanel />
						<AppInfo />
					</div>
				</div>
			{/if}
		</div>
		{#if onTutorialClick}
			<button type="button" class="document-btn document-btn-tutorial" onclick={onTutorialClick}>Tutorial</button>
		{/if}
	</div>
</div>

<ConfirmDialog
	open={session.confirmOpen}
	message={session.confirmMessage}
	onDiscard={session.confirmDiscard}
	onCancel={session.confirmCancel}
/>

<ConfirmDialog
	open={deleteConfirmOpen}
	message={`Delete "${session.activeName}"? This cannot be undone.`}
	confirmLabel="Delete"
	onDiscard={() => {
		deleteConfirmOpen = false;
		session.deleteActive();
	}}
	onCancel={() => {
		deleteConfirmOpen = false;
	}}
/>

<NamePromptDialog
	open={namePromptOpen}
	title={namePromptTitle}
	initialValue={namePromptInitial}
	onSubmit={(name) => {
		void onNameSubmit(name);
	}}
	onCancel={() => {
		namePromptOpen = false;
	}}
/>

<ShareDialog
	open={shareOpen}
	{notify}
	getSnapshot={() => session.currentSnapshot()}
	onClose={() => {
		shareOpen = false;
	}}
/>

<ImportDialog
	open={importOpen}
	{session}
	{notify}
	onClose={() => {
		importOpen = false;
	}}
/>
