# Umami Analytics Implementation Plan

Status: design/specification, ready for implementation

Server: provided by environment variable only.

## Goal

Add lightweight, privacy-conscious Umami analytics to understand how the color explorer is used:

- page/app loads
- document workflow usage
- theme ramp workflow usage
- 3D interaction feature usage
- display/color-model feature usage
- mobile vs desktop interaction patterns

Avoid tracking color values, document names, exported token content, or anything that could identify a user's private work.

## Integration Summary

Umami is added with a deferred tracker script. Both the server URL and website id should come from public environment variables so deployments can point at different Umami instances without code changes.

Recommended script shape:

```html
<script
  defer
  src="%PUBLIC_UMAMI_SRC%"
  data-website-id="%PUBLIC_UMAMI_WEBSITE_ID%"
  data-do-not-track="true"
  data-exclude-search="true"
  data-exclude-hash="true"
></script>
```

Use `data-domains` in production if the app has a stable public hostname. Do not set it until that hostname is known, otherwise analytics may silently not fire in deployments or previews.

## Configuration

Add a public environment variable:

```text
PUBLIC_UMAMI_SRC=<umami tracker script URL>
PUBLIC_UMAMI_WEBSITE_ID=<uuid from your Umami instance>
```

SvelteKit/Vite supports `.env` files. Add a committed example file and keep real ids out of git:

```text
# fe/.env.example
PUBLIC_UMAMI_SRC=
PUBLIC_UMAMI_WEBSITE_ID=
```

Local/deployment files:

```text
# fe/.env
PUBLIC_UMAMI_SRC=<real umami tracker script URL>
PUBLIC_UMAMI_WEBSITE_ID=<real website id>
```

Rules:

- Commit `fe/.env.example`.
- Do not commit `fe/.env` if it contains a real website id.
- Do not commit the Umami server URL.
- The app should not inject the tracker unless both `PUBLIC_UMAMI_SRC` and `PUBLIC_UMAMI_WEBSITE_ID` are set.
- Prefer a full script URL in `PUBLIC_UMAMI_SRC`, not only a host, so reverse-proxy paths such as `/script.js`, `/umami.js`, or custom paths are supported.

Implementation options:

1. **Svelte component in root layout**: preferred.
   - Create `fe/src/lib/components/UmamiTracker.svelte`.
   - Use `<svelte:head>` to inject the script only when both `PUBLIC_UMAMI_SRC` and `PUBLIC_UMAMI_WEBSITE_ID` are set.
   - Keeps app HTML generic and prevents committing a placeholder script with no id.

2. **Direct `app.html` script**: acceptable but less flexible.
   - Requires env replacement or hardcoding.
   - Easier to accidentally enable tracking in local dev.

Preferred implementation:

```svelte
<script lang="ts">
  import { dev } from '$app/environment';
  import { env } from '$env/dynamic/public';

  const src = env.PUBLIC_UMAMI_SRC;
  const websiteId = env.PUBLIC_UMAMI_WEBSITE_ID;
  const enabled = !dev && !!src && !!websiteId;
</script>

<svelte:head>
  {#if enabled}
    <script
      defer
      src={src}
      data-website-id={websiteId}
      data-do-not-track="true"
      data-exclude-search="true"
      data-exclude-hash="true"
    ></script>
  {/if}
</svelte:head>
```

Then render `<UmamiTracker />` from the root route or layout.

## Tracking Helper

Add a tiny browser-safe helper:

```ts
// fe/src/lib/analytics/umami.ts
type UmamiEventData = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: UmamiEventData) => void;
    };
  }
}

export function track(eventName: string, data?: UmamiEventData) {
  if (typeof window === 'undefined') return;
  window.umami?.track(eventName, data);
}
```

Rules:

- Event names should stay under Umami's documented 50-character limit.
- Event data should be low-cardinality.
- No raw color coordinates, document names, tokens, localStorage ids, or free text.
- Prefer booleans/enums/count buckets over exact user content.

## Initial Event Targets

### Document Workflow

These events help understand whether saved states are useful.

| Event | Trigger | Data |
| --- | --- | --- |
| `document_new` | New document created | `{ mobile: boolean }` |
| `document_save` | Save succeeds | `{ source: 'new' | 'existing' | 'example' }` |
| `document_save_as` | Save As succeeds | `{ from: 'untitled' | 'user' | 'example' }` |
| `document_load` | User loads a document/example | `{ source: 'user' | 'example' }` |
| `document_delete` | Delete succeeds | `{ source: 'user' }` |

Do not send document names or ids.

Implementation area:

- `fe/src/lib/documents/session.svelte.ts`
- `fe/src/lib/components/DocumentBar.svelte` only if UI-level event attribution is needed

### Theme Ramp Workflow

These are high-value because ramp generation is a core user workflow.

| Event | Trigger | Data |
| --- | --- | --- |
| `theme_anchor_set` | A/B anchor is set from canvas | `{ arm: 'A' | 'B', method: 'panel' | 'shortcut' | 'touch' }` |
| `theme_mode_change` | Segment/arc/spread mode selected | `{ mode: 'seg' | 'arc' | 'spread' }` |
| `theme_steps_change` | Step count changed, debounced | `{ bucket: '2-4' | '5-8' | '9-12' }` |
| `theme_export` | CSS or DTCG export clicked | `{ format: 'css' | 'dtcg' }` |
| `theme_fit_gamut` | Fit stops inside sRGB | none |
| `theme_fit_wcag` | Ensure WCAG AA | `{ bg: 'white' | 'black', target: number }` |
| `theme_fit_even` | Even perceptual spacing | none |

Do not send generated color values or token text.

Implementation areas:

- `fe/src/lib/components/ThemeRamp.svelte`
- `fe/src/lib/components/Viewport.svelte` for A/B shortcut and touch picking

### 3D Canvas Gestures

Track usage of the newly added direct manipulation tools without spamming every drag frame. Fire once per completed gesture, not on every pointer move.

| Event | Trigger | Data |
| --- | --- | --- |
| `canvas_orbit` | Orbit gesture ends | `{ input: 'mouse' | 'touch' | 'pen' }` sampled or throttled |
| `canvas_pan` | Pan gesture ends | `{ input: 'mouse' | 'touch' | 'pen' }` |
| `canvas_zoom` | Wheel/pinch zoom ends or throttled | `{ input: 'wheel' | 'pinch' }` |
| `canvas_inspect` | Touch inspect gesture ends | `{ input: 'touch' }` |
| `canvas_slice_drag` | Slice offset drag ends | `{ input: 'mouse' | 'touch' }` |
| `canvas_cylinder_drag` | Cylinder radius drag ends | `{ input: 'mouse' | 'touch' }` |
| `gesture_reference_open` | Gesture popup opened | `{ mobile: boolean }` |
| `touch_tool_change` | Mobile touch tool selected | `{ tool: 'auto' | 'slice' | 'cylinder' | 'pickA' | 'pickB' }` |

For `canvas_orbit` and `canvas_zoom`, consider sampling to avoid noisy, high-volume events. Direct edit events can be unsampled because they are less frequent and product-significant.

Implementation areas:

- `fe/src/lib/components/Viewport.svelte`
- `fe/src/lib/components/ViewportToolbar.svelte`
- `fe/src/lib/components/GestureReferencePopover.svelte`

### Color Model and Display Controls

These help decide which visual features matter.

| Event | Trigger | Data |
| --- | --- | --- |
| `space_change` | World color space changed | `{ space: 'rgb' | 'xyz' | 'lab' | 'oklab' | 'luma' }` |
| `gamut_change` | Gamut changed | `{ gamut: string }` |
| `slice_toggle` | Slice enabled/disabled | `{ enabled: boolean }` |
| `plane_mode_change` | Slice plane mode changed | `{ mode: 'L' | 'H' | 'C' }` |
| `cylinder_toggle` | Cylindrical cut enabled/disabled | `{ enabled: boolean }` |
| `shell_change` | Wide-gamut shell changed | `{ shell: string }` |
| `cvd_change` | Color vision mode changed | `{ mode: string }` |
| `display_toggle` | Floor/grid/outline toggled | `{ control: string, enabled: boolean }` |

Implementation area:

- `fe/src/lib/components/LeftControls.svelte`
- `fe/src/lib/components/ViewportToolbar.svelte`

For slider-heavy controls, avoid sending every slider value. Track toggles and mode changes; for direct manipulation gestures, send only gesture completion.

### Inspector Usage

Track which analysis panels people actually open on mobile/narrow layouts.

| Event | Trigger | Data |
| --- | --- | --- |
| `inspector_tab` | Mobile inspector tab selected | `{ tab: 'transfer' | 'cones' | 'xy' | 'values' }` |

Implementation area:

- `fe/src/lib/components/RightInspector.svelte`

## Deferred or Avoided Events

Avoid initially:

- raw hover/inspect coordinates
- exact RGB/XYZ/LMS/Lab/Oklab values
- exported CSS or JSON contents
- document names, ids, or localStorage keys
- every slider frame
- every mouse hover

Possible later:

- anonymized feature funnels, for example `open_example -> set_anchor -> export`
- performance event collection via `data-performance="true"` if Core Web Vitals are useful
- `data-tag` for staged UI experiments

## Implementation Phases

### Phase 1: Pageview Tracking

1. Add `PUBLIC_UMAMI_SRC` and `PUBLIC_UMAMI_WEBSITE_ID` env support.
2. Add `fe/.env.example`.
3. Create `UmamiTracker.svelte`.
4. Render tracker from root route/layout.
5. Use:
   - `data-do-not-track="true"`
   - `data-exclude-search="true"`
   - `data-exclude-hash="true"`
6. Verify app works when either env var is missing.

Acceptance:

- No script is injected without both `PUBLIC_UMAMI_SRC` and `PUBLIC_UMAMI_WEBSITE_ID`.
- Script is injected with the configured server script URL when set.
- Page loads are visible in Umami.

### Phase 2: Tracking Helper

1. Add `fe/src/lib/analytics/umami.ts`.
2. Expose a browser-safe `track()` function.
3. Add minimal type declaration for `window.umami`.

Acceptance:

- SSR/build does not reference `window`.
- Calling `track()` before Umami loads is harmless.

### Phase 3: Low-Volume UI Events

Implement first:

- document events
- theme export/fit events
- gesture reference open
- inspector tab changes
- mode/toggle changes

Acceptance:

- Events appear in Umami.
- No high-cardinality private fields are sent.

### Phase 4: Gesture Completion Events

Implement event-on-completion in `Viewport.svelte`:

- pan
- slice drag
- cylinder drag
- touch inspect
- sampled orbit/zoom if desired

Acceptance:

- Gesture events fire once per completed gesture.
- Direct manipulation events are not emitted every frame.

### Phase 5: Review Dashboard and Prune

After a few days of use:

- remove low-value events
- add missing properties only if they answer specific product questions
- consider grouping related events into Umami goals/funnels

## Open Questions

- What is the Umami website id for this app?
- What public hostname should be allowed in `data-domains`, if any?
- Should local development be tracked when the env var is present, or should tracking require `import.meta.env.PROD`?

Recommendation:

- Do not track local dev by default.
- Enable tracking only when `PUBLIC_UMAMI_WEBSITE_ID` is set and `import.meta.env.PROD` is true, unless explicitly testing analytics.

## Sources

- Umami tracker configuration: `https://docs.umami.is/docs/tracker-configuration`
- Umami event tracking: `https://docs.umami.is/docs/track-events`
