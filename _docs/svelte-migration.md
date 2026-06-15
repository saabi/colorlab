# Gamut Explorer Svelte Migration Plan

This document translates `_docs/design.md` and the single-file prototype in
`_docs/index.html` into an implementation-ready SvelteKit plan for `fe/`.
The legacy Sapper prototype (`fe.old/`) was removed from the main branch; see git history if needed.

## Current State

`fe/` is a fresh SvelteKit 2 / Svelte 5 project with TypeScript enabled and
runes forced in `vite.config.ts`. The application shell is still the starter:

- `fe/src/routes/+page.svelte` contains only the Svelte welcome markup.
- `fe/src/routes/+layout.svelte` only installs the favicon.
- `fe/src/lib/index.ts` is empty.

The prototype in `_docs/index.html` is the authoritative feature artifact. It
already uses module banners that define the intended decomposition:

- `pipeline`: color math, transfer curves, matrices, Lab/Oklab, cone fits, CVD.
- `registry`: available gamuts and world-space modes.
- `shaders`: WebGL2 shader sources.
- `camera`: orbit camera and analytic ray construction.
- `renderer`: WebGL2 setup, programs, VAOs, draw ordering.
- `state + ui`: mutable application state and control bindings.
- `pick`: analytic CPU-side hit testing.
- `panels`: 2D canvas instruments.
- `theme`: ramp anchors, exports, WCAG, and auto-adjust heuristics.
- `main`: boot, events, frame loop, uniforms, resize.

## Migration Goals

1. Preserve the single source of truth from `design.md`: matrices and curves
   live in TypeScript and are uploaded to shaders as uniforms.
2. Convert the single HTML artifact into typed modules and Svelte components
   without changing behavior.
3. Keep WebGL2 code isolated from Svelte so a future WebGPU renderer can replace
   only the renderer layer.
4. Make UI state explicit and serializable enough for future presets, tests, and
   URL state.
5. Land the migration in thin vertical slices so each phase can be built and
   visually checked.

## Target File Layout

```text
fe/src/
  app.html
  routes/
    +layout.svelte
    +page.svelte
  lib/
    color/
      math.ts
      transfer.ts
      pipeline.ts
      registry.ts
      cvd.ts
      selftest.ts
    engine/
      camera.ts
      picking.ts
      state.svelte.ts
      theme.ts
      types.ts
    renderer/
      shaders.ts
      webgl-renderer.ts
      uniforms.ts
    panels/
      canvas.ts
      transfer-panel.ts
      cones-panel.ts
      xy-panel.ts
      spectrum-panel.ts
    components/
      AppShell.svelte
      LeftControls.svelte
      Viewport.svelte
      RightInspector.svelte
      ControlGroup.svelte
      SegmentedControl.svelte
      SliderRow.svelte
      ToggleRow.svelte
      ThemeRamp.svelte
```

Do not copy the old Rollup/Sapper-era structure into `fe/`.

## Module Responsibilities

### `lib/color/math.ts`

Move vector and matrix helpers from the prototype:

- `V3`
- `m3.mulV`
- `m3.mul`
- `m3.inv`
- `m3.diag`
- `m3gl`
- `sub3`, `dot3`, `cross3`, `norm3`

Export plain array tuple types:

```ts
export type Vec3 = [number, number, number];
export type Mat3 = [number, number, number, number, number, number, number, number, number];
```

Use row-major matrices throughout the CPU code. Only `m3gl()` should transpose
to WebGL column-major upload order.

### `lib/color/transfer.ts`

Move `TRC` and transfer-curve types:

```ts
export interface TransferCurve {
  enc(value: number): number;
  dec(value: number): number;
}
```

Expose `srgb`, `g22`, and `lin` curves.

### `lib/color/pipeline.ts`

Move all color-space primitives that are independent of UI and rendering:

- cube orientation constants: `CUBE_ROT`, `CUBE_ROTi`, `REC709_Y`
- `Primaries`, `White`, `rgbToXyzM`
- `GAMUTS`
- Lab functions: `labF`, `labFi`, `xyz2lab`, `lab2xyz`
- Oklab constants/functions: `OK_M1`, `OK_M2`, `OK_M1i`, `OK_M2i`,
  `lsrgb2oklab`, `oklab2lsrgb`
- cone functions: `coneL`, `coneM`, `coneS`, `coneLMS`, `LMS2XYZ2`,
  `XYZ2LMS2`, `waveToXyz`
- sRGB/LMS matrices: `SRGB2XYZ`, `RGB2LMS`, `LMS2RGB`

Retain the corrected Lab behavior from the prototype:

- `a* = 500 * (fx - fy)`
- inverse `fx = a / 500 + fy`

### `lib/color/cvd.ts`

Move `CVD` and `applyCVD()`. Keep CVD simulation at the LMS cone stage and keep
the identity/neutral-axis invariants described in `design.md`.

### `lib/color/registry.ts`

Move `SPACES` and formalize the world-mode contract:

```ts
export interface SpaceDefinition {
  label: string;
  arrange?: {
    perm: Vec3;
    scale: Vec3;
    off: Vec3;
  };
  fromWorld(
    world: Vec3,
    rgbToXyz: Mat3,
    toSrgbLin?: GamutConversion
  ): Vec3;
}
```

Preserve current numeric mode IDs because the shader switch depends on them:

- `0`: Linear RGB cube
- `1`: CIE XYZ
- `2`: CIELAB
- `3`: Oklab
- `5`: Luminance romboid

### `lib/engine/state.svelte.ts`

Replace DOM-owned state with a typed Svelte state factory. Initial values should
match the prototype exactly:

```ts
export function createExplorerState() {
  return $state({
    spaceMode: 3,
    gamut: 'srgb',
    N: 128,
    slice: true,
    planeMode: 'L',
    off: 0,
    az: 25,
    el: 90,
    eps: 0.01,
    floor: true,
    lines: true,
    cutAbove: true,
    cutBelow: true,
    shell: 'none',
    outline: true,
    cvd: 'none',
    cvdSev: 1,
    theme: {
      A: null,
      B: null,
      steps: 7,
      arm: null,
      mode: 'seg',
      stops: [],
      dh: 40,
      dc: 0.1,
      cprof: 'linear',
      aa: 4.5,
      wcagBg: 'white'
    },
    hover: null
  });
}
```

The Svelte components should mutate this object directly. Engine modules should
receive it as an argument rather than importing component state.

Use the `.svelte.ts` suffix because the factory uses Svelte 5 runes. Keep
non-reactive engine helpers in normal `.ts` files.

### `lib/engine/types.ts`

Define shared types:

- `ExplorerState`
- `PlaneMode`
- `SpaceMode`
- `GamutKey`
- `CvdMode`
- `HoverHit`
- `TransformChain`
- `ThemeAnchor`
- `ThemeStop`
- `ThemeMode`
- `ChromaProfile`
- `GamutConversion`
- `DerivedMatrices`
- `DrawInput`

This keeps renderer, picking, panels, and components aligned.

### `lib/engine/camera.ts`

Move camera math and orbit camera state:

- `persp`
- `lookAt`
- `camEye`
- `camRay`
- `createCamera()`

The camera can be a plain object owned by `Viewport.svelte`:

```ts
const camera = createCamera();
```

### `lib/engine/picking.ts`

Move:

- `planeND(state)`
- `solidField(world, state, matrices)`
- `pick(px, py, width, height, state, matrices, camera)`
- `chain(rgbLin, state, matrices)`

`chain()` should return the one-stimulus result used by the swatch and every
panel. Do not recompute divergent transform chains in the components.

### `lib/engine/theme.ts`

Move:

- `wcag`
- `jsToWorld`
- `srgbHex`
- `anchorWorld`
- `buildRamp`
- `exportTokens`
- `exportDTCG`
- `stopFromOklab`
- `fitGamut`
- `fitWcag`
- `fitEven`

Change functions to return values instead of writing DOM:

- `buildRamp(state, matrices): ThemeStop[]`
- `exportTokens(stops): string`
- `exportDTCG(stops): string`
- `fitGamut(stops): ThemeStop[]`

`ThemeRamp.svelte` owns display and copy-to-clipboard behavior.

### `lib/renderer/shaders.ts`

Move shader strings unchanged first:

- `VS_SOLID`
- `FS_SOLID`
- `VS_LINE`
- `FS_LINE`
- `VS_FLOOR`
- `FS_FLOOR`
- `VS_MARK`
- `FS_MARK`

Do not refactor GLSL while migrating. Shader changes should happen after the
Svelte port reaches visual parity.

### `lib/renderer/uniforms.ts`

Extract derived matrix construction:

- `rebuildMatrices(gamut)`
- `rebuildShell(shell)`
- `createSolidUniformPayload(state, matrices, camera, projection, view)`

The target shape should make `webgl-renderer.ts` mostly a WebGL adapter.

### `lib/renderer/webgl-renderer.ts`

Wrap the prototype renderer in a lifecycle class:

```ts
export class WebGlRenderer {
  constructor(canvas: HTMLCanvasElement);
  resize(): void;
  rebuildBoundary(state: ExplorerState, matrices: DerivedMatrices): void;
  draw(input: DrawInput): void;
  dispose(): void;
}
```

Responsibilities:

- compile programs
- create VAOs/buffers
- own `lineVertCount`
- upload uniforms
- draw in the prototype order:
  1. wide-gamut shell with depth test off and additive blend
  2. opaque main solid
  3. floor grid with additive blend and no depth write
  4. hover marker
  5. theme stop markers
  6. cross-section outline last with depth test off

`WebGlRenderer` must not read or write Svelte state. The component passes state,
derived matrices, hover, and theme stops into `draw()`.

### `lib/panels/*`

Move 2D canvas panel drawing into pure functions:

- `drawTransferPanel(canvas, chain, state)`
- `drawConesPanel(canvas, chain)`
- `drawXyPanel(canvas, chain, state)`
- `drawSpectrumPanel(canvas, chain)`

Keep caches module-local:

- spectral locus cache
- sRGB xy fill cache
- spectrum strip cache
- dominant wavelength cache

These functions should receive `HTMLCanvasElement`, fit DPR internally, and
return small metadata where needed. For example, `drawSpectrumPanel()` should
return the dominant wavelength label so `RightInspector.svelte` can display it.

## Svelte Component Plan

### `routes/+page.svelte`

Create the state and compose the app:

```svelte
<script lang="ts">
  import AppShell from '$lib/components/AppShell.svelte';
  import { createExplorerState } from '$lib/engine/state.svelte';

  const state = createExplorerState();
</script>

<AppShell {state} />
```

### `components/AppShell.svelte`

Own the three-column layout and shared derived values:

- derived matrices for active gamut
- derived shell matrices
- current transform chain
- exported text

Pass the same `state` object to child components.

### `components/LeftControls.svelte`

Replace direct DOM bindings with Svelte bindings:

- space select
- gamut select
- slice controls
- tessellation select
- theme ramp controls
- display controls

Use small row components where it reduces repeated markup:

- `ControlGroup.svelte`
- `SegmentedControl.svelte`
- `SliderRow.svelte`
- `ToggleRow.svelte`

Each control should call an `onChange` callback supplied by `AppShell` or
`Viewport` when renderer rebuild work is needed:

- changing space, gamut, slice, plane, epsilon, cut modes, or outline requires
  boundary rebuild and repick reset.
- changing shell requires shell matrix rebuild.
- changing resolution only requires draw.
- changing CVD, floor, lines only requires draw.

### `components/Viewport.svelte`

Own:

- `<canvas>`
- `WebGlRenderer`
- camera object
- pointer, wheel, and resize events
- hover picking
- anchor dropping

Lifecycle:

1. `onMount`: create renderer, run `selftest()`, resize, rebuild boundary, draw.
2. `ResizeObserver`: call renderer resize and redraw.
3. `onDestroy`: dispose renderer and listeners.

Pointer behavior must match the prototype:

- drag orbits the camera.
- wheel changes camera distance.
- hover performs analytic `pick()` and computes `chain()`.
- click with an armed theme anchor drops A/B and rebuilds the ramp.

### `components/RightInspector.svelte`

Own:

- hovered swatch
- transform-chain rows
- transfer canvas
- cone canvas
- xy canvas
- spectrum canvas and dominant wavelength label

It should redraw panel canvases when any of these change:

- hover chain
- active gamut
- active CVD mode/severity
- panel canvas size

### `components/ThemeRamp.svelte`

Render ramp stops from `state.theme.stops`:

- color chips
- dashed outline for out-of-gamut stops
- tooltip text with hex, OKLCh, WCAG on white/black
- export textarea

Use `navigator.clipboard.writeText()` for exports when available. Keep a
fallback that just displays the text.

## Styling Migration

Start by moving prototype CSS into `+layout.svelte` or a global stylesheet such
as `fe/src/app.css`, then import it from the layout.

Preserve the operational tool layout:

- grid columns: `280px 1fr 300px`
- top header: `48px`
- full-height viewport canvas
- dark neutral background and low-contrast panel borders

Important frontend constraints:

- Do not create a landing page. The explorer is the first screen.
- Keep controls dense and instrument-like.
- Avoid nested card styling. Use full-height side panels and grouped controls.
- Ensure button labels fit on narrow desktop widths.

## Implementation Phases

### Phase 1: Static Svelte Shell

Goal: visual parity for the page layout without WebGL behavior.

Tasks:

1. Replace starter page with `AppShell`, `LeftControls`, `Viewport`, and
   `RightInspector`.
2. Move CSS variables and layout styles from `_docs/index.html`.
3. Populate selects/buttons/sliders from static data.
4. Add placeholder canvases and chain rows.

Verification:

- `npm run check` inside `fe/`
- `npm run dev` and inspect the layout at desktop size

### Phase 2: Color Pipeline Modules

Goal: migrate single-source color math with TypeScript checks.

Tasks:

1. Create `math.ts`, `transfer.ts`, `pipeline.ts`, `cvd.ts`, and `registry.ts`.
2. Add `selftest.ts` and run it from `Viewport.svelte` on mount.
3. Port functions with minimal behavior changes.
4. Add focused unit tests if a test runner is introduced later; until then,
   keep runtime selftest logging.

Verification:

- `npm run check`
- browser console shows `pipeline selftest` with max error below `1e-6`

### Phase 3: WebGL Renderer

Goal: render the main instanced solid in Svelte.

Tasks:

1. Move shader strings unchanged.
2. Implement `WebGlRenderer` constructor, compile helper, VAOs, and `draw()`.
3. Implement derived matrices and solid uniform uploads.
4. Draw only the main solid first.
5. Add floor, shell, markers, and outline after the main solid works.

Verification:

- WebGL2 unavailable path is visible and non-crashing.
- Oklab solid renders by default.
- resolution select changes instance count.
- shell and outline draw in the same z-order as the prototype.

### Phase 4: Picking And Inspector Panels

Goal: hover the rendered solid and feed all readouts from one stimulus.

Tasks:

1. Port camera and picking modules.
2. Wire pointermove hover in `Viewport.svelte`.
3. Port chain calculation.
4. Port transfer, cone, xy, and spectrum panels.
5. Keep CVD simulation consistent between renderer and swatch.

Verification:

- hover marker appears on the visible solid or slice cap.
- swatch, chain rows, and all panels update together.
- out-of-gamut state uses the dashed swatch styling.
- changing gamut updates the xy input triangle and transform chain.

### Phase 5: Controls And Slice Behavior

Goal: restore all explorer controls.

Tasks:

1. Wire space, gamut, resolution, slice, plane, shell, CVD, floor, lines, and
   outline controls.
2. Rebuild boundary when slice geometry changes.
3. Reset hover and panels on changes that invalidate the current pick.
4. Preserve defaults from the prototype.

Verification:

- Lightness, hue, and custom planes work.
- steep custom thin slabs do not show the overflow sheet fixed in `design.md`.
- CVD severity affects solid and swatch but not surface grid structure.

### Phase 6: Theme Ramp

Goal: restore ramp anchor, export, and auto-adjust behavior.

Tasks:

1. Port `theme.ts` as pure state transformations.
2. Wire Set A / Set B anchor dropping in `Viewport.svelte`.
3. Implement segment, hue arc, and spread modes.
4. Implement CSS token export and DTCG JSON export.
5. Implement fit gamut, fit WCAG, and even spacing.

Verification:

- anchors survive space and gamut switches because they store sRGB-linear truth.
- ramp markers render in the 3D viewport.
- dashed ramp chips indicate out-of-gamut stops.
- exports match prototype formatting.

### Phase 7: Hardening

Goal: make the Svelte port maintainable.

Tasks:

1. Add browser-safe guards around all `window`, `document`, canvas, and WebGL
   access because SvelteKit can SSR route modules.
2. Add `dispose()` cleanup for WebGL resources and event listeners.
3. Add error panels for shader compilation/linking failures.
4. Add a small developer checklist to `fe/README.md`.
5. Consider a later test setup for color math round trips and theme operations.

Verification:

- `npm run check`
- `npm run build`
- production preview renders the explorer.

## SSR And Browser Boundaries

SvelteKit route modules may run during SSR. Therefore:

- keep WebGL, canvas, `devicePixelRatio`, `ResizeObserver`, `navigator.clipboard`,
  and DOM APIs inside `onMount()` or browser-only callbacks.
- color math modules must remain DOM-free and SSR-safe.
- `WebGlRenderer` should only be constructed with a real `HTMLCanvasElement`.

## State Invalidation Rules

Use these rules while wiring controls:

| Change | Required work |
| --- | --- |
| space mode | rebuild ramp, rebuild boundary, clear hover, redraw panels, draw |
| gamut | rebuild matrices, rebuild ramp, rebuild boundary, clear hover, redraw panels, draw |
| resolution | draw only |
| slice enabled / cut above / cut below | rebuild boundary, clear hover, redraw panels, draw |
| plane mode / offset / azimuth / elevation / epsilon | rebuild boundary, clear hover, redraw panels, draw |
| floor / lines | draw only |
| shell | rebuild shell matrices, draw |
| outline | rebuild boundary, draw |
| CVD mode / severity | redraw solid, swatch, and chain display |
| theme steps / mode / spread controls | rebuild ramp, draw |
| theme fit/export buttons | mutate or export theme only, then draw when stops change |

## Behavioral Invariants To Preserve

- Solid geometry remains one unit quad drawn as `6 * N * N` instances.
- All gamut matrices are computed from primaries and white in TypeScript.
- The shader receives matrices as uniforms and should not hard-code CPU-owned
  color-space matrices.
- Slice fold must end on cube clamp and only flatten the final cap where the
  snapped point remains a valid color.
- Picking is analytic CPU-side visible-surface picking, not GPU readback.
- One picked stimulus feeds every inspector panel.
- CVD is simulated at the LMS cone stage and keeps neutral grays fixed.
- Wide-gamut shell renders before the main solid with depth testing disabled.
- Cross-section outline renders last with depth testing disabled.
- Theme anchors store absolute sRGB-linear values.

## Open Decisions

- Tests: the current `fe/` project has no test runner. Start with `svelte-check`
  plus runtime `selftest()`, then add Vitest when color math begins to stabilize.
- Icons: the prototype uses text-only controls. Keep parity first; introduce an
  icon library only if the control surface is redesigned.
- CSS location: global CSS is simplest for initial parity. Component-scoped CSS
  can follow once the module split is stable.
- WebGPU: defer until WebGL2 parity. The design already isolates this to a
  future renderer module.

## Suggested First Implementation Commit

The first implementation commit should be small:

1. Add `fe/src/app.css` with prototype variables and layout styles.
2. Import it from `+layout.svelte`.
3. Replace `+page.svelte` with `AppShell`.
4. Add static `LeftControls`, `Viewport`, and `RightInspector` components.
5. No WebGL logic yet.

This creates the Svelte surface area and lets subsequent commits migrate one
prototype module at a time.
