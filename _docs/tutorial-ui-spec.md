# Tutorial UI — implementation spec

**Status:** design spec, not yet implemented.
**Content source:** `_docs/tutorial-teaching-points.md` (authoritative for all copy).
**Defer to a later pass:** animations, mobile layout, analytics events, keyboard-trap focus management.

---

## 1. Overview

The tutorial system walks users through one of four ordered tracks by showing a **persistent floating popover** that advances step-by-step. Each step:

- explains a concept,
- asks the user to try something,
- describes what success looks like,
- warns against the most common mistake.

The popover reuses the existing `PanelHelp` left-border row visual language (same four tones, same typography, same CSS variables). What is new is the persistent card framing, step navigation, and the per-step UI target highlighting.

**Total steps per track (including the 2-step shared prelude):**

| Track | Steps | Unique popup definitions |
|-------|-------|--------------------------|
| A-quick | 8 | 6 (+ 2 shared prelude) |
| A-pipeline | 8 | 6 (+ 2 shared prelude) |
| B-quick | 8 | 6 (+ 2 shared prelude) |
| B-pipeline | 9 | 7 (+ 2 shared prelude) |
| **Prelude (shared)** | **2** | **2** |
| **Total unique definitions** | — | **27** |

---

## 2. Entry point

A **"Tutorial"** text button lives in the document bar at the top of the app, to the right of the document name and source badge. It is always visible.

- Clicking it opens the **Lane Picker** (§3).
- If a tutorial is currently active, clicking it opens the lane picker with a "Restart" option rather than launching a fresh selector.
- On first visit (no saved tutorial state), the button can optionally show a subtle pulse animation to invite discovery — implement this as a one-time `localStorage` flag (`colorlab:tutorial:seen`).

No other entry point is required. The existing `guideNote` system on example documents is a separate, simpler mechanism and does not feed into this system.

---

## 3. Lane picker

A centered modal overlay (not full-screen dimming — just a centered card with a dark semi-transparent backdrop). It presents two dimensions of choice:

```
┌─────────────────────────────────────────────────────────┐
│  What do you want to do?                           [×]  │
├──────────────────────────────┬──────────────────────────┤
│  Explore color spaces        │  Design a palette        │
│                              │                          │
│  Understand gamuts, gamut    │  Build smooth, harmonic  │
│  geometry, slices, and the   │  ramps that are evenly   │
│  numeric color chain.        │  spaced in perceptual    │
│                              │  space — not sRGB.       │
│  ○ Quick start  ~15 min      │  ○ Quick start  ~15 min  │
│  ○ Full pipeline ~25 min     │  ○ Full pipeline ~30 min │
│                              │                          │
│  [Start A-quick]             │  [Start B-quick]         │
│  [Start A-pipeline]          │  [Start B-pipeline]      │
└──────────────────────────────┴──────────────────────────┘
```

- Selecting a radio updates the primary CTA button label.
- Clicking the CTA closes the modal, writes the track choice to session state, and opens the popover at step 1 (prelude step 1).
- The `×` dismisses the picker without starting a tutorial.
- If a tutorial was previously in progress, the picker header changes to **"Resume or restart?"** and adds a **"Resume from step N"** CTA above the track grid.

---

## 4. Popup anatomy

A new `TutorialPopover.svelte` component. It is **not** a `PanelHelp` instance (which is tied to a `HelpId` and a `?` trigger button) — it is a standalone persistent card that renders the same row style independently.

### Visual structure

```
┌─────────────────────────────────────────┐
│  A-quick · Step 3 of 8            [×]  │  ← header bar (dim text + close)
├─────────────────────────────────────────┤
│▌ The solid is a gamut                   │  ← tone: neutral  (concept title + body)
│  Most color tools show a gamut as a 2D  │
│  triangle… Color Lab renders the full   │
│  3D volume…                             │
├─────────────────────────────────────────┤
│▌ Try it                                 │  ← tone: change   (action)
│  Orbit the solid by clicking and        │
│  dragging…                              │
├─────────────────────────────────────────┤
│▌ Success check                          │  ← tone: output   (positive)
│  You can orient yourself — brighter     │
│  up, more chromatic outward…            │
├─────────────────────────────────────────┤
│▌ Common mistake                         │  ← tone: exclude  (warning)
│  Thinking the solid's shape is          │
│  decorative…                            │
├─────────────────────────────────────────┤
│  [← Back]          Step 3 / 8  [Next →] │  ← footer nav
└─────────────────────────────────────────┘
```

### Tone mapping to existing CSS classes

Reuse the four existing `panel-help-stage-row` modifier classes directly. No new CSS border colors needed.

| Tutorial field | Existing tone class | Border color |
|----------------|--------------------|----|
| Concept | `neutral` | `color-mix(in srgb, var(--dim), transparent 45%)` — blue-gray |
| Try it | `change` | `color-mix(in srgb, var(--accent), transparent 20%)` — accent |
| Success check | `output` | `#65bfa8` — teal |
| Common mistake | `exclude` | `#a06f6f` — muted rose |

The row structure is:

```svelte
<div class="tutorial-row neutral">
  <span class="tutorial-row-label">Concept</span>
  <span class="tutorial-row-text">{step.concept}</span>
</div>
```

Row label column width matches `panel-help-stage-row` (82 px label, `1fr` text). The same `font-size: 11px` and `line-height: 1.4` body copy, `font-size: 9px` uppercase label cap.

### Card dimensions

- Width: 300 px (same cap as `PanelHelp`).
- Max height: 420 px with internal scroll on the content area only (not the header/footer).
- Shadow: `0 4px 16px rgba(0,0,0,0.4)` — slightly stronger than the help popover since it is persistent.
- Border radius: match existing popover (`var(--radius)` or 6 px).
- Background: `var(--bg2)` (same as `panel-help-popover`).

### Header bar

```
A-quick · Step 3 of 8   [×]
```

- Left text: `{trackLabel} · Step {n} of {total}` in `var(--dim)` at 10 px.
- Right: a `×` icon button. Click stops the tutorial (see §6).
- Bottom border: `1px solid var(--border)`.

### Footer nav

- Left: `← Back` button. Disabled (greyed) on step 1.
- Center: `{n} / {total}` pip strip or plain counter — keep simple for v1: plain text `{n} / {total}` in `var(--faint)` at 10 px.
- Right: `Next →` button. On the final step, label changes to `Done`.
- `Done` closes the tutorial and clears session state.
- Top border: `1px solid var(--border)`.

---

## 5. Placement system

Each step declares a **placement zone** and optionally a **target selector**. The popover component reads these to position itself and highlight the target.

### Zones

| Zone | Description | Popover position |
|------|-------------|-----------------|
| `sidebar-inline` | A pipeline step in the left sidebar | Adjacent to the right edge of the sidebar panel, vertically aligned with the target step header. Falls back to below the target if no room on the right. |
| `viewport-float` | Whole-viewport interaction (orbit, hover, pick) | Fixed to the **bottom-left corner** of the viewport canvas, 16 px from the bottom and left edges. Does not chase a target element. |
| `inspector-adjacent` | Right inspector tabs/panels | Adjacent to the left edge of the inspector panel, vertically centred on the target tab. |
| `docbar-adjacent` | Document bar (save, title) | Below the document bar, horizontally centred on the target button. |

### Target highlighting

When a step has a `target` selector, the matched element receives the CSS class `tutorial-target`. No dimming overlay — only a **subtle animated ring**:

```css
.tutorial-target {
  outline: 2px solid color-mix(in srgb, var(--accent), transparent 30%);
  outline-offset: 3px;
  border-radius: 4px;
  animation: tutorial-pulse 1.6s ease-in-out infinite;
}

@keyframes tutorial-pulse {
  0%, 100% { outline-color: color-mix(in srgb, var(--accent), transparent 30%); }
  50%       { outline-color: color-mix(in srgb, var(--accent), transparent 65%); }
}
```

The class is added/removed reactively as the step changes. Only one element is highlighted at a time. Steps with zone `viewport-float` set no `target` — the whole canvas is implicitly the work area.

### Arrow connector

When zone is `sidebar-inline` or `inspector-adjacent`, draw a small SVG triangle arrow from the popover edge toward the target element. The arrow flips side automatically based on which side has more room (same logic as `placePopover` in `PanelHelp`). Skip the arrow for `viewport-float` and `docbar-adjacent`.

---

## 6. Navigation controls

### Next / Back
- Both are available at any step except `← Back` on step 1 (disabled).
- Clicking `Next →` on the final step is equivalent to `Done` — closes the tutorial, clears active state, does not retain step index.
- Clicking `← Back` never re-triggers the target highlight animation from scratch; it just moves the index and re-highlights the appropriate element.

### Stop (×)
- Click `×` in the header: immediately closes the popover.
- **No confirm dialog.** The session state retains the last step index so the user can resume via the Lane Picker.
- Does not reset the index — "resume" from that step is always available.

### Resume
- On any page load or tab restore: if session state has `{ active: true, trackId, stepIndex }`, the tutorial popover reopens automatically at the saved step **after** a 400 ms delay (let the app render first).
- If the user prefers not to auto-resume, they can click `×` immediately; the resume prompt is then surfaced passively via the Tutorial button in the document bar.

### Restart
- Available in the Lane Picker when a tutorial was previously started (see §3).
- Resets `stepIndex` to 0 and starts the prelude of the selected track.
- Can also be reached mid-tutorial via a small **"Restart"** link in the popover header (secondary, text-only, at 9 px):

```
A-quick · Step 3 of 8  [Restart]  [×]
```

### Done
- On the final step, `Next →` becomes `Done`.
- Clicking `Done` shows a brief **one-line completion note** inside the popover (replacing the content area): *"Track complete. Open any pipeline step to explore further."* with a `Close` button.
- After close: tutorial state is cleared; tutorial is no longer active.

---

## 7. State model

A single runtime + sessionStorage object (not part of `AppState` or document persistence):

```ts
interface TutorialProgress {
  trackId: 'a-quick' | 'a-pipeline' | 'b-quick' | 'b-pipeline';
  stepIndex: number;   // 0-based; 0 = prelude step 1
  active: boolean;
}
```

Storage key: `colorlab:tutorial` (sessionStorage — survives tab restore, not cross-tab).

The tutorial state is **entirely separate** from `AppState`, `PersistedAppState`, and the `guideNote` field. It is not saved to named documents.

A Svelte 5 rune store in `fe/src/lib/engine/tutorial.svelte.ts`. Full type definitions, derived values, and implementation are in §10.2–10.3. The store is instantiated once in `AppShell.svelte` and threaded to `TutorialPopover` and `LanePicker` as a typed prop (§10.4).

---

## 8. Step inventory

Full list of step → placement zone → target selector. The `target` column is a CSS selector relative to the document root. `—` means no target element (full-area interaction).

### Prelude (all tracks)

| Step | Title | Zone | Target |
|------|-------|------|--------|
| 1 | Turn off auto-rotation | `sidebar-inline` | `[data-tutorial="auto-rotate"]` |
| 2 | Show overlay aids | `sidebar-inline` | `[data-tutorial="hide-aids"]` |

### A-quick

| Step | Title | Zone | Target |
|------|-------|------|--------|
| 3 | The solid is a gamut | `viewport-float` | — |
| 4 | Orbit and inspect a hover | `viewport-float` | — |
| 5 | Change gamut, compare shape | `sidebar-inline` | `[data-tutorial="gamut-select"]` |
| 6 | Shell overlay | `sidebar-inline` | `[data-tutorial="shell-select"]` |
| 7 | Slice at fixed lightness | `sidebar-inline` | `[data-tutorial="slice-toggle"]` |
| 8 | Inspector panels | `inspector-adjacent` | `[data-tutorial="inspector-tabs"]` |

### A-pipeline

| Step | Title | Zone | Target |
|------|-------|------|--------|
| 3 | Gamut — primaries and transfer | `sidebar-inline` | `[data-tutorial="node-gamut"]` |
| 4 | World space — geometry only | `sidebar-inline` | `[data-tutorial="node-world"]` |
| 5 | Tessellation — mesh resolution | `sidebar-inline` | `[data-tutorial="node-tessellation"]` |
| 6 | Clip / cut — slice and cylinder | `sidebar-inline` | `[data-tutorial="node-clip"]` |
| 7 | View — camera and floor | `sidebar-inline` | `[data-tutorial="node-view"]` |
| 8 | Vision — CVD is display only | `sidebar-inline` | `[data-tutorial="node-cvd"]` |

### B-quick

| Step | Title | Zone | Target |
|------|-------|------|--------|
| 3 | Add two or three source colors | `sidebar-inline` | `[data-tutorial="node-sources"]` |
| 4 | Interpolate on — linear vs spline | `sidebar-inline` | `[data-tutorial="node-interpolate"]` |
| 5 | Place on — where the stops land | `sidebar-inline` | `[data-tutorial="node-adjust"]` |
| 6 | Read the palette | `inspector-adjacent` | `[data-tutorial="inspector-palette-tab"]` |
| 7 | Export the ramp | `sidebar-inline` | `[data-tutorial="node-export"]` |
| 8 | Save the document | `docbar-adjacent` | `[data-tutorial="docbar-save"]` |

### B-pipeline

| Step | Title | Zone | Target |
|------|-------|------|--------|
| 3 | Sources — lists, anchors, picking | `sidebar-inline` | `[data-tutorial="node-sources"]` |
| 4 | Interpolate — path and space | `sidebar-inline` | `[data-tutorial="node-interpolate"]` |
| 5 | Place — sampling the curve | `sidebar-inline` | `[data-tutorial="node-adjust"]` |
| 6 | Expand — 1-D ramp to 2-D grid | `sidebar-inline` | `[data-tutorial="node-expand"]` |
| 7 | Gamut map — ramp-only OOG policy | `sidebar-inline` | `[data-tutorial="node-gamut-map"]` |
| 8 | Export — tokens and format | `sidebar-inline` | `[data-tutorial="node-export"]` |
| 9 | Multi-list ramps — parallel pipelines | `sidebar-inline` | `[data-tutorial="node-sources"]` |

`data-tutorial` attributes are added to existing elements in the relevant Svelte components during implementation — no new wrapper elements needed.

---

## 9. Touch surface

| File | Change |
|------|--------|
| `fe/src/lib/engine/tutorial.svelte.ts` | New: `TutorialProgress` type, `createTutorialState()` rune store, sessionStorage read/write |
| `fe/src/lib/components/TutorialPopover.svelte` | New: persistent card component, row rendering, placement + arrow logic, highlight class management |
| `fe/src/lib/components/LanePicker.svelte` | New: modal with 2×2 track grid, radio + CTA, resume row |
| `fe/src/lib/components/AppShell.svelte` | Add: `tutorialState` instance, pass to `TutorialPopover` and `LanePicker`; mount popover at root level (not inside a sidebar or inspector container) |
| `fe/src/lib/components/DocumentBar.svelte` | Add: "Tutorial" button, `data-tutorial="docbar-save"` on Save button |
| `fe/src/lib/components/LeftControls.svelte` | Add: `data-tutorial` attributes on sidebar footer toggles and pipeline node headers |
| `fe/src/lib/components/RightInspector.svelte` | Add: `data-tutorial` attributes on inspector tab strip and Palette tab |
| `fe/src/lib/inspector/tutorial-steps.ts` | New: the full step content array (`TutorialStep[]`), mapping track → step index → `{ concept, tryIt, successCheck, commonMistake, zone, target }` |
| `fe/src/app.css` or `TutorialPopover.svelte` styles | Add: `.tutorial-target` pulse ring CSS |

No changes to `engine/types.ts`, `engine/state.svelte.ts`, `documents/`, or the schema version.

---

## 10. Svelte component design

### 10.1 Component tree

```
AppShell.svelte
  ├── DocumentBar.svelte          ← "Tutorial" button; data-tutorial="docbar-save" on Save
  ├── LeftControls.svelte         ← data-tutorial attrs on footer toggles + node headers
  ├── Viewport.svelte             ← data-tutorial="viewport-canvas" on <canvas>
  ├── RightInspector.svelte       ← data-tutorial attrs on tab strip + Palette tab
  ├── LanePicker.svelte           ← modal; rendered at root; shown/hidden via $state flag
  └── TutorialPopover.svelte      ← persistent card; rendered at root; shown when active
```

`LanePicker` and `TutorialPopover` are siblings of the layout panels, not children of any sidebar or inspector container. They are mounted directly in `AppShell` so they can overlay the full viewport without being clipped by a parent's `overflow: hidden`.

---

### 10.2 TypeScript types (`fe/src/lib/engine/tutorial.svelte.ts`)

```ts
export type TrackId = 'a-quick' | 'a-pipeline' | 'b-quick' | 'b-pipeline';
export type TutorialZone =
  | 'sidebar-inline'
  | 'viewport-float'
  | 'inspector-adjacent'
  | 'docbar-adjacent';

export interface TutorialStep {
  title: string;
  concept: string;
  tryIt: string;
  successCheck: string;
  commonMistake: string;
  zone: TutorialZone;
  /** CSS selector matching a `data-tutorial` attribute, or null for whole-area steps. */
  target: string | null;
  /** Optional example id to surface a "Load example" affordance (not auto-loaded). */
  suggestedExample?: string;
}

export interface TutorialTrack {
  id: TrackId;
  label: string;           // "A-quick", "B-pipeline", etc.
  durationMin: number;
  /** Fully assembled step list: PRELUDE_STEPS prepended at build time. */
  steps: TutorialStep[];
}

export interface TutorialProgress {
  trackId: TrackId;
  stepIndex: number;  // 0-based; 0 and 1 are always the two prelude steps
  active: boolean;    // false = stopped/paused but index preserved for resume
}
```

The content arrays (`PRELUDE_STEPS`, `A_QUICK_STEPS`, etc.) live in a separate file `fe/src/lib/inspector/tutorial-steps.ts` (no Svelte, pure data). `tutorial.svelte.ts` imports them and assembles `TRACKS`:

```ts
// tutorial-steps.ts  (excerpt)
export const PRELUDE_STEPS: TutorialStep[] = [
  {
    title: 'Turn off auto-rotation',
    concept: '...',
    tryIt: '...',
    successCheck: '...',
    commonMistake: '...',
    zone: 'sidebar-inline',
    target: '[data-tutorial="auto-rotate"]'
  },
  // ...
];

export const A_QUICK_STEPS: TutorialStep[] = [ /* steps 3-8 */ ];
// A_PIPELINE_STEPS, B_QUICK_STEPS, B_PIPELINE_STEPS ...
```

```ts
// tutorial.svelte.ts  (excerpt)
import { PRELUDE_STEPS, A_QUICK_STEPS, A_PIPELINE_STEPS, B_QUICK_STEPS, B_PIPELINE_STEPS }
  from '$lib/inspector/tutorial-steps';

export const TRACKS: Record<TrackId, TutorialTrack> = {
  'a-quick':    { id: 'a-quick',    label: 'A-quick',    durationMin: 15,
                  steps: [...PRELUDE_STEPS, ...A_QUICK_STEPS] },
  'a-pipeline': { id: 'a-pipeline', label: 'A-pipeline', durationMin: 25,
                  steps: [...PRELUDE_STEPS, ...A_PIPELINE_STEPS] },
  'b-quick':    { id: 'b-quick',    label: 'B-quick',    durationMin: 15,
                  steps: [...PRELUDE_STEPS, ...B_QUICK_STEPS] },
  'b-pipeline': { id: 'b-pipeline', label: 'B-pipeline', durationMin: 30,
                  steps: [...PRELUDE_STEPS, ...B_PIPELINE_STEPS] },
};
```

---

### 10.3 `createTutorialState()` — the rune store

Instantiated **once** in `AppShell.svelte`. All child components that need tutorial data receive the return value as a typed prop — no Svelte context or global store needed.

```ts
// tutorial.svelte.ts
const STORAGE_KEY = 'colorlab:tutorial';

function load(): TutorialProgress | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function persist(p: TutorialProgress | null) {
  if (p) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  else sessionStorage.removeItem(STORAGE_KEY);
}

export function createTutorialState() {
  let progress = $state<TutorialProgress | null>(load());

  // Derived values — recomputed reactively whenever progress changes.
  const track = $derived(progress ? TRACKS[progress.trackId] : null);
  const step  = $derived(track && progress ? (track.steps[progress.stepIndex] ?? null) : null);
  const total = $derived(track?.steps.length ?? 0);
  const isFirst = $derived(progress?.stepIndex === 0);
  const isLast  = $derived(!!progress && progress.stepIndex === total - 1);

  return {
    // Reactive reads (accessed as getters so rune tracking works across component boundaries)
    get progress() { return progress; },
    get track()    { return track; },
    get step()     { return step; },
    get total()    { return total; },
    get isFirst()  { return isFirst; },
    get isLast()   { return isLast; },

    start(trackId: TrackId) {
      progress = { trackId, stepIndex: 0, active: true };
      persist(progress);
    },
    next() {
      if (!progress || isLast) return;
      progress = { ...progress, stepIndex: progress.stepIndex + 1 };
      persist(progress);
    },
    back() {
      if (!progress || isFirst) return;
      progress = { ...progress, stepIndex: progress.stepIndex - 1 };
      persist(progress);
    },
    stop() {
      // Preserves stepIndex so resume works.
      if (progress) { progress = { ...progress, active: false }; persist(progress); }
    },
    done() {
      // Clears entirely — no resume after Done.
      progress = null; persist(null);
    },
    restart(trackId: TrackId) {
      progress = { trackId, stepIndex: 0, active: true };
      persist(progress);
    }
  };
}

export type TutorialState = ReturnType<typeof createTutorialState>;
```

---

### 10.4 `AppShell.svelte` wiring

```svelte
<script lang="ts">
  import { createTutorialState } from '$lib/engine/tutorial.svelte';
  import TutorialPopover from './TutorialPopover.svelte';
  import LanePicker from './LanePicker.svelte';

  // ...existing AppShell state...

  const tutorial = createTutorialState();
  let lanePickerOpen = $state(false);

  function openLanePicker() { lanePickerOpen = true; }
</script>

<!-- existing layout: DocumentBar, LeftControls, Viewport, RightInspector -->
<DocumentBar {tutorial} onTutorialClick={openLanePicker} ... />
<!-- ... -->

<!-- Tutorial overlays — siblings of layout, not children of any scrollable panel -->
{#if lanePickerOpen}
  <LanePicker {tutorial} onClose={() => (lanePickerOpen = false)} />
{/if}

{#if tutorial.progress?.active}
  <TutorialPopover {tutorial} />
{/if}
```

`DocumentBar` receives the `tutorial` object to conditionally render a "Resume" badge on the Tutorial button when `tutorial.progress` exists and `active === false`.

---

### 10.5 `TutorialPopover.svelte`

**Props:**
```ts
let { tutorial }: { tutorial: TutorialState } = $props();
```

**Target highlighting via `$effect`:**

The effect tracks `tutorial.step?.target`. When it changes (Next/Back), the cleanup function removes the class from the old element before the new effect run adds it to the new one.

```svelte
<script lang="ts">
  // ...
  $effect(() => {
    const selector = tutorial.step?.target;
    if (!selector) return;
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add('tutorial-target');
    return () => el.classList.remove('tutorial-target');
  });
</script>
```

**Popover positioning via `$effect`:**

A separate effect reacts to both `tutorial.step` (zone/target change) and window size. It writes to a `$state` style string consumed by the card's `style` attribute.

```svelte
<script lang="ts">
  let cardStyle = $state('');

  $effect(() => {
    const step = tutorial.step;
    if (!step) return;

    function place() {
      if (step.zone === 'viewport-float') {
        const canvas = document.querySelector('[data-tutorial="viewport-canvas"]');
        if (!canvas) return;
        const r = canvas.getBoundingClientRect();
        cardStyle = `position:fixed; left:${r.left + 16}px; bottom:${window.innerHeight - r.bottom + 16}px`;

      } else if (step.zone === 'sidebar-inline') {
        const sidebar = document.querySelector('[data-tutorial="sidebar"]');
        const target  = step.target ? document.querySelector(step.target) : sidebar;
        if (!sidebar || !target) return;
        const sr = sidebar.getBoundingClientRect();
        const tr = target.getBoundingClientRect();
        const top = Math.max(8, Math.min(tr.top, window.innerHeight - 460));
        cardStyle = `position:fixed; left:${sr.right + 8}px; top:${top}px`;

      } else if (step.zone === 'inspector-adjacent') {
        const inspector = document.querySelector('[data-tutorial="inspector"]');
        const target    = step.target ? document.querySelector(step.target) : inspector;
        if (!inspector || !target) return;
        const ir = inspector.getBoundingClientRect();
        const tr = target.getBoundingClientRect();
        const top = Math.max(8, Math.min(tr.top, window.innerHeight - 460));
        cardStyle = `position:fixed; right:${window.innerWidth - ir.left + 8}px; top:${top}px`;

      } else if (step.zone === 'docbar-adjacent') {
        const el = step.target ? document.querySelector(step.target) : null;
        if (!el) return;
        const r = el.getBoundingClientRect();
        cardStyle = `position:fixed; left:${r.left}px; top:${r.bottom + 8}px`;
      }
    }

    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  });
</script>
```

**Arrow connector:**

When zone is `sidebar-inline` or `inspector-adjacent`, a small CSS-triangle pseudo-element on the card's edge points toward the target. Implemented as a `::before` pseudo on the `.tutorial-card` element with a class that flips based on which side the card is on:

```css
.tutorial-card.arrow-left::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 20px;
  border: 6px solid transparent;
  border-right-color: var(--bg2);
}
.tutorial-card.arrow-right::before {
  content: '';
  position: absolute;
  right: -6px;
  top: 20px;
  border: 6px solid transparent;
  border-left-color: var(--bg2);
}
```

The `arrow-left` / `arrow-right` class is set by the placement logic above.

**Markup (abbreviated):**

```svelte
<div class="tutorial-card" class:arrow-left={arrowDir === 'left'}
     class:arrow-right={arrowDir === 'right'} style={cardStyle}>

  <!-- Header -->
  <div class="tutorial-header">
    <span class="tutorial-track-label">
      {tutorial.track?.label} · Step {(tutorial.progress?.stepIndex ?? 0) + 1} of {tutorial.total}
    </span>
    <button onclick={() => tutorial.stop()} aria-label="Stop tutorial">×</button>
    <button class="tutorial-restart" onclick={onRestart}>Restart</button>
  </div>

  <!-- Content rows — reuse panel-help-stage-row CSS classes -->
  <div class="tutorial-body">
    <div class="panel-help-stage-row neutral">
      <span class="panel-help-stage-label">Concept</span>
      <span class="panel-help-stage-text">{tutorial.step?.concept}</span>
    </div>
    <div class="panel-help-stage-row change">
      <span class="panel-help-stage-label">Try it</span>
      <span class="panel-help-stage-text">{tutorial.step?.tryIt}</span>
    </div>
    <div class="panel-help-stage-row output">
      <span class="panel-help-stage-label">Success check</span>
      <span class="panel-help-stage-text">{tutorial.step?.successCheck}</span>
    </div>
    <div class="panel-help-stage-row exclude">
      <span class="panel-help-stage-label">Common mistake</span>
      <span class="panel-help-stage-text">{tutorial.step?.commonMistake}</span>
    </div>
  </div>

  <!-- Footer nav -->
  <div class="tutorial-footer">
    <button onclick={() => tutorial.back()} disabled={tutorial.isFirst}>← Back</button>
    <span class="tutorial-counter">{(tutorial.progress?.stepIndex ?? 0) + 1} / {tutorial.total}</span>
    {#if tutorial.isLast}
      <button onclick={() => tutorial.done()}>Done</button>
    {:else}
      <button onclick={() => tutorial.next()}>Next →</button>
    {/if}
  </div>
</div>
```

Note: the `.panel-help-stage-row`, `.panel-help-stage-label`, and `.panel-help-stage-text` CSS classes are defined in `PanelHelp.svelte` as `<style>` scoped styles, so they are **not** globally available. Two options:

- **Option A (recommended):** Extract those ~30 lines of row CSS into `fe/src/app.css` as global rules, and remove the duplicate from `PanelHelp.svelte`. `TutorialPopover` then uses the same classes with no duplication.
- **Option B:** Copy the row CSS into `TutorialPopover.svelte`'s own `<style>` block with `:global()` — acceptable but creates a second source of truth.

Option A is the cleaner path: the row style is design-system-level, not component-private.

---

### 10.6 `LanePicker.svelte`

**Props:**
```ts
let {
  tutorial,
  onClose
}: {
  tutorial: TutorialState;
  onClose: () => void;
} = $props();
```

**State:**
```svelte
<script lang="ts">
  type UsePurpose = 'explore' | 'design';
  type Depth = 'quick' | 'pipeline';

  let purpose = $state<UsePurpose>('explore');
  let depth   = $state<Depth>('quick');

  const selectedTrack = $derived<TrackId>(
    purpose === 'explore'
      ? (depth === 'quick' ? 'a-quick' : 'a-pipeline')
      : (depth === 'quick' ? 'b-quick' : 'b-pipeline')
  );

  const hasProgress = $derived(!!tutorial.progress);

  function start() {
    tutorial.start(selectedTrack);
    onClose();
  }

  function resume() {
    if (!tutorial.progress) return;
    // Just reactivate — stepIndex preserved.
    tutorial.restart(tutorial.progress.trackId); // or a dedicated `resume()` action
    onClose();
  }
</script>
```

**Markup (abbreviated):**

```svelte
<!-- backdrop -->
<div class="lane-picker-backdrop" onclick={onClose} role="presentation"></div>

<div class="lane-picker-card" role="dialog" aria-modal="true" aria-label="Start tutorial">
  <div class="lane-picker-header">
    <span>What do you want to do?</span>
    <button onclick={onClose} aria-label="Close">×</button>
  </div>

  {#if hasProgress}
    <div class="lane-picker-resume">
      <button onclick={resume}>
        Resume {tutorial.track?.label} — step {(tutorial.progress?.stepIndex ?? 0) + 1} of {tutorial.total}
      </button>
    </div>
  {/if}

  <!-- 2×2 purpose + depth grid -->
  <div class="lane-picker-grid">
    <!-- Explore column -->
    <div class="lane-col" class:selected={purpose === 'explore'} onclick={() => purpose = 'explore'}>
      <h3>Explore color spaces</h3>
      <p>Understand gamuts, geometry, slices, and the numeric color chain.</p>
      <label><input type="radio" bind:group={depth} value="quick" /> Quick start ~15 min</label>
      <label><input type="radio" bind:group={depth} value="pipeline" /> Full pipeline ~25 min</label>
    </div>
    <!-- Design column -->
    <div class="lane-col" class:selected={purpose === 'design'} onclick={() => purpose = 'design'}>
      <h3>Design a palette</h3>
      <p>Build smooth, harmonic ramps spaced in perceptual color space — not sRGB.</p>
      <label><input type="radio" bind:group={depth} value="quick" /> Quick start ~15 min</label>
      <label><input type="radio" bind:group={depth} value="pipeline" /> Full pipeline ~30 min</label>
    </div>
  </div>

  <button class="lane-picker-start" onclick={start}>
    Start {TRACKS[selectedTrack].label}
  </button>
</div>
```

The depth radio state (`quick` / `pipeline`) is shared between both columns via `bind:group` — selecting a depth in either column applies to both, which is intentional (the user picks purpose by clicking a column, depth by the radio). Clicking a column header sets `purpose` directly.

---

### 10.7 `data-tutorial` attribute inventory

These attributes are added to existing elements — no new wrapper elements, no structural changes.

| Attribute value | File | Element |
|-----------------|------|---------|
| `auto-rotate` | `LeftControls.svelte` | Auto-rotate footer toggle `<button>` or `<label>` |
| `hide-aids` | `LeftControls.svelte` | Hide aids footer toggle |
| `sidebar` | `LeftControls.svelte` | The sidebar root `<nav>` or `<aside>` |
| `node-gamut` | `LeftControls.svelte` | Gamut pipeline node header/button |
| `node-world` | `LeftControls.svelte` | World space node header |
| `node-tessellation` | `LeftControls.svelte` | Tessellation node header |
| `node-clip` | `LeftControls.svelte` | Clip node header |
| `node-view` | `LeftControls.svelte` | View node header |
| `node-cvd` | `LeftControls.svelte` | Vision node header |
| `node-sources` | `LeftControls.svelte` | Sources node header |
| `node-interpolate` | `LeftControls.svelte` | Interpolate node header |
| `node-adjust` | `LeftControls.svelte` | Place node header |
| `node-expand` | `LeftControls.svelte` | Expand node header |
| `node-gamut-map` | `LeftControls.svelte` | Gamut map node header |
| `node-export` | `LeftControls.svelte` | Export node header |
| `gamut-select` | `LeftControls.svelte` | Gamut selector `<select>` or custom dropdown |
| `shell-select` | `LeftControls.svelte` | Shell overlay selector |
| `slice-toggle` | `LeftControls.svelte` | Slice enable toggle |
| `viewport-canvas` | `Viewport.svelte` | `<canvas>` element |
| `inspector` | `RightInspector.svelte` | Inspector root panel |
| `inspector-tabs` | `RightInspector.svelte` | Tab strip container |
| `inspector-palette-tab` | `RightInspector.svelte` | Palette tab button |
| `docbar-save` | `DocumentBar.svelte` | Save / Save as button |

One attribute per element; `data-tutorial="..."` coexists with any existing `data-*` or ARIA attributes without conflict.

---

### 10.8 Z-index layering

| Layer | Element | z-index |
|-------|---------|---------|
| Sidebar / inspector | Existing panels | 10–50 (existing) |
| Help popovers | `PanelHelp` popover | 100 (existing `panel-help-popover`) |
| Tutorial popover | `TutorialPopover` card | 120 |
| Lane picker backdrop | `LanePicker` backdrop | 140 |
| Lane picker card | `LanePicker` card | 150 |

The tutorial popover sits above help popovers (it is persistent; it should win). The lane picker sits above both (it is modal).

---

### 10.9 Escape key and focus

`TutorialPopover` registers a `keydown` listener on `document` (same pattern as `PanelHelp.svelte`) inside an `onMount` / `$effect`:

```svelte
$effect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') tutorial.stop();
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
});
```

Focus management (trap, return-to-trigger) is deferred to the polish pass.

---

## 11. Open questions

1. **Auto-advance on success?** Some steps could detect success automatically (e.g. slice enabled → step 7 success). For v1 recommend manual Next only — auto-advance adds complexity and can feel patronising.
2. **Does the tutorial modify app state?** Considered: auto-enabling the relevant pipeline node when the user lands on a step. Decision deferred — keeps implementation simple and respects user agency. The "Try it" text tells users what to open; the popover does not open it for them.
3. **Capstone steps?** Each track ends with a capstone exercise in the content doc. These are optional bonus steps — not in the main step index. Implement as an optional "Capstone" button on the `Done` screen that opens a single extra popup with the capstone text and no navigation (just a `Close`).
4. **Mobile layout:** Tutorial button is present but LanePicker uses a stacked 1-column layout. `TutorialPopover` uses `viewport-float` for all steps on mobile (sidebar is a sheet, not always visible). Deferred.
5. **Escape key:** Should close the popover (same as `×`). Wire up the same `keydown` handler as `PanelHelp`.
