# Sidebar Footer Layout Proposal

**Status: shipped** (2026-06-16). Implemented in `LeftControls.svelte` + `app.css`.

## Problem

The left sidebar footer had renderer/view preferences arranged as loose rows with
uneven rhythm: labels at different horizontal positions, checkboxes without a
clear column, and the Min FPS select reading as a dangling form field.

## Design Goal

Make the footer read as a polished, compact utility/status area:

- visually quieter than pipeline stages;
- grouped by purpose;
- stable grid rhythm;
- no free-floating labels or controls;
- compact enough to preserve vertical space;
- clear enough for tutorial targets such as Auto-rotate and Hide aids.

## Shipped Layout

Two labelled groups side by side in one footer row:

```text
┌──────────────────────────────┬─────────────────────┐
│ VIEW AIDS                    │ PERFORMANCE         │
│ [✓] Floor grid  [✓] Hide aids│ [✓] Auto-reduce     │
│ [✓] Auto-rotate [ ] Neutral  │ Min FPS      [30 ▾] │
│     backdrop                 │                     │
└──────────────────────────────┴─────────────────────┘
```

### Why this works

- **View aids** groups visual toggles (including neutral explorer backdrop).
- **Performance** groups the adaptive tessellation policy and its threshold.
- Horizontal split keeps both groups visible without stacking; Performance uses
  a vertical 1×2 stack so Min FPS stays visually tied to Auto-reduce.
- Group labels give users a scanning anchor without promoting these controls to
  pipeline-stage importance.

## Component Structure

Local to `LeftControls.svelte`; styles in `app.css` (`.sidebar-footer-columns`,
`.sidebar-footer-grid-aids`, `.sidebar-footer-grid-performance`).

Markup uses compact checkbox labels (not `ToggleRow`) and tutorial targets:

- `[data-tutorial="floor-grid"]`
- `[data-tutorial="hide-aids"]`
- `[data-tutorial="auto-rotate"]`
- `[data-tutorial="neutral-backdrop"]`

## Responsive Behavior

Desktop sidebar uses a `1.2fr / 0.8fr` column split with a vertical divider.
Narrow/mobile drawer: same structure; View aids labels may wrap within 2×2 cells.

Optional future improvement: stack columns below ~300px drawer width if the
split feels cramped on very narrow viewports.

## Non-Goals (unchanged)

- Do not move these controls into pipeline nodes.
- Do not hide Min FPS when Auto-reduce is off; disable it so the relationship
  remains visible.
- Do not make the footer a floating card inside the sidebar.
