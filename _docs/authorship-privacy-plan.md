# Authorship and Privacy Statement Plan

Status: design/specification, ready for implementation

## Goals

Add visible authorship and a concise privacy statement to the app:

- Attribute the project to Sebastian Ferreyra Pons.
- Link authorship to `https://ferreyrapons.com`.
- Explain analytics and local document storage clearly.
- Keep the UI compact; do not crowd the existing document bar or 3D viewport.
- Make the privacy statement available on desktop and mobile.

## Current Layout Constraints

The header currently contains:

- drawer button on mobile
- app title `COLOR LAB`
- subtitle `Gamut Explorer`
- `DocumentBar`
- `WebGL2` badge

There is no footer. The app uses a fixed full-screen grid, with side panels and the viewport filling the screen. A persistent footer would take space from the main tool and is not recommended.

## Recommended UI

### Desktop Header

Add a compact metadata cluster at the right side of the header, near the `WebGL2` badge:

```text
by Sebastian Ferreyra Pons · Privacy
```

Behavior:

- `Sebastian Ferreyra Pons` links to `https://ferreyrapons.com`.
- Link opens in a new tab with `rel="author noopener noreferrer"`.
- `Privacy` is a button that opens a popover/modal.
- Keep the existing `WebGL2` badge.
- On narrower desktop widths, shorten to:
  - `Author`
  - `Privacy`

### Mobile Header

Header space is tighter. Use one of these:

Preferred:

- Put `Author` and `Privacy` in the existing document "More" menu or a new compact app info button.

Alternative:

- Keep a small `Info` button near the `WebGL2` badge.
- The info panel includes both authorship and privacy.

Recommendation:

- Implement a reusable `AppInfo.svelte` component in the header.
- On desktop it renders visible `by ... · Privacy`.
- On mobile it collapses to an `Info` button.

## Privacy Statement Content

Keep the statement short and factual:

```text
Privacy

Color Lab stores your saved parameter sets in this browser's local storage.
They are not uploaded by the app.

If analytics are enabled, this site uses Umami to collect privacy-friendly
usage statistics such as page views and feature interactions. Analytics events
do not include document names, color values, exported tokens, or saved
parameter data.

Analytics are disabled when your browser sends Do Not Track.
```

Optional extra line if useful:

```text
You can clear saved parameter sets from your browser storage at any time.
```

Do not mention the private Umami server URL in the UI.

## Authorship Content

Display:

```text
by Sebastian Ferreyra Pons
```

Link:

```html
<a href="https://ferreyrapons.com" rel="author noopener noreferrer" target="_blank">
  Sebastian Ferreyra Pons
</a>
```

## Implementation Plan

### Phase 1: AppInfo Component

Create:

```text
fe/src/lib/components/AppInfo.svelte
```

Responsibilities:

- Render authorship link.
- Render privacy button.
- Manage open/closed state for the privacy popover.
- Close on outside click and `Esc`.
- Keep markup SSR-safe; browser globals only in `onMount` or `<svelte:document>`.

Suggested structure:

```svelte
<div class="app-info">
  <span class="app-info-author">
    by <a ...>Sebastian Ferreyra Pons</a>
  </span>
  <button type="button" class="app-info-privacy">Privacy</button>
  {#if open}
    <div class="app-info-panel" role="dialog" aria-label="Privacy statement">
      ...
    </div>
  {/if}
</div>
```

### Phase 2: Header Integration

Update:

```text
fe/src/lib/components/AppShell.svelte
```

Add `<AppInfo />` between `DocumentBar` and the `WebGL2` badge, or after the badge if spacing works better.

Preferred order:

```text
COLOR LAB | Gamut Explorer | DocumentBar | AppInfo | WebGL2
```

### Phase 3: CSS

Update:

```text
fe/src/app.css
```

Add:

- `.app-info`
- `.app-info-author`
- `.app-info-privacy`
- `.app-info-panel`
- responsive mobile behavior

Design constraints:

- Match existing dark UI and small header typography.
- No large modal unless mobile viewport requires it.
- Popover should sit below the header, right-aligned, with `z-index` above panels.
- On mobile, use a fixed-width panel constrained to `calc(100vw - 20px)`.

### Phase 4: Analytics

Optional, low priority:

- Track `privacy_open` when the privacy statement opens.
- Track `author_link_click` when the author link is clicked.

Given privacy sensitivity, this can be skipped. If tracked, do not send the destination URL because it is fixed and unnecessary.

Recommendation:

- Do not track privacy/author interactions initially. Keep this informational UI uninstrumented.

## Testing Checklist

- Desktop header does not overflow with document controls.
- Mobile header remains usable.
- Author link opens `https://ferreyrapons.com` in a new tab.
- Privacy panel opens and closes with:
  - button click
  - outside click
  - `Esc`
- Privacy panel is readable on mobile.
- No private Umami server URL appears in UI or committed env files.
- `npm run check`
- `npm run build`

## Open Questions

- Should the visible author label be the full name or shortened to `by SFP` on narrow screens?
- Should the privacy statement include a contact link to the author site?

Recommendation:

- Use full name on desktop.
- Use `Info` on mobile.
- Include the author link only once in the panel/header to avoid clutter.
