# Mobile Header Layout Proposal

## Problem

The current mobile header tries to keep too many desktop actions in one 44px row:

- drawer button
- `COLOR LAB`
- document selector
- undo / redo
- `New`
- `Save`
- `More`
- `Tutorial`
- `Text`
- `Info`
- `WebGL2`

On a real phone viewport this causes several failures:

- The document selector collapses to a nearly unusable width.
- Buttons overlap visually or become hard to distinguish.
- `Text`, `Info`, and `Tutorial` compete with document actions.
- The `WebGL2` badge consumes header space but does not help the mobile workflow.
- Browser UI already reduces effective viewport height, so adding header clutter has a high cost.

The mobile header should prioritize navigation, document identity, and the few actions that are used frequently while editing.

## Recommended Direction

Use a mobile-specific header layout:

1. Top row: app identity and compact action buttons.
2. Optional second row: document selector, only when it can be wide enough to be useful.
3. Move secondary actions into existing menus.
4. Remove `WebGL2` from the header.

This keeps the first viewport focused on the 3D display and avoids turning the header into a compressed desktop toolbar.

## Concrete Layout

### Row 1: Primary Header

Contents:

- hamburger / drawer button
- `COLOR LAB`
- undo icon
- redo icon
- overflow/menu button

Suggested behavior:

- Keep `COLOR LAB` short; no subtitle on mobile.
- Keep undo/redo as icon-only buttons because they are common and compact.
- Replace separate `Text`, `Info`, `Tutorial`, `New`, `Save`, and `More` buttons with one overflow button, or fold them into the existing `More` menu.
- Hide `WebGL2`.

Example:

```text
[☰] COLOR LAB                         [↶] [↷] [⋯]
```

### Row 2: Document Selector

Contents:

- full-width document selector
- dirty marker integrated inside or adjacent to the selector

Example:

```text
[ Current parameter set                         v ]
```

Rules:

- The selector should span the available width.
- It should not share a row with more than one or two icon buttons.
- If vertical space is too expensive, the selector can move into the overflow menu, but the better default is a second compact row because document identity matters.

## Overflow Menu Contents

Move low-frequency actions out of the main mobile row:

- `New`
- `Save`
- `Save As`
- `Rename`
- `Delete`
- `Guide note`
- `Tutorial`
- `Readability / Text`
- `Privacy / Info`

This can extend the current `DocumentBar` `More` menu into a broader mobile app menu. On desktop, the current distribution can remain.

## WebGL2 Badge

Recommendation: remove it from the visible header on all mobile sizes.

Options:

- Hide it with CSS on mobile.
- Move renderer capability/status into `Info`.
- Show only an error/warning if WebGL2 is unavailable.

The current badge communicates a technical capability that is only useful diagnostically. It is not worth persistent mobile header space.

## Alternative: Single Row With Hidden Selector

If preserving one header row is mandatory:

- Remove the document selector from the header.
- Show the active document name as truncated plain text.
- Put document switching in the overflow menu or a modal sheet.

Example:

```text
[☰] COLOR LAB       Untitled*          [↶] [↷] [⋯]
```

Tradeoff:

This is more compact, but worse for document switching. It is only preferable if the second row noticeably harms the 3D viewport.

## Implementation Notes

Likely implementation points:

- `fe/src/lib/components/AppShell.svelte`
- `fe/src/lib/components/DocumentBar.svelte`
- `fe/src/app.css`
- possibly `fe/src/lib/a11y/A11yPanel.svelte`
- possibly `fe/src/lib/components/AppInfo.svelte`

Suggested CSS structure:

- At `max-width: 760px`, make `.app-header` allow wrapping or use a grid with two rows.
- Let `.document-bar` become a contents-like mobile layout or split it into selector and actions wrappers.
- Set `.document-switcher-wrap` to full-width on row 2.
- Hide `.app-header .badge` on mobile.
- Hide standalone `A11yPanel` and `AppInfo` buttons from row 1 if their actions are present in the overflow menu.

Suggested component structure:

- Add a mobile-only overflow menu in `DocumentBar`, or extend the existing `More` menu when mobile CSS is active.
- Keep desktop behavior unchanged.
- Preserve accessible labels for icon-only buttons.
- Ensure touch targets stay at least roughly 36px high where possible.

## Preferred First Implementation

1. Hide `WebGL2` on mobile.
2. Convert mobile header to two rows:
   - row 1: drawer, title, undo, redo, overflow
   - row 2: full-width document selector
3. Move `New`, `Save`, `Tutorial`, `Text`, and `Info` into the mobile overflow menu.
4. Keep desktop header unchanged.

This should solve the immediate cramping without redesigning the rest of the mobile layout.
