# Accessibility controls — design and handoff plan

**Status:** keyboard/focus baseline and text readability preferences implemented; manual visual review pending
**Triggered by:** Reddit feedback (r/computergraphics, June 2026) + comprehensive codebase audit

**Implementation note (June 12, 2026):**
- Phase A is implemented: controls landmark, skip link, viewport target, sidebar footer semantics, TutorialPopover Escape handling, and expanded viewport canvas keyboard guidance.
- Phase B is implemented for true modal dialogs: `focusTrap` action plus NamePromptDialog, ConfirmDialog, GuideNoteEditor, and LanePicker. TutorialPopover is intentionally left untrapped because the walkthrough needs users to interact with highlighted controls while the card remains open.
- Phase C is implemented: plane and bar canvases are focusable, support keyboard adjustments, and announce the selected hex value.
- Phase D is implemented as Mouse / Touch / Keyboard tabs in the gesture reference popover.
- Phase E is implemented: browser-local readability preferences, root font-scale, secondary contrast, line-height preference, before-paint localStorage initialization, and rem-based font-size conversion.

---

## Context

A user reported Color Lab is "barely usable" because of tiny grayish text. That specific complaint is a **text-readability** problem. A fuller audit reveals a separate layer of **structural keyboard/focus gaps** that affect any keyboard-only or AT user. Both layers are addressed here under one plan.

The two concerns are different in kind:
- **Text readability** — an opt-in preferences feature. Default unchanged; users scale up.
- **Keyboard/focus baseline** — not opt-in. Required for any keyboard user. Mostly structural fixes.

---

## Part 1 — Text readability preferences

### Problem

The UI uses intentionally dense sizing for desktop power users. Problematic tokens and elements:

| Token / selector | Value | Issue |
|-----------------|-------|-------|
| `--dim` | `#9a9ba1` | ~3.7:1 on `--bg` — below WCAG AA for small text |
| `--faint` | `#5c5d63` | ~2.4:1 — fails WCAG AA at any size |
| `.sidebar-footer-title` | 9px, `--dim` | Unreadable at typical laptop distances |
| `.panel-help-stage-label`, tutorial labels | 9px, `--dim` | Same |
| `.note` (pipeline help text) | 10.5px, `--faint` | Fails contrast |
| Inspector chain labels (`.stage b`) | 11px, `--dim` | Borderline |
| Inspector chain values (`.stage span`) | 10.5px mono | Very small in dense columns |
| `.app-header .sub`, `.app-info` links | 11px, `--dim` | Low contrast |

**Do not change the defaults** — the dense layout suits the graphics-professional audience. Implement as opt-in browser-local preferences.

### Reference implementation

svizzle a11y (`nestauk/svizzle/packages/components/ui/src/a11y`) — authored by the same developer. Key patterns to port:
- Settings as typed data (not scattered reactive vars)
- Derived CSS variables from settings applied to `:root`/`html`
- **`rem` and `em` units throughout** — the entire system works because changing `html { font-size }` cascades automatically when all sizing is relative. Without this, changing the root size has no effect on explicitly-sized `px` elements.
- localStorage persistence
- Menu is self-readable (≥14px, high-contrast — never applies compact styling to itself)

Use Svelte 5 runes (`$state`, `$derived`) instead of Svelte 3/4 stores.

### Proposed v1 control set

#### Required (text group)

| Control | Type | Default | Steps | Effect |
|---------|------|---------|-------|--------|
| **Font scale** | stepped | 100% | 100, 112, 125, 150, 175 | Sets `--ui-font-scale`; scales `html` font-size |
| **Secondary contrast** | stepped | Normal | Normal, High, Maximum | Overrides `--dim` / `--faint` to higher-contrast variants |
| **Line height** | stepped | 145% | 125, 145, 165, 185 | Sets `--ui-line-height` |

Secondary contrast token mapping:

| Level | `--dim` | `--faint` | Approx contrast on `#0a0a0b` |
|-------|---------|-----------|-------------------------------|
| Normal | `#9a9ba1` | `#5c5d63` | 3.7 / 2.4:1 |
| High | `#b8b9bf` | `#8a8b91` | ~5.1 / 3.3:1 |
| Maximum | `#d0d1d6` | `#a8a9af` | ~7.0 / 4.7:1 |

#### Deferred (text group v1.1)
- Letter spacing (0 / +5% / +10%)
- Word spacing (0 / +10% / +20%)

#### Not in scope for v1 — display filters
CSS `filter` on `html` (brightness, contrast, grayscale, CVD simulation) affects the WebGL canvas and makes gamut colors scientifically unreliable. Document the tradeoff before shipping. Do not conflate with Explorer Vision CVD.

### State model

```ts
// fe/src/lib/a11y/preferences.svelte.ts
interface A11yPreferences {
  fontScale: 100 | 112 | 125 | 150 | 175;
  secondaryContrast: 'normal' | 'high' | 'maximum';
  lineHeight: 125 | 145 | 165 | 185;
}

const DEFAULTS: A11yPreferences = { fontScale: 100, secondaryContrast: 'normal', lineHeight: 145 };
const STORAGE_KEY = 'colorlab:a11y';
// NOT in ParameterSnapshot / document schema
```

### CSS implementation

#### Prerequisite: convert all `font-size` declarations to `rem`

**This is required for font-scale to work at all.** The entire svizzle approach depends on `rem`/`em` units cascading from the root. Currently the app has ~55 hardcoded `px` font-size rules in `app.css` and ~40 more across component `<style>` blocks — changing `html { font-size }` has no effect on any of them.

The conversion is mechanical. Base is **13px = 1rem**:

| Current px | rem equivalent |
|-----------|---------------|
| 8px | 0.615rem |
| 9px | 0.692rem |
| 10px | 0.769rem |
| 10.5px | 0.808rem |
| 11px | 0.846rem |
| 11.5px | 0.885rem |
| 12px | 0.923rem |
| 13px | 1rem |
| 14px | 1.077rem |
| 16px | 1.231rem |
| 18px | 1.385rem |

Move `font-size: 13px` from `body` to `html` (so rem is defined at root), then find-and-replace every `font-size: Npx` across `app.css` and all component `<style>` blocks with the `rem` equivalent. The visual output is identical at the default scale — this is a pure unit refactor.

Files affected: `app.css` (~55 rules), `ThemeRamp.svelte`, `TutorialPopover.svelte`, `PipelinePopover.svelte`, `PanelHelp.svelte`, `ColorPicker.svelte`, `LanePicker.svelte` (~40 rules combined).

#### CSS variable setup

```css
/* app.css */
html {
  font-size: 13px;          /* moved from body; defines 1rem */
  --ui-font-scale: 1;
  --ui-line-height: 1.45;
}
```

The a11y driver then does:

```js
// applyToDocument() in preferences.svelte.ts
document.documentElement.style.setProperty('font-size', `calc(13px * ${scale / 100})`);
document.documentElement.style.setProperty('--ui-line-height', `${lineHeight / 100}`);
document.documentElement.setAttribute('data-a11y-secondary', secondaryContrast);
```

Because all font sizes are now `rem`, the single `font-size` change on `html` cascades to the entire app. No per-element overrides needed.

#### Secondary contrast

Applied via `data-a11y-secondary` attribute on `<html>`:

```css
html[data-a11y-secondary="high"]    { --dim: #b8b9bf; --faint: #8a8b91; }
html[data-a11y-secondary="maximum"] { --dim: #d0d1d6; --faint: #a8a9af; }
```

### UI placement

A **popover panel** triggered from the header (consistent with Privacy popover) works on desktop. On mobile (`max-width: 760px`) the panel should use a bottom sheet with larger touch targets.

Entry point: add "Accessibility" or ♿ button adjacent to `AppInfo` in `AppShell.svelte`.

### New files

| File | Purpose |
|------|---------|
| `fe/src/lib/a11y/preferences.svelte.ts` | Rune store, localStorage load/save, `applyToDocument()` |
| `fe/src/lib/a11y/A11yPanel.svelte` | Panel UI: scale, contrast, line height, reset |
| `fe/src/lib/a11y/a11y.css` | Variable override rules, `data-a11y-*` attribute selectors |

### Files to modify

| File | Change |
|------|--------|
| `fe/src/lib/components/AppShell.svelte` | Entry button; init prefs before paint |
| `fe/src/app.css` | Add `--ui-font-scale`, `--ui-line-height` custom properties; convert all ~95 `font-size: Npx` rules to `rem` |
| `fe/src/routes/app.html` | Inline `<script>` to apply a11y prefs from localStorage before first paint (see open question below) |

### Open questions before Phase E

**OQ-E1 — Before-paint init location:** Three locations are mentioned across this doc (`+page.svelte`, `AppShell.svelte`, `app.html`). These have different timing in SvelteKit. `app.html` with an inline `<script>` is the only one that truly runs before first paint; `AppShell.svelte` runs after hydration. Decision needed: accept a brief flash-of-default-scale on load (simpler, use `AppShell.svelte` `onMount`) or eliminate it (harder, inline script in `app.html` reading localStorage directly in raw JS). The existing `mobile.ts` tessellation init does this in `+page.svelte` — check whether a FOUC is noticeable there as a reference point.

**OQ-E2 — A11yPanel UI design:** The panel UI is unspecified. The three controls (font scale, secondary contrast, line height) need a widget choice — a segmented row of buttons (like the existing `SegmentedControl.svelte`), a `<select>`, or a radio strip. The panel also needs a reset affordance and a title. No wireframe or layout description exists. Design decision needed before implementation.

**OQ-E3 — Line-height cascading:** `line-height` set on `html` does cascade to descendants. However, components that set explicit `line-height` in `px` will also need conversion (search for `line-height:.*px` across `app.css`). Scope not yet audited.

---

## Part 2 — Keyboard / focus baseline

### What already works

**Keyboard coverage (Viewport.svelte global handler):**
R (camera reset), X (slice), C (cylinder), G (grid), O (outlines), `[` `]` (slice offset), `- =` (cylinder radius), Space (pan mode), A (add-point mode), Escape (clear arm), Delete/Backspace (remove anchor), Arrow keys (nudge anchor — base 6 px, Shift 16 px, Alt 2 px).

**ARIA:** 40+ `aria-label` / `role` attributes present. Canvas, dialogs, tablist, tab, menuitem all correctly labeled. Dialog elements carry `role="dialog"` + `aria-modal` + `aria-labelledby`.

**Focus on open:** NamePromptDialog and GuideNoteEditor call `.focus()` on mount.

**Dismiss via Escape:** DocumentBar "More" menu, GuideNoteEditor, LanePicker backdrop.

### Identified gaps

#### G1 — Left panel has no landmark role
`LeftControls` renders into `<div class="side-panel left-panel">`. It has no `<aside>` or `<nav>` wrapper. Screen reader landmark navigation cannot jump to the sidebar.

#### G2 — No skip-to-content link
No skip-nav affordance. A keyboard user tabs through the entire header and left sidebar before reaching the viewport.

#### G3 — No focus trap in modal dialogs
Tab leaks out of NamePromptDialog, ConfirmDialog, GuideNoteEditor, LanePicker, and TutorialPopover. Focus is not returned to the trigger element when any dialog closes.

#### G4 — TutorialPopover has no Escape handler
Has `role="dialog"` and a close button, but pressing Escape while inside it does nothing.

#### G5 — ColorPicker plane and bar canvases are pointer-only
No keyboard navigation. A user without a pointing device can change the color only via the hex input and the space/bar `<select>` controls.

#### G6 — Keyboard shortcuts are undocumented in-app
GestureReferencePopover covers mouse and touch but lists no keyboard shortcuts. The viewport canvas `aria-label` gives no hint that keyboard shortcuts exist.

#### G7 — Sidebar footer is a `<div>` not `<footer>`
Minor semantic issue. The `.sidebar-footer` block (floor grid, hide aids, auto-rotate, neutral backdrop, performance) should be `<footer>` inside the left-panel `<aside>` once G1 is fixed.

### Design decisions

#### G1 — Landmark fix
Wrap `<LeftControls>` output in `<aside aria-label="Controls">` in `AppShell.svelte`. The existing `<section aria-label="Explorer pipeline">` and `<section aria-label="Ramp pipeline">` children remain valid subordinate sections.

#### G2 — Skip link
Insert a visually-hidden focusable `<a>` as the first child of `.app-shell`. Target the `<main>` viewport element with `id="main-viewport"`:

```html
<a href="#main-viewport" class="skip-link">Skip to viewport</a>
```

```css
.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus-visible {
  left: 8px;
  top: 8px;
  /* high-contrast styling */
}
```

#### G3 — Focus trap and return
Write a `useFocusTrap` Svelte action (~40 lines) at `fe/src/lib/actions/focusTrap.ts`:
- Captures all focusable descendants on mount.
- Cycles Tab / Shift+Tab within them.
- Saves `document.activeElement` at mount; restores it on destroy (= focus return).
- The Escape key calls the dialog's cancel handler (each dialog already handles Escape via its own logic or the action can dispatch a custom event).

Apply to: NamePromptDialog, ConfirmDialog, GuideNoteEditor, LanePicker, TutorialPopover.

Do **not** apply to PanelHelp or GestureReferencePopover — these are non-modal popovers; focus should flow freely.

#### G4 — TutorialPopover Escape
Add `onkeydown` on `.tutorial-card` checking `event.key === 'Escape'` → call `onStop`. (The focus trap action from G3 can handle this generically via a dispatched event, or a local handler — either is fine.)

#### G5 — ColorPicker keyboard
Add `tabindex="0"` to both the plane and bar canvases. Wire `onkeydown`:

**Plane canvas** (two axes — the displayed space axes, e.g. a/b or S/V):
- Arrow keys: ±1% on respective axis
- Shift+Arrow: ±10%
- Home / End: 0% / 100% on horizontal axis
- PageUp / PageDown: ±10% on vertical axis

**Bar canvas** (single axis):
- ArrowUp / ArrowDown: ±1%
- Shift+Arrow: ±10%

Both call the existing `setFromPlane(nx, ny)` / `setFromBar(n)` functions with clamped offset values — no new color math. Add an `aria-live="polite"` region (or `aria-valuenow` on the canvas) so screen readers announce the updated hex on change.

#### G6 — Keyboard reference
Add a "Keyboard" tab to `GestureReferencePopover.svelte` alongside the existing "Mouse" / "Touch" tabs. List all shortcuts in a `<dl>` two-column table. Update the canvas `aria-label` to: `"Gamut explorer WebGL viewport — press ? or open Gesture Reference for keyboard shortcuts"` (or similar).

#### G7 — Sidebar footer landmark
Change `.sidebar-footer` `<div>` → `<footer>` once G1's `<aside>` wrapper is in place.

### Reference — full keyboard shortcut inventory

| Key | Action | Condition |
|-----|--------|-----------|
| Drag | Orbit | Default canvas gesture |
| Shift+drag | Pan camera | — |
| Alt+drag | Slice offset | Slice enabled |
| Ctrl/Cmd+drag | Cylinder radius | Cylinder enabled |
| Double-click | Center camera on hit | Surface hit |
| Scroll | Zoom | — |
| Ctrl+scroll | Fine zoom | — |
| `R` | Reset camera | Not in editable |
| `X` | Toggle slice | Not in editable |
| `C` | Toggle cylinder | Not in editable |
| `G` | Toggle surface grid | Not in editable |
| `O` | Toggle plane + cylinder outlines | Not in editable |
| `[` | Slice offset −0.02 | — |
| `]` | Slice offset +0.02 | — |
| `-` | Cylinder radius −0.02 | — |
| `=` | Cylinder radius +0.02 | — |
| Space (hold) | Pan mode | — |
| `A` (hold) | Add-point mode | — |
| Escape | Clear arm / close popovers | — |
| Delete / Backspace | Remove selected anchor | Anchor selected |
| Arrow keys | Nudge anchor 6 px | Anchor selected |
| Shift+Arrow | Nudge 16 px | Anchor selected |
| Alt+Arrow | Nudge 2 px | Anchor selected |

---

## Phased plan

### Phase A — Structural / no-behavior (1–2 h)

Low-risk HTML and ARIA fixes. No logic changes.

| # | Change | File |
|---|--------|------|
| A1 | Wrap `<LeftControls>` in `<aside aria-label="Controls">` | `AppShell.svelte` |
| A2 | Add skip-to-content link; add `id="main-viewport"` to `<main>` | `AppShell.svelte`, `Viewport.svelte` |
| A3 | Sidebar footer `<div>` → `<footer>` | `LeftControls.svelte` |
| A4 | Add Escape handler to TutorialPopover | `TutorialPopover.svelte` |
| A5 | Update viewport canvas `aria-label` to mention keyboard shortcuts | `Viewport.svelte` |

### Phase B — Focus trap (2–3 h)

Self-contained action; apply to 5 dialogs.

| # | Change | File |
|---|--------|------|
| B1 | Write `useFocusTrap` Svelte action | `fe/src/lib/actions/focusTrap.ts` (new) |
| B2 | Apply to NamePromptDialog, ConfirmDialog | both `.svelte` files |
| B3 | Apply to GuideNoteEditor (replaces manual `.focus()`) | `GuideNoteEditor.svelte` |
| B4 | Apply to LanePicker | `LanePicker.svelte` |
| B5 | Apply to TutorialPopover | `TutorialPopover.svelte` |

### Phase C — ColorPicker keyboard (2–3 h)

| # | Change | File |
|---|--------|------|
| C1 | `tabindex="0"` on plane and bar canvases | `ColorPicker.svelte` |
| C2 | `onkeydown` on plane (Arrow / Shift+Arrow / Home / End / Page) | `ColorPicker.svelte` |
| C3 | `onkeydown` on bar (Arrow / Shift+Arrow) | `ColorPicker.svelte` |
| C4 | `aria-live="polite"` region for hex value announcements | `ColorPicker.svelte` |

**Open question before Phase C — axis mapping (OQ-C1):** The keyboard spec says "Arrow keys: ±1% on respective axis" for the plane but does not specify which arrow key maps to which color axis. The mapping depends on how the plane canvas renders its two axes for each color space (e.g. which is x/horizontal and which is y/vertical in Oklab a/b, in HSV S/V, etc.). Read `ColorPicker.svelte` `setFromPlane(nx, ny)` to confirm the x=horizontal / y=vertical convention before wiring keys, and document the convention here.

### Phase D — Keyboard shortcut reference (1–2 h)

| # | Change | File |
|---|--------|------|
| D1 | "Keyboard" tab in GestureReferencePopover with full shortcut table | `GestureReferencePopover.svelte` |

### Phase E — Text readability preferences (5–7 h)

See Part 1 above for full spec. E1 (unit refactor) is a prerequisite for E4 (font-scale) to have any effect.

| # | Change | File |
|---|--------|------|
| E1 | **Move `font-size: 13px` from `body` to `html`**; convert all ~95 `font-size: Npx` rules to `rem` across `app.css` and component styles | `app.css`, 6 component files |
| E2 | `preferences.svelte.ts` state module | new |
| E3 | `A11yPanel.svelte` UI (scale / contrast / line-height / reset) | new |
| E4 | `a11y.css` — `data-a11y-secondary` attribute overrides for `--dim` / `--faint` | new |
| E5 | Entry button in AppShell header | `AppShell.svelte` |
| E6 | Init on page load before paint (set `font-size` and attributes from localStorage before first render) | `AppShell.svelte` or inline `<script>` in `app.html` |

---

## Out of scope

- Screen-reader narration of the 3D WebGL geometry.
- WCAG contrast checker for exported ramp palettes (separate ramp-quality feature).
- Forced-colours / high-contrast OS mode media query.
- `aria-live` regions for `gestureStatus` toast messages (worth doing separately).
- Mobile / touch AT (TalkBack, VoiceOver iOS) — not planned for v1.
- Global CSS `filter` for display colour correction — tradeoffs on canvas accuracy must be evaluated first.

---

## Acceptance criteria

**Part 1 (text readability):**
- Default appearance unchanged for fresh users — rem conversion is visually identical at scale 100%.
- At 150% scale + Maximum contrast, sidebar footer titles, pipeline notes, and inspector chain are clearly readable.
- Font scale applies to the full app (every element, not just selected overrides) because all sizes are rem-based.
- Preferences persist across reload; not saved in document snapshots.
- A11y panel itself uses ≥14px text and ≥4.5:1 contrast.
- No layout breakage at 175% scale (panels scroll or reflow rather than overflow).

**Part 2 (keyboard/focus):**
- Screen reader can navigate to left sidebar by landmark.
- Skip link is focusable and navigates to the viewport.
- Tab does not escape open modal dialogs; focus returns to trigger on close.
- TutorialPopover dismisses on Escape.
- ColorPicker color plane and bar are operable without a pointing device.
- Keyboard shortcut reference is discoverable from the gesture popover.
