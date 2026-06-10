# Camera Freedom and Canvas Gesture Plan

Status: design/specification, ready for implementation planning

## Goals

The 3D canvas should support the high-frequency operations directly in the viewport:

- Pan the camera target.
- Orbit freely enough to inspect the color solid from below.
- Adjust the clipping plane offset directly on the canvas.
- Adjust the cylindrical cut radius directly on the canvas.
- Quickly select theme colors A and B directly from the solid.
- Preserve the existing mobile behavior where touching the visible solid inspects it, and dragging outside the visible solid or clipped region orbits.

The design should keep accidental edits rare. View-only gestures remain the default. Editing gestures require keyboard modifiers on desktop and explicit tool/latch affordances on touch devices.

## Current State

Relevant files:

- `fe/src/lib/engine/camera.ts`
- `fe/src/lib/components/Viewport.svelte`
- `fe/src/lib/engine/picking.ts`
- `fe/src/lib/engine/theme.ts`
- `fe/src/lib/components/LeftControls.svelte`

The camera currently stores:

- `yaw`
- `pitch`
- `dist`
- `target`
- `fov`

The viewport currently supports:

- Mouse drag: orbit.
- Mouse wheel: zoom.
- Trackpad/browser pinch via `ctrlKey` wheel: zoom.
- Two-touch pinch: zoom.
- Mouse hover: inspect solid and update `hover`.
- Touch drag from visible solid: inspect-drag.
- Touch drag from empty/clipped region: orbit.
- Theme pick: if `theme.arm` is active, tap/click a picked solid point to set A or B.

Limitations:

- Pitch is clamped to `[-0.2, 1.45]`, preventing below-view orbit.
- `camRay()` builds the right vector from `cross(f, [0, 1, 0])`, which becomes unstable near vertical views and needs a pole-safe basis for freer orbit.
- There is no pan gesture, despite `camera.target` already existing.
- Direct manipulation of `off` and `cylRad` is only available through sidebar sliders.
- Fast A/B picking still requires arming A or B in the theme panel first.

## Interaction Model

### Desktop Defaults

Keep the unmodified pointer behavior focused on view and inspection:

| Gesture | Action |
| --- | --- |
| Drag on canvas | Orbit |
| Hover solid | Inspect |
| Wheel | Zoom |
| `Ctrl`/trackpad pinch wheel | Smooth zoom |
| Click solid while theme arm is active | Assign armed theme color |

### Desktop Modifier Gestures

Recommended modifier map:

| Gesture | Action | Reasoning |
| --- | --- | --- |
| `Shift` + drag | Pan camera target | Common in graphics tools; no conflict with text selection inside canvas. |
| `Alt` + drag on visible solid | Scrub slice offset | `Alt` suggests alternate manipulation of current selection/surface. |
| `Alt` + drag outside visible solid | Scrub slice offset along vertical screen delta | Allows adjustment even if the slice cap is hard to hit. |
| `Ctrl` + drag | Adjust cylindrical radius | Radius feels like a scalar global operation; separate from `Alt` slice edit. |
| `A` + click/tap visible solid | Set theme color A | Fast explicit color selection without arming panel state. |
| `B` + click/tap visible solid | Set theme color B | Mirrors A selection. |
| `Space` + drag | Temporary pan | Familiar viewport navigation fallback when `Shift` conflicts. |
| Double click visible solid | Recenter camera target to picked world point | High value for detailed inspection. |
| Double click empty space | Reset camera target to default | Fast recovery from panning. |

Avoid using unmodified drag for editing on desktop because it would fight the primary camera orbit workflow.

### Touch Gestures

Touch devices do not have reliable hover or keyboard modifiers. Keep the current direct touch behavior and add explicit latches in the viewport toolbar or bottom inspector:

| Gesture | Action |
| --- | --- |
| One-finger drag from visible solid | Inspect-drag |
| One-finger drag from empty/clipped region | Orbit |
| Two-finger pinch | Zoom |
| Two-finger drag with stable span | Pan camera target |
| Long press visible solid | Open quick pick menu: Set A, Set B, Inspect |
| Toolbar mode: Slice | One-finger vertical drag adjusts `off` |
| Toolbar mode: Cylinder | One-finger horizontal drag adjusts `cylRad` |

The toolbar mode should be momentary or clearly latched. It must show an active state and provide an obvious exit. On mobile, direct parameter manipulation should not be hidden behind keyboard-only modifiers.

## Camera Spec

### Freeer Orbit

Replace the current pitch clamp:

```ts
camera.pitch = Math.min(1.45, Math.max(-0.2, camera.pitch + dy * 0.006));
```

with a symmetric below-capable clamp, for example:

```ts
const PITCH_LIMIT = Math.PI / 2 - 0.04;
camera.pitch = Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, camera.pitch + dy * 0.006));
```

This allows views from below without crossing exactly through the pole.

### Pole-Safe Camera Basis

Update `camRay()` and any pan helper to compute a stable basis:

1. Compute forward `f = normalize(target - eye)`.
2. Choose world up as `[0, 1, 0]`.
3. If `abs(dot(f, worldUp)) > 0.98`, use fallback up `[0, 0, 1]`.
4. Compute `right = normalize(cross(f, upRef))`.
5. Compute `up = cross(right, f)`.

This keeps picking, panning, and ray generation stable near top and bottom views.

### Pan

Pan should translate `camera.target` in the camera plane and preserve `dist`, `yaw`, and `pitch`.

Screen delta to world delta:

```ts
const worldPerPixel = (2 * camera.dist * Math.tan(camera.fov / 2)) / viewportHeight;
target += right * (-dx * worldPerPixel);
target += up * (dy * worldPerPixel);
```

Clamp target softly to a reasonable workspace, for example each component in `[-1.5, 1.5]`, or leave unclamped and provide a reset gesture. A reset is preferable for advanced exploration.

## Direct Manipulation Spec

### Slice Offset Scrub

Primary target state: `explorer.off`.

For a first implementation, use vertical screen delta:

```ts
explorer.off = clamp01(startOff - dy * 0.003);
```

Behavior:

- Works when `Alt` is held and `explorer.slice` is enabled.
- If slice is disabled, `Alt` + drag can enable preview-only scrubbing only if we add a temporary visual affordance. Otherwise ignore and keep orbit.
- Rebuild boundary and redraw during drag.
- Keep `cutAbove`/`cutBelow` unchanged.

Future refinement:

- If the drag begins on the plane cap, convert the hit point delta along the plane normal into `off`. This would feel more physically direct, but it requires a reliable plane/cap hit independent of the clipped solid picker.

### Cylinder Radius Scrub

Primary target state: `explorer.cylRad`.

First implementation:

```ts
explorer.cylRad = clamp(startCylRad + dx * 0.002, 0, 0.8);
```

Behavior:

- Works when `Ctrl` is held and `explorer.cylSlice` is enabled.
- Horizontal drag increases/decreases radius.
- If `cylSlice` is disabled, `Ctrl` + drag should not silently enable it. Instead, ignore or show a status hint.
- Rebuild boundary and redraw during drag.

Future refinement:

- If the drag starts on the cylinder cap or rim, compute radius from the picked world point in the active color-space cylinder frame: `hypot(world.x, world.z)`.
- Add snapping with `Shift + Ctrl` or while holding a toolbar snap toggle.

### A/B Color Picking

The current `theme.arm` flow should remain. Add a faster keyboard path:

- `A` + click visible solid: assign theme A.
- `B` + click visible solid: assign theme B.
- `A` + touch is not reliable on phones, so mobile uses long press or toolbar buttons.

Implementation details:

- Reuse `setThemeStopAt()`.
- Add a parameter: `setThemeStopAt(clientX, clientY, armOverride?: 'A' | 'B')`.
- If `armOverride` is set, assign that arm without changing the current armed panel state, or clear only if it matched the same arm. Prefer not mutating `theme.arm` for keyboard quick pick.
- Rebuild ramp immediately.

## Gesture State Machine

Replace the current gesture union:

```ts
let gesture: 'orbit' | 'inspect' = 'orbit';
```

with:

```ts
type CanvasGesture =
  | { kind: 'orbit' }
  | { kind: 'inspect' }
  | { kind: 'pan'; startTarget: Vec3 }
  | { kind: 'slice-offset'; startOff: number }
  | { kind: 'cylinder-radius'; startRadius: number };
```

On pointer down:

1. Record pointer position.
2. If touch:
   - visible-solid hit => `inspect`
   - otherwise => `orbit`
3. If mouse/pen:
   - `Shift` or `Space` => `pan`
   - `Alt` and `slice` => `slice-offset`
   - `Ctrl` and `cylSlice` => `cylinder-radius`
   - otherwise => `orbit`

On pointer move:

- Dispatch by `gesture.kind`.
- Update `lastX/lastY`.
- For parameter edits, update state, rebuild boundary, update hover if useful, redraw.

On pointer up:

- If movement was below click threshold:
  - `A`/`B` modifier key click assigns theme stop.
  - existing armed pick still works.
  - touch tap inspects.
- Clear gesture.

## Keyboard Tracking

Pointer events expose `shiftKey`, `altKey`, `ctrlKey`, and `metaKey`, but `A`/`B` and `Space` need key state:

- Add local key state in `Viewport.svelte`.
- Register `keydown`/`keyup` on `window` while mounted.
- Ignore key events when the target is `input`, `select`, `textarea`, or contenteditable.
- Track:
  - `keys.space`
  - `keys.pickA`
  - `keys.pickB`

Be careful not to prevent normal browser shortcuts except while the canvas gesture is active.

## Visual Feedback

Direct manipulation needs lightweight feedback:

- Change cursor by mode:
  - orbit: `grab` / `grabbing`
  - inspect: `crosshair`
  - pan: `move`
  - slice-offset: `ns-resize`
  - cylinder-radius: `ew-resize`
- Add a small viewport status chip while dragging:
  - `Slice offset 0.42`
  - `Cylinder radius 0.235`
  - `Pan target 0.12 -0.04 0.30`
- Keep hints short:
  - desktop: `drag orbit | shift drag pan | alt drag slice | ctrl drag cylinder | A/B click pick`
  - mobile: `drag orbit | pinch zoom | touch solid inspect | long press pick`

### Gesture Reference Popup

The current bottom-right viewport hint is useful but too small for the full gesture set. Add an in-canvas reference popup anchored to that hint area.

Behavior:

- The bottom-right hint becomes a compact button or button-like chip, for example `Gestures`.
- Click/tap toggles the reference popup.
- The popup is anchored above the chip and aligned to the bottom-right of the 3D viewport.
- It should never open on hover; hover-triggered UI would be unreliable on touch devices and could interfere with inspection.
- It should close on:
  - `Esc`
  - clicking outside the popup
  - starting a canvas drag/gesture
  - selecting a gesture mode on mobile
- It should not appear during active pointer gestures.
- It should use `pointer-events: auto` only on the popup/chip. The surrounding canvas remains interactive.
- It should be constrained to the viewport bounds and become scrollable if needed on mobile.

Suggested content:

- View:
  - Drag: orbit
  - Wheel / pinch: zoom
  - `Shift` or `Space` + drag: pan
  - Double click solid: center target
  - `R`: reset camera
- Inspect and pick:
  - Hover solid: inspect
  - Touch solid + drag: inspect
  - `A` + click: set theme A
  - `B` + click: set theme B
  - Long press: pick menu on touch
- Direct edits:
  - `Alt` + drag: slice offset
  - `Ctrl` + drag: cylinder radius
  - `[` / `]`: step slice offset
  - `-` / `=`: step cylinder radius
- Toggles:
  - `X`: slice
  - `C`: cylinder
  - `G`: surface grid
  - `O`: outlines

Implementation notes:

- Prefer a small `GestureReferencePopover.svelte` component used inside `Viewport.svelte`.
- Keep reference data in a local array so desktop/mobile content can be filtered without duplicating markup.
- Use a real `<button>` for the trigger with `aria-expanded`, `aria-controls`, and an accessible label.
- The popup does not need to persist open/closed state in documents or snapshots.
- On mobile, the popup should be available from the same bottom hint area or from the compact viewport toolbar if the bottom inspector crowds the canvas.

## Other High-Frequency Gesture Candidates

Recommended:

- `R`: reset camera to default.
- `F`: frame the current color solid, resetting target and distance but preserving current space/gamut.
- `X`: toggle slice.
- `C`: toggle cylinder cut.
- `G`: toggle surface grid lines.
- `O`: toggle plane outline and cylinder outline together.
- `[` and `]`: step clipping offset down/up.
- `-` and `=`: decrease/increase cylinder radius.
- `1`, `2`, `3`, `4`: switch inspector tabs on mobile or narrow layouts.

Lower priority:

- `H`: cycle hue plane azimuth if `planeMode === 'H'`.
- `L`: switch plane mode to lightness.
- `Esc`: cancel active theme arm or parameter manipulation.

Avoid:

- Overloading plain scroll for slice/cylinder edits. Scroll already maps to zoom and is expected in 3D tools.
- Using unmodified tap on mobile to set theme stops. It would conflict with inspect and accidental taps.

## Implementation Plan

### Phase 1: Camera Basis and Below Orbit

1. Add `cameraBasis(camera)` helper in `camera.ts`.
2. Refactor `camRay()` to use the helper.
3. Update pitch clamp in `Viewport.svelte` to symmetric below-capable range.
4. Verify picking remains stable at top/bottom pitch extremes.

Acceptance:

- Dragging can orbit below the cube.
- Hover/touch inspection still picks the correct visible solid.
- No NaN or jump near near-vertical camera angles.

### Phase 2: Pan

1. Add `panCamera(camera, dx, dy, viewportHeight)` helper.
2. Add `pan` to viewport gesture state.
3. Map `Shift + drag` and `Space + drag` to pan.
4. Add cursor/status feedback.
5. Add `R` camera reset.

Acceptance:

- Panning translates the orbit target without changing yaw/pitch/dist.
- Subsequent orbit rotates around the new target.
- Reset restores a useful default camera.

### Phase 3: Fast A/B Picking

1. Add keyboard tracking for `A` and `B`.
2. Extend `setThemeStopAt()` to accept an explicit arm override.
3. On click with `A` or `B`, set the corresponding theme endpoint.
4. Keep existing armed-pick flow unchanged.

Acceptance:

- `A + click` sets color A.
- `B + click` sets color B.
- Theme ramp rebuilds immediately.
- Existing Theme panel arm buttons still work.

### Phase 4: Direct Slice and Cylinder Editing

1. Add `slice-offset` and `cylinder-radius` gesture states.
2. Implement `Alt + drag` for `off`.
3. Implement `Ctrl + drag` for `cylRad`.
4. Rebuild boundaries during the drag.
5. Show status chip with live value.

Acceptance:

- Slice offset changes smoothly on canvas.
- Cylinder radius changes smoothly on canvas.
- Existing sliders stay synchronized.
- Disabled slice/cylinder modes do not produce confusing hidden edits.

### Phase 5: Touch-Specific Editing

1. Add a compact mobile mode selector in the viewport toolbar:
   - Inspect
   - Slice
   - Cylinder
   - Pick
2. In Slice mode, one-finger vertical drag edits `off`.
3. In Cylinder mode, one-finger horizontal drag edits `cylRad`.
4. In Pick mode or on long press, offer A/B selection.
5. Preserve pinch zoom and two-finger pan.

Acceptance:

- Touch users can perform every high-frequency edit without keyboard modifiers.
- Mode state is visible and easy to exit.
- Inspect/orbit behavior remains the default mode.

### Phase 6: Gesture Reference Popup

1. Add `GestureReferencePopover.svelte`.
2. Replace the static viewport hint with a compact trigger plus short inline hint.
3. Anchor the popup to the bottom-right of the viewport.
4. Close it on outside click, `Esc`, and gesture start.
5. Filter or group entries for desktop and touch.

Acceptance:

- Users can open the full gesture reference with one click/tap.
- The popup never opens accidentally while inspecting, orbiting, panning, or editing.
- The popup fits within the viewport on desktop and mobile.
- The existing short hint remains visible when the popup is closed.

## Testing Checklist

Manual:

- Orbit from above, side, and below.
- Hover/touch inspect after below orbit.
- Pan, then orbit around the shifted target.
- Reset camera after pan.
- `A + click` and `B + click` on in-gamut and out-of-gamut visible points.
- Drag slice offset with `Alt`.
- Drag cylinder radius with `Ctrl`.
- Mobile: touch solid inspect, empty drag orbit, pinch zoom, two-finger pan.
- Open and close gesture reference popup with click/tap, outside click, `Esc`, and gesture start.

Automated/unit candidates:

- `cameraBasis()` remains finite near vertical views.
- `panCamera()` translates target by expected basis vectors.
- `clamp` behavior for `off` and `cylRad`.
- Snapshot/session persistence includes camera target and new gesture-independent state only; transient gesture state is not persisted.
