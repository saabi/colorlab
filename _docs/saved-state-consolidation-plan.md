# Saved State Consolidation Plan

Status: **implemented** — document persistence via `ParameterSnapshot`, `parseSnapshot`, and the `colorlab:documents:v1` registry. See [`fe/src/lib/documents/README.md`](../fe/src/lib/documents/README.md).

## Problem

Saved documents currently serialize a `ParameterSnapshot` with this shape:

```ts
{
  schemaVersion,
  explorer,
  camera
}
```

But the app's default state is defined in `fe/src/lib/engine/state.svelte.ts` as `createExplorerState()`, and that object does not include camera state. The route creates camera separately:

```ts
let explorer = $state(createExplorerState());
let camera = $state(createCamera());
```

This makes saved state harder to reason about:

- Defaults are split between `createExplorerState()` and `createCamera()`.
- Saved JSON shape is separate from the object users think of as app state.
- Snapshot code manually selects fields from `ExplorerState`.
- Examples live in `fe/src/lib/documents/examples.ts`, away from the defaults they extend.
- Runtime-only fields such as `hover`, theme `arm`, and generated theme `stops` are mixed into `ExplorerState`, so persistence has to remember to omit them.

## Goal

Define one top-level app state object in `fe/src/lib/engine/state.svelte.ts` that contains every durable/saved field:

```ts
interface AppState {
  schemaVersion: 2;
  explorer: ExplorerParams;
  camera: Camera;
}
```

Then keep runtime-only UI/derived fields separate from saved state:

```ts
interface RuntimeState {
  hover: HoverHit | null;
  themeArm: 'A' | 'B' | null;
  themeStops: ThemeStop[];
}
```

This gives us:

- one default saved-state object
- examples in the same file as defaults
- camera included in the saved JSON by construction
- cleaner persistence and migration code
- clearer boundary between durable document state and runtime UI state

## Proposed File Ownership

### `fe/src/lib/engine/state.svelte.ts`

Owns:

- `CURRENT_STATE_SCHEMA_VERSION`
- durable state types or type exports
- default app state factory
- runtime state factory
- example state definitions
- helper for merging partial example states into defaults

Suggested exports:

```ts
export const CURRENT_STATE_SCHEMA_VERSION = 2 as const;

export interface AppState {
  schemaVersion: typeof CURRENT_STATE_SCHEMA_VERSION;
  explorer: ExplorerParams;
  camera: Camera;
}

export interface RuntimeState {
  hover: HoverHit | null;
  themeArm: 'A' | 'B' | null;
  themeStops: ThemeStop[];
}

export interface ExampleStateDocument {
  id: string;
  name: string;
  source: 'example';
  state: AppState;
}

export function createAppState(): AppState;
export function createRuntimeState(): RuntimeState;
export function createExampleState(partial: DeepPartial<AppState>): AppState;
export const EXAMPLE_STATES: ExampleStateDocument[];
```

Keep a compatibility wrapper during migration:

```ts
export function createExplorerState(): ExplorerParams {
  return createAppState().explorer;
}
```

Remove that wrapper once all call sites have moved to `createAppState()`.

### `fe/src/lib/engine/types.ts`

Split current `ExplorerState` into durable and runtime parts:

```ts
export interface ExplorerParams {
  spaceMode: SpaceMode;
  gamut: GamutKey;
  N: 64 | 128 | 192 | 256;
  slice: boolean;
  // ...
  theme: PersistedThemeParams;
}

export interface ThemeParams {
  A: ThemeAnchor | null;
  B: ThemeAnchor | null;
  steps: number;
  mode: ThemeMode;
  dh: number;
  dc: number;
  cprof: ChromaProfile;
  arcLong: boolean;
  aa: number;
  wcagBg: 'white' | 'black';
}

export interface RuntimeState {
  hover: HoverHit | null;
  themeArm: 'A' | 'B' | null;
  themeStops: ThemeStop[];
}
```

Temporary compatibility type:

```ts
export type ExplorerState = ExplorerParams & {
  theme: ThemeParams & {
    arm: 'A' | 'B' | null;
    stops: ThemeStop[];
  };
  hover: HoverHit | null;
};
```

Long term, components should receive `{ state: AppState; runtime: RuntimeState }` instead of a mutable all-in-one `ExplorerState`.

### `fe/src/lib/documents/types.ts`

Replace `ParameterSnapshot` with an alias or wrapper around `AppState`.

Recommended v2 shape:

```ts
export type ParameterSnapshot = AppState;
```

or, if document naming needs to stay outside:

```ts
export interface ParameterSnapshot extends AppState {}
```

Do not duplicate durable field definitions in document types.

### `fe/src/lib/documents/examples.ts`

Delete this file or reduce it to a re-export:

```ts
export { EXAMPLE_STATES as EXAMPLE_DOCUMENTS } from '$lib/engine/state.svelte';
```

Preferred outcome: examples are edited directly in `state.svelte.ts`.

## Saved JSON Shape

Current v1:

```json
{
  "schemaVersion": 1,
  "explorer": { "...": "..." },
  "camera": { "...": "..." }
}
```

Proposed v2:

```json
{
  "schemaVersion": 2,
  "explorer": { "...": "..." },
  "camera": { "...": "..." }
}
```

The visible JSON shape can remain nearly identical. The important change is architectural: this shape is now the app state object, not a separate snapshot assembled from multiple state owners.

## Runtime State Boundary

These fields should not be saved:

- `hover`
- `theme.arm`
- generated `theme.stops`
- active gesture state
- gesture reference popup open/closed
- active inspector tab
- drawer open/closed

## Future Source Color Storage

The next persistence revision should make ramp source colors independent of the
Active gamut and selected World space.

Requirement:

- store source-list colors in a colorimetric space such as `XYZ D65`;
- treat existing `{ srgbLin }` anchors as legacy linear-sRGB-D65 values and
  migrate them to `XYZ D65` once;
- derive active-gamut RGB, display RGB, world coordinates, Oklab/Oklch, and
  export values at runtime;
- do not store source colors in active-gamut RGB or world-space coordinates.

This keeps source lists stable when users switch Active gamut, World space, or
Display gamut.
- transient validation/dialog state

Migration target:

- `hover` moves to `runtime.hover`
- `theme.arm` moves to `runtime.themeArm`
- `theme.stops` moves to `runtime.themeStops`

This requires updates to:

- `RightInspector.svelte`
- `ThemeRamp.svelte`
- `Viewport.svelte`
- `buildRamp()` call sites
- any code reading `explorer.hover`, `explorer.theme.arm`, or `explorer.theme.stops`

## Implementation Plan

### Phase 1: Add Unified App State Without Breaking Components

1. Add `AppState` and `createAppState()` in `state.svelte.ts`.
2. Move camera defaults into `createAppState().camera`.
3. Keep `createCamera()` as a compatibility helper that returns `createAppState().camera`, or leave it but source both from shared constants.
4. Add `createExampleState()` and `EXAMPLE_STATES` in `state.svelte.ts`.
5. Keep `createExplorerState()` as a compatibility wrapper returning `createAppState().explorer`.

Acceptance:

- Existing UI still works.
- Defaults for explorer and camera live in one file.
- Examples can be edited in `state.svelte.ts`.

### Phase 2: Point Documents at AppState

1. Update `documents/types.ts` so `ParameterSnapshot` is based on `AppState`.
2. Update `defaultSnapshot()` to return `createAppState()`.
3. Update `toSnapshot()` to clone `{ schemaVersion, explorer, camera }` from current app state.
4. Update `applySnapshot()` to apply an `AppState`.
5. Replace `documents/examples.ts` implementation with a re-export or import from `state.svelte.ts`.

Acceptance:

- Saved document JSON includes camera because camera is part of `AppState`.
- Examples load from the same state file as defaults.
- No duplicated default construction between `state.svelte.ts`, `camera.ts`, and `snapshot.ts`.

### Phase 3: Migrate Route and Session to AppState

Current:

```ts
let explorer = $state(createExplorerState());
let camera = $state(createCamera());
const session = createDocumentSession(() => explorer, () => camera);
```

Target:

```ts
let appState = $state(createAppState());
let runtime = $state(createRuntimeState());
const session = createDocumentSession(() => appState);
```

Then pass:

```svelte
<AppShell bind:state={appState} bind:runtime {session} />
```

Intermediate option:

- Keep `AppShell` props as `state` and `camera` but derive them from `appState.explorer` and `appState.camera`.
- This reduces blast radius while documents are migrated.

Acceptance:

- The top-level route has one durable state object.
- Camera and explorer save/load together from that object.
- Dirty checking compares one durable object.

### Phase 4: Separate Runtime Fields

1. Move `hover` out of `ExplorerState`.
2. Move `theme.arm` out of durable theme state.
3. Move `theme.stops` out of durable theme state.
4. Update `buildRamp()` to accept durable theme params plus runtime output target, or return stops instead of mutating durable state.
5. Update UI components to read/write runtime state explicitly.

Acceptance:

- Durable app state is JSON-serializable without omission rules.
- Snapshot code no longer needs `Omit<ExplorerState, 'hover' | 'theme'>`.
- Dirty state is not affected by hover, generated ramp stops, active theme arm, or open UI controls.

### Phase 5: Schema Migration and Backward Compatibility

1. Increment schema version to `2`.
2. Add v1-to-v2 migration in `documents/migrate.ts`.
3. Since v1 already has `{ explorer, camera }`, migration mostly:
   - sets `schemaVersion: 2`
   - drops any runtime fields if present
   - fills missing camera from `createAppState().camera`
4. Update parser tests.
5. Add tests for:
   - v1 snapshot migration
   - missing camera fallback
   - examples build from state file
   - runtime fields are not persisted

Acceptance:

- Existing localStorage documents continue to load.
- New saves use schema v2.
- Tests cover old and new shapes.

## Suggested Final Module Layout

```text
fe/src/lib/engine/
  state.svelte.ts       # durable defaults, runtime defaults, examples
  types.ts              # durable/runtime type definitions
  camera.ts             # camera math and camera helpers, not default ownership

fe/src/lib/documents/
  types.ts              # document metadata + ParameterSnapshot alias
  snapshot.ts           # clone/apply/equality helpers for AppState
  schema.ts             # coercion for AppState
  migrate.ts            # v1 -> v2
  examples.ts           # deleted or re-export only
```

## Risks and Mitigations

- Risk: Moving runtime fields touches many components.
  - Mitigation: do phases 1-3 first, then runtime separation as a distinct commit.
- Risk: Dirty checking changes behavior.
  - Mitigation: explicitly test hover/theme arm/generated stops do not mark documents dirty.
- Risk: Existing saved documents break.
  - Mitigation: keep v1 migration and parser tests before changing storage writes.
- Risk: Examples become large inside `state.svelte.ts`.
  - Mitigation: keep example helper concise and use partial state overrides.

## Open Questions

- Should camera defaults remain exported from `camera.ts` as a pure camera concern, or should `state.svelte.ts` become the sole default owner?
  - Recommendation: `state.svelte.ts` owns defaults; `camera.ts` owns math/helpers.
- Should examples include document metadata in `state.svelte.ts`, or only named states?
  - Recommendation: include `id`, `name`, `source`, and `state` together so examples are one-edit objects.
- Should mobile default tessellation be represented as a separate named default state?
  - Recommendation: yes. Add `createAppState({ mobile: true })` or `createMobileAppState()` instead of mutating snapshots in session code.
