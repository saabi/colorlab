# Svelte Component Script Organization

Guidelines for structuring `.svelte` files in `fe/src/lib/components/` (and other UI components under `fe/src/lib/`). Pattern extracted from the [escriba_finanzas](https://github.com/) component library and its `docs/SVELTE_GUIDELINES.md`.

**Scope:** TypeScript in the two `<script>` blocks only. Svelte 5 runes (`$props`, `$state`, `$derived`, `$effect`) and `onclick` event syntax are assumed — see `AGENTS.md` and existing components.

---

## Why two script blocks?

Svelte 5 distinguishes:

| Block | Attribute | Runs | Holds |
|-------|-----------|------|-------|
| **Module script** | `<script module lang="ts">` | Once per module import | Imports, types, static constants, `export` types |
| **Instance script** | `<script lang="ts">` | Per component instance | Props, reactive state, effects, refs, handlers |

Separating them makes every file scannable: open a component, read the module block for its public contract, read the instance block for runtime behavior.

---

## File layout

```text
<script module lang="ts">   … contract …
<script lang="ts">          … instance logic …
<!-- markup -->
<style>                     … scoped styles …
```

Markup and `<style>` follow the scripts. HTML comments for usage docs (optional) go between scripts and markup.

---

## Module script (`<script module lang="ts">`)

Runs once when the file is first imported. Use **only** compile-time / shared definitions.

### Sections (in order)

1. `// ===== IMPORTS =====` — all imports (components, types, utilities, Svelte APIs used at module scope)
2. `// ===== TYPES =====` — `interface Props`, local helper types, `export interface` / `export type` for consumers
3. `// ===== STATIC CONSTANTS =====` — literals and objects that do **not** read props or instance state

### Rules

- **Props interface lives here**, not in the instance script.
- **Export types** from module script when other files import them (e.g. `import type { TableColumn } from './Table.svelte'`).
- Prefer importing shared domain types from `lib/engine/types.ts`, `lib/documents/`, etc. Define component-local shapes here only when they are not reused elsewhere.
- Static constants: `const MAX_ITEMS = 100`, default option lists, API path strings, animation keyframe names.

### Example (minimal)

```svelte
<script module lang="ts">
	// ===== IMPORTS =====
	import type { Snippet } from 'svelte';
	import type { AppState } from '$lib/engine/types';

	// ===== TYPES =====
	interface Props {
		state: AppState;
		onClose?: () => void;
		children?: Snippet;
	}

	// ===== STATIC CONSTANTS =====
	const DISMISS_MS = 2500;
</script>
```

---

## Instance script (`<script lang="ts">`)

Runs for each mounted instance. Holds all reactive and imperative logic.

### Sections (strict order)

Omit empty sections; **keep order** when a section is present.

| # | Comment | Contents |
|---|---------|----------|
| 1 | `// ===== IMPORTS =====` | Rare: instance-only imports (see exceptions below) |
| 2 | `// ===== PROPS =====` | `let { … }: Props = $props()` / `$bindable()` |
| 3 | `// ===== STATE =====` | `$state(…)` |
| 4 | `// ===== DERIVED =====` | `$derived(…)` / `$derived.by(…)` |
| 5 | `// ===== EFFECTS =====` | `$effect(…)` |
| 6 | `// ===== INSTANCE CONSTANTS =====` | Values computed once from props (e.g. `createX()` setup) |
| 7 | `// ===== REFS =====` | `bind:this` targets (`let el = $state<HTMLElement \| null>(null)`) |
| 8 | `// ===== LIFECYCLE =====` | `onMount`, `onDestroy`, etc. |
| 9 | `// ===== FUNCTIONS =====` | Handlers → utilities → `async` helpers |

### Rules

- **Props always first** in the instance block (after any instance-only imports).
- **Never** put `interface` / `type` definitions here — module script only.
- **Never** put static constants here — module script only.
- Inside **FUNCTIONS**, order: event handlers, then utilities, then async.
- **Lifecycle before FUNCTIONS** — do not declare `onMount` below handlers.
- Use `$state` for DOM refs when they participate in effects or bindings.

### Example

```svelte
<script lang="ts">
	// ===== PROPS =====
	let { state, onClose }: Props = $props();

	// ===== STATE =====
	let open = $state(false);

	// ===== DERIVED =====
	const explorer = $derived(state.explorer);

	// ===== EFFECTS =====
	$effect(() => {
		if (!open) return;
		const id = setTimeout(onClose ?? (() => {}), DISMISS_MS);
		return () => clearTimeout(id);
	});

	// ===== REFS =====
	let panelEl = $state<HTMLDivElement | null>(null);

	// ===== FUNCTIONS =====
	function handleDismiss() {
		open = false;
		onClose?.();
	}
</script>
```

---

## Exceptions

### Instance-script imports

Default: **all imports in module script**. Use a second `// ===== IMPORTS =====` at the top of the instance block only when an import must not run at module scope (uncommon in this repo). When in doubt, keep imports in module script.

### Types defined outside the component

Shared types stay in `lib/engine/types.ts`, `lib/documents/types.ts`, etc. The module script **imports** them; do not duplicate large interfaces in every `.svelte` file.

### Tiny components

A one-block file is acceptable only when it has **no** local types and **no** static constants — e.g. a 10-line presentational wrapper. When you add a `Props` interface or constants, split into two blocks immediately.

### `.svelte.ts` modules

`state.svelte.ts`, `session.svelte.ts`, and similar rune modules follow their own conventions; this doc applies to `.svelte` files.

---

## Procedure: reformat an existing component

Use this when touching a legacy single-script component (current state: most files under `fe/src/lib/components/`).

### 1. Inventory

Open the file and list:

- [ ] imports
- [ ] interfaces / types (including inline `$props<{…}>()`)
- [ ] `const` / `let` that are not reactive state
- [ ] `$props()` destructuring
- [ ] `$state`, `$derived`, `$effect`
- [ ] `onMount` / `onDestroy`
- [ ] functions
- [ ] DOM refs

### 2. Add module script

Create `<script module lang="ts">` as the **first** block in the file.

Move into it:

1. All imports (unless a documented exception applies).
2. Extract inline prop types into `interface Props { … }`.
3. Move static constants (values that never read props/state).

Add section comments (`// ===== IMPORTS =====`, etc.).

### 3. Rebuild instance script

Replace the old `<script lang="ts">` body with ordered sections:

1. Props destructuring typed with `Props` from module script.
2. State, derived, effects — preserve initialization order if effects depend on prior declarations.
3. Instance constants, refs, lifecycle, functions.

Remove duplicate imports and type definitions from the instance block.

### 4. Verify behavior

```sh
cd fe
npm run check
```

Manually smoke-test UI if the component handles interaction, dialogs, or persistence.

### 5. Before / after sketch

**Before (single script — current pattern in e.g. `ConfirmDialog.svelte`):**

```svelte
<script lang="ts">
	import { focusTrap } from '$lib/actions/focusTrap';

	let { open = false, message = '', onDiscard, onCancel } = $props<{
		open: boolean;
		message: string;
		onDiscard: () => void;
		onCancel: () => void;
	}>();
</script>
```

**After:**

```svelte
<script module lang="ts">
	// ===== IMPORTS =====
	import { focusTrap } from '$lib/actions/focusTrap';

	// ===== TYPES =====
	interface Props {
		open?: boolean;
		message?: string;
		confirmLabel?: string;
		onDiscard: () => void;
		onCancel: () => void;
	}
</script>

<script lang="ts">
	// ===== PROPS =====
	let {
		open = false,
		message = '',
		confirmLabel = 'Discard',
		onDiscard,
		onCancel
	}: Props = $props();
</script>
```

### 6. Incremental rollout

- **New components:** two-script layout from the first commit.
- **Edits to existing files:** refactor the script blocks in the same PR when the change is already invasive; otherwise add a follow-up task.
- **Large files** (`AppShell.svelte`, `Viewport.svelte`): refactor in dedicated PRs; split module script first (types + imports), then reorder instance sections without logic changes.

---

## Review checklist

### Module script

- [ ] Present on every non-trivial component
- [ ] `lang="ts"`
- [ ] Imports, types (including `Props`), static constants only
- [ ] Exported types use `export` when imported elsewhere

### Instance script

- [ ] Sections in documented order
- [ ] Section comments on non-empty groups
- [ ] No type definitions or static constants
- [ ] Lifecycle before FUNCTIONS
- [ ] `$props()` / `$bindable()` in PROPS section

### Syntax (unchanged project rules)

- [ ] `$props()`, `$state()`, `$derived()`, `$effect()` — no `export let`, `$:`, or `on:click`
- [ ] `npm run check` passes

---

## Reference implementations

In escriba_finanzas `app/src/lib/components/`:

| Pattern | File |
|---------|------|
| Minimal UI | `ui/Button.svelte` |
| State + effects + refs | `ui/Select.svelte`, `app/AppHeader.svelte` |
| Exported types | `ui/Table.svelte`, `forms/FormField.svelte` |
| Empty section placeholders | `ui/Modal.svelte` |

Color Lab equivalents to migrate first (small, high churn): `ConfirmDialog.svelte`, `NamePromptDialog.svelte`, `ControlGroup.svelte`, `SegmentedControl.svelte`, `ToggleRow.svelte`, `SliderRow.svelte`.
