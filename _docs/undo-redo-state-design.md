# Undo/redo state design

**Status:** proposal, ready for implementation planning
**Date:** June 12, 2026

## Goal

Add predictable undo/redo for user-editable app state without recording transient renderer state, hover inspection, derived ramp samples, or every intermediate pointer-move frame.

The app already has the right durable boundary: `ParameterSnapshot` from `fe/src/lib/documents/snapshot.ts`. Undo/redo should use that snapshot layer rather than raw `AppState`.

## Current State Shape

Relevant files:

- `fe/src/lib/engine/state.svelte.ts` creates the live rune `AppState`.
- `fe/src/lib/engine/types.ts` defines `AppState`, `ExplorerState`, runtime fields, and persisted fields.
- `fe/src/lib/documents/snapshot.ts` defines `toSnapshot()`, `applySnapshot()`, `snapshotsEqual()`, and `cloneSnapshot()`.
- `fe/src/lib/documents/session.svelte.ts` owns document load/save/new/delete and dirty tracking.

Important existing split:

- Persisted snapshot includes explorer parameters and camera.
- Snapshot excludes `hover`, selected point, add-point arm, generated ramp stops, generated grids, spline samples, and other derived/runtime outputs.
- Snapshot currently excludes some renderer policy fields such as `autoPerformance`, `minAverageFps`, and `autoRotate`.
- Known bug: auto-rotate is excluded, but the auto-rotate loop mutates persisted `camera.yaw`; therefore simply enabling auto-rotate can make the document dirty as the camera changes.

That split is appropriate for undo/redo. Undoing should restore authoring parameters, color points, display/camera settings, and saved UI pipeline choices, but should not resurrect hover state or derived render buffers.

## Auto-Rotate and Dirty State

Auto-rotate needs special handling before undo/redo is implemented.

Current behavior:

- `explorer.autoRotate` is runtime-only and excluded from `ParameterSnapshot`.
- `Viewport.svelte` still implements auto-rotate by mutating `camera.yaw` each animation frame.
- `camera` is included in `ParameterSnapshot`.
- `session.isDirty` compares `toSnapshot(getAppState())` against the saved baseline.
- Result: auto-rotate changes the persisted camera snapshot and marks the document dirty even though the user only enabled an ambient viewing aid.

This is especially dangerous for undo/redo:

- A naive history watcher would record a stream of camera snapshots while auto-rotate runs.
- Even an explicit history system could have its `current` snapshot drift away from the document baseline if it reads from the mutated persisted camera.
- Undoing a real edit could appear to fail because auto-rotate immediately mutates camera again.

### Recommended fix: render-time auto-rotation offset

Do not mutate persisted camera state during auto-rotate.

Instead:

1. Keep `camera` as the persisted/user-authored camera.
2. Store an internal runtime-only `autoRotateYawOffset` in `Viewport.svelte`.
3. During auto-rotate, increment/decrement only that offset.
4. Draw with an effective camera:

```ts
const renderCamera = explorer.autoRotate
  ? { ...camera, yaw: camera.yaw + autoRotateYawOffset }
  : camera;
renderer.draw({ state: explorer, matrices, shellMatrices, camera: renderCamera, morph });
```

5. All picking/projecting that represents what the user sees should use the same effective camera while auto-rotate is active.
6. When the user performs an intentional camera action, either:
   - reset `autoRotateYawOffset = 0` and mutate `camera`, or
   - bake the current effective yaw into `camera.yaw` once at the start of the user action, then reset the offset.

Recommended interaction rule:

- User camera operations should be authored camera edits.
- Ambient auto-rotation should be display-only.
- When the user drags/orbits/centers/resets camera, pause or zero the runtime offset so the saved camera is clear and deterministic.

This makes dirty tracking correct:

- Toggling auto-rotate does not dirty the document.
- Letting auto-rotate run does not dirty the document.
- Manual orbit, pan, zoom, target-center, and reset still dirty the document because camera is persisted.

It also makes undo/redo tractable:

- Auto-rotate is not captured in history.
- Manual camera moves can be single history transactions.
- Undo/redo applies saved camera snapshots and the view should draw from those snapshots plus a clean runtime offset.

### Alternative: exclude camera from dirty tracking while auto-rotate is active

This is not recommended.

Possible approach:

- Keep mutating `camera.yaw`.
- Make `session.isDirty` compare snapshots with camera ignored when `autoRotate` is active.

Problems:

- The app would still mutate persisted camera behind the user's back.
- Turning auto-rotate off would expose whatever yaw happened to be current and could suddenly dirty the document.
- Undo/redo would need special camera comparison rules.
- Saved documents could capture accidental auto-rotated camera positions if the user saves while auto-rotate is on.

### Alternative: auto-rotate a separate camera object

This is viable but heavier than an offset:

- Maintain `viewCamera` for rendering and `camera` for saved/authored state.
- Sync `viewCamera` from `camera` when not auto-rotating.
- Auto-rotate mutates only `viewCamera`.

This can work if the renderer/view layer grows more camera effects later, but the offset approach is simpler for the current code.

## Recommended Model

Create a history controller around `ParameterSnapshot`:

```ts
type HistoryEntry = {
  snapshot: ParameterSnapshot;
  label?: string;
  timestamp: number;
};

type HistoryController = {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  capture(label?: string): void;
  begin(label?: string): void;
  commit(label?: string): void;
  cancel(): void;
  undo(): void;
  redo(): void;
  reset(snapshot?: ParameterSnapshot): void;
};
```

Proposed file:

- `fe/src/lib/history/history.svelte.ts`

The controller should receive:

- `getAppState: () => AppState`
- optional `onApply?: () => void`

It should import and use:

- `toSnapshot(appState)`
- `applySnapshot(appState, snapshot)`
- `cloneSnapshot(snapshot)`
- `snapshotsEqual(a, b)`

## Stack Semantics

Use the common "past/current/future" model:

```ts
let past = $state<HistoryEntry[]>([]);
let current = $state<ParameterSnapshot>(toSnapshot(getAppState()));
let future = $state<HistoryEntry[]>([]);
```

Capture behavior:

1. Read `next = toSnapshot(getAppState())`.
2. If `next` equals `current`, do nothing.
3. Push `current` onto `past`.
4. Set `current = next`.
5. Clear `future`.
6. Enforce a bounded stack size.

Undo behavior:

1. If `past` is empty, return.
2. Push `current` onto `future`.
3. Pop previous from `past`.
4. Set `current = previous.snapshot`.
5. `applySnapshot(appState, current)`.

Redo is symmetric.

Recommended depth:

- Start with `maxEntries = 100`.
- Snapshots are small enough for this app shape; each is mostly primitives and source-color lists.
- If documents become much larger later, add diff compression or a byte-budget cap.

## Transaction Boundaries

The critical design issue is not serialization. It is when to capture history.

### Simple controls

For single-change controls, capture after the change:

- selects
- checkboxes
- segmented controls
- buttons that apply a preset
- add/remove/duplicate/reorder source points
- saveable guide note changes
- camera reset
- document-level parameter edits

Implementation options:

1. Wrap event handlers: `onclick={() => { mutate(); history.capture('...'); }}`
2. Add callback props to common controls (`SliderRow`, `ToggleRow`, `SegmentedControl`) such as `onCommit`.
3. Add a small `historyAction(label, fn)` helper to reduce boilerplate.

### Sliders

Sliders should not capture every `input` event.

Recommended behavior:

- `pointerdown`/`focus`: `history.begin('Change slice offset')`
- continuous `input`: mutate normally
- `pointerup`/`change`/`blur`: `history.commit()`
- `Escape` while focused, if supported later: `history.cancel()` and restore pre-transaction snapshot

This requires extending `SliderRow.svelte` with transaction callbacks:

```ts
onBegin?: () => void;
onCommit?: () => void;
onCancel?: () => void;
```

### Canvas gestures

Canvas gestures must be explicit transactions:

- orbit camera drag
- pan camera drag
- pinch zoom
- slice offset drag
- cylinder radius drag
- drag control point

Recommended in `Viewport.svelte`:

- call `history.begin(label)` at `onPointerDown` after `gesture = chooseGesture(event)`
- call `history.commit(label)` at `onPointerUp` if the gesture changed snapshot state
- call `history.cancel()` at `onPointerCancel`

Do not commit inspect-only gestures, hover, or touch inspect.

Click add/remove/select behavior:

- add point: capture after add
- select point: no history, because `selectedPoint` is runtime-only
- clear selection: no history
- touch inspect: no history

### Keyboard shortcuts

For discrete toggles:

- `R`, `X`, `C`, `G`, `O`, `[`, `]`, `-`, `=` should capture once per key press.

For nudge:

- Avoid one history entry per auto-repeat frame.
- Treat repeated arrow-key nudges as one transaction:
  - On first nudge keydown: `history.begin('Nudge source point')`
  - During repeats: mutate only
  - On corresponding keyup or short debounce timeout: `history.commit()`

Pragmatic v1 alternative:

- Capture each non-repeat arrow keydown.
- Ignore `event.repeat`.
- This is simpler but less good for keyboard-only users.

### Color picker

`ColorPicker.svelte` emits many changes from pointer drag and arrow keys.

Recommended:

- Add `onBegin`/`onCommit` props to `ColorPicker`.
- Begin on pointerdown or first keyboard edit.
- Commit on pointerup, blur, or debounce timeout.
- In `ThemeRamp.svelte`, only push history when selected point color actually changes; staged picker color is local UI state and should not enter history until "Add as new point".

## Document Session Integration

Undo history should reset on document boundary changes:

- `session.init()`
- `loadDocument()`
- `newDocument()`
- `deleteActive()`
- successful tutorial example load

After `applySnapshot()` in those paths, call:

```ts
history.reset(toSnapshot(getAppState()));
```

Save/Save As should not clear undo history. Saving changes the dirty baseline, not the edit history.

Rename/delete document metadata:

- Rename is document metadata, not app parameter state. Do not put it in parameter undo.
- Delete is intentionally destructive and already has a confirmation; do not make app-state undo responsible for document restoration.

Dirty tracking:

- Keep dirty tracking based on `session.savedSnapshot`.
- Undoing back to the saved snapshot should naturally make `session.isDirty === false`.
- Redoing away from it should make it dirty again.

## UI Design

### Header actions

Add compact Undo/Redo controls near document actions:

- Icon buttons are preferred over text-heavy buttons.
- Use familiar symbols or lucide icons if the app already adopts lucide later.
- Labels:
  - `aria-label="Undo"`
  - `aria-label="Redo"`
  - `title={history.undoLabel ? `Undo ${history.undoLabel}` : 'Undo'}`

Disable buttons when unavailable.

### Keyboard shortcuts

Global shortcuts:

- `Ctrl+Z` / `Cmd+Z`: undo
- `Ctrl+Shift+Z` / `Cmd+Shift+Z`: redo
- `Ctrl+Y`: redo on Windows/Linux convention

Rules:

- Do not handle when focus is inside text inputs, textareas, contenteditable, or native selects.
- The exception can be non-text canvas focus, where undo/redo should work.
- Prevent browser default when handled.

Add shortcuts to `GestureReferencePopover` under the Keyboard tab.

### Status feedback

Optional but useful:

- Reuse `gestureStatus`-style feedback or a small non-modal toast:
  - `Undid: Change slice offset`
  - `Redid: Add source point`

This is not required for v1.

## API Integration Options

### Option A: Pass history down as prop

Create history in `+page.svelte`:

```ts
const history = createHistory(() => appState);
```

Pass to:

- `AppShell`
- `DocumentBar`
- `LeftControls`
- `Viewport`
- `ThemeRamp`
- `GuideNoteEditorHost` if guide note edits should be undoable

Pros:

- Explicit dependencies.
- Easy to test.
- No global singleton.

Cons:

- Prop threading through several components.

### Option B: Svelte context

Set history context in `AppShell` or `+page.svelte`; read where needed.

Pros:

- Avoids prop drilling into deeply nested ramp controls.
- Good for cross-cutting concerns like history.

Cons:

- Harder to see dependencies.
- Must be disciplined about using it only for app-state edits.

Recommendation:

- Use context for the first implementation.
- Create `fe/src/lib/history/context.ts` with `setHistoryContext()` and `getHistoryContext()`.
- Keep the core controller independent and testable.

## Change Labels

Labels should be short and user-facing:

- `Change gamut`
- `Change world space`
- `Change tessellation`
- `Change slice`
- `Change cylinder`
- `Move camera`
- `Reset camera`
- `Add source point`
- `Move source point`
- `Remove source point`
- `Change source color`
- `Apply ramp preset`
- `Change interpolation`
- `Change placement`
- `Change expand`
- `Change gamut mapping`
- `Edit guide note`

For automatic field capture, a generic label such as `Edit parameters` is acceptable for v1, but high-frequency operations should still get specific labels.

## Avoid Recording

Do not record:

- hover inspection
- auto-rotate playback / runtime yaw offset
- `theme.selectedPoint`
- `theme.arm`
- generated `theme.stops`, `rawStops`, `grid`, `curves`, `rows`
- transient `gestureStatus`
- tutorial progress
- open popovers / menus
- document switcher menu state
- local readability preferences

Already excluded by `ParameterSnapshot`:

- most of these fields are outside `PersistedAppState`.
- `autoRotate`, `autoPerformance`, and `minAverageFps` are outside `PersistedAppState`; however, auto-rotate still needs the render-time offset fix because it currently mutates persisted camera.

Potential decision:

- `openSteps`, `pinPalette`, `hideAids`, and camera are persisted and therefore undoable by the snapshot approach.
- This is probably correct because the app saves them as part of the parameter document.
- If the desired behavior is "undo only color/math edits", a narrower snapshot or edit-category filter would be needed. I do not recommend that for v1 because it makes the behavior less predictable.

## Implementation Plan

### Phase 1: Core history controller

0. Fix auto-rotate so it does not mutate persisted `camera.yaw`; use a runtime render offset instead.
1. Add `fe/src/lib/history/history.svelte.ts`.
2. Add unit tests for:
   - capture ignores equal snapshots
   - undo/redo applies snapshots
   - redo clears on new capture
   - max depth truncates old entries
   - reset clears stacks
   - auto-rotate runtime offset does not change `toSnapshot(getAppState())`
3. Add context helpers.
4. Instantiate in `+page.svelte`.
5. Reset after session init/load/new/delete.

### Phase 2: UI and shortcuts

1. Add Undo/Redo buttons to `DocumentBar`.
2. Add global keydown handling in `AppShell` or a new `HistoryShortcuts.svelte`.
3. Update `GestureReferencePopover` keyboard tab.
4. Track optional analytics events:
   - `history_undo`
   - `history_redo`

### Phase 3: Coarse automatic capture

1. Add small wrappers around simple button/select/toggle handlers in `LeftControls`, `ViewportToolbar`, and `ThemeRamp`.
2. Add `onCommit` support to `ToggleRow`, `SegmentedControl`, and `SliderRow`.
3. Capture on `change` for selects and checkboxes, not on every `input`.

### Phase 4: Explicit gesture transactions

1. Wire `Viewport.svelte` pointer gestures:
   - begin on pointerdown for mutating gestures
   - commit on pointerup
   - cancel on pointercancel
2. Wire wheel zoom as a debounced transaction or capture after a short idle timeout.
3. Wire keyboard nudge as one transaction per nudge stream.
4. Wire ColorPicker pointer/key editing as transactions.

### Phase 5: Polish and audit

1. Audit every mutation in `rg "bind:value|bind:checked|onclick|oninput|onchange"` and ensure it is either:
   - captured,
   - intentionally runtime-only,
   - or intentionally ignored.
2. Add manual QA cases:
   - auto-rotate on/off and running does not mark document dirty
   - saving while auto-rotate is running does not persist a drifting yaw
   - undo/redo source point add, drag, duplicate, delete
   - undo/redo slider drag creates one entry
   - undo/redo camera orbit creates one entry
   - undo document load is not possible across document boundary
   - undo back to saved snapshot clears dirty marker
3. Check mobile touch gestures.

## Open Decisions

1. Should `autoPerformance`, `minAverageFps`, and `autoRotate` become persisted/undoable?
   - They currently live in `ExplorerState` but are excluded from `PersistedExplorer`.
   - For undo/redo via `ParameterSnapshot`, they will not be restored.
   - Recommendation: keep them out of undo for now because they are renderer policy/session behavior, not design output.
   - Required follow-up: fix auto-rotate so it no longer mutates persisted camera while running.

2. Should camera be undoable?
   - It is saved in documents today.
   - Recommendation: yes. Camera edits should be undoable because view setup is part of saved examples and user documents.

3. Should pipeline panel open/closed state be undoable?
   - `openSteps` is persisted today.
   - Recommendation: accept undoability for v1. If it feels noisy, remove `openSteps` from `ParameterSnapshot` in a separate persistence decision.

4. Should document load push an undo entry?
   - Recommendation: no. Document boundaries reset history. This avoids undo crossing into previous documents and conflicting with discard confirmations.

## Recommended First Implementation Slice

The safest first implementation is:

1. Fix auto-rotate dirty-state behavior with a render-time yaw offset.
2. Core history controller and tests.
3. Undo/redo buttons + keyboard shortcuts.
4. Capture only explicit high-level handlers:
   - source point add/remove/duplicate/reorder
   - preset buttons
   - document guide note save
   - camera reset
   - viewport keyboard toggles
5. Then add slider/gesture transactions.

This gives useful undo quickly while avoiding the main risk: hundreds of tiny history entries from live pointer/slider streams.
