# Sidebar Footer Layout Proposal

Status: proposal for implementation.

## Problem

The current left sidebar footer has five renderer/view preferences arranged as
two loose rows:

- Floor grid
- Hide aids
- Auto-rotate
- Auto-reduce
- Min FPS

In the current layout, each `ToggleRow` keeps its own label/checkbox spacing and
the Min FPS select has a different visual weight. This creates an uneven rhythm:
labels float at different horizontal positions, checkboxes do not share a clear
column, and the select reads as a dangling form field rather than part of the
same settings strip.

The screenshot in `_docs/sidebar-bottom-right-messy-layout.png` shows the core
issue: the footer is functional, but it looks less deliberate than the pipeline
groups above it.

## Design Goal

Make the footer read as a polished, compact utility/status area:

- visually quieter than pipeline stages;
- grouped by purpose;
- stable two-column rhythm;
- no free-floating labels or controls;
- compact enough to preserve vertical space;
- clear enough for tutorial targets such as Auto-rotate and Hide aids.

## Recommended Layout

Use a small footer panel with two labelled groups:

```text
┌────────────────────────────────────────┐
│ VIEW AIDS                              │
│ [✓] Floor grid  [✓] Hide aids  [ ] Auto-rotate │
├────────────────────────────────────────┤
│ PERFORMANCE                            │
│ [✓] Auto-reduce   Min FPS  [ 30 ▾ ]    │
└────────────────────────────────────────┘
```

### Why this works

- **View aids** groups visual toggles that change what the user sees.
- **Performance** groups the adaptive tessellation policy and its threshold.
- The group labels give users a scanning anchor without promoting these controls
  to pipeline-stage importance.
- Two-column rows make checkbox positions predictable.
- Min FPS becomes a compact inline setting owned by Auto-reduce, not an orphaned
  control.

## Component Structure

Keep this local to `LeftControls.svelte`; no new shared component is required
for the first implementation.

Suggested markup shape:

```svelte
<div class="sidebar-footer" aria-label="Viewport preferences">
  <section class="footer-group" aria-label="View aids">
    <div class="footer-group-title">View aids</div>
    <div class="footer-grid two">
      <label class="footer-check" data-tutorial="floor-grid">
        <input type="checkbox" bind:checked={explorer.floor} />
        <span>Floor grid</span>
      </label>
      <label class="footer-check" data-tutorial="hide-aids">
        <input type="checkbox" bind:checked={explorer.hideAids} />
        <span>Hide aids</span>
      </label>
      <label class="footer-check" data-tutorial="auto-rotate">
        <input type="checkbox" bind:checked={explorer.autoRotate} />
        <span>Auto-rotate</span>
      </label>
    </div>
  </section>

  <section class="footer-group" aria-label="Performance">
    <div class="footer-group-title">Performance</div>
    <div class="footer-grid performance">
      <label class="footer-check">
        <input type="checkbox" bind:checked={explorer.autoPerformance} />
        <span>Auto-reduce</span>
      </label>
      <label class="footer-select">
        <span>Min FPS</span>
        <select bind:value={explorer.minAverageFps} disabled={!explorer.autoPerformance}>
          ...
        </select>
      </label>
    </div>
  </section>
</div>
```

Use direct checkbox labels here instead of `ToggleRow`. `ToggleRow` is tuned for
full-width form rows inside pipeline panels; the footer needs denser status-bar
controls.

## Visual Treatment

Recommended CSS direction:

```css
.sidebar-footer {
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--panel) 92%, black);
  padding: 8px 10px 10px;
  display: grid;
  gap: 8px;
}

.footer-group {
  display: grid;
  gap: 5px;
}

.footer-group + .footer-group {
  padding-top: 7px;
  border-top: 1px solid color-mix(in srgb, var(--border), transparent 35%);
}

.footer-group-title {
  color: var(--dim);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.footer-grid {
  display: grid;
  gap: 6px 10px;
  align-items: center;
}

.footer-grid.aids {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.footer-grid.performance {
  grid-template-columns: 1fr auto;
}

.footer-check,
.footer-select {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 11px;
}

.footer-check input {
  flex: none;
}

.footer-select select {
  width: 64px;
}
```

This is intentionally restrained: no nested cards, no heavy border boxes, and no
large controls competing with the pipeline nodes.

## Responsive Behavior

For narrow/mobile drawer widths:

- keep the same group labels;
- allow `View aids` to wrap to a single column below roughly `300px`;
- keep `Performance` as `Auto-reduce` plus `Min FPS` on one row if possible;
- if it does not fit, stack Min FPS below Auto-reduce but keep it indented or
  grouped so it remains visually dependent.

Suggested narrow rule:

```css
@container (max-width: 300px) {
  .footer-grid.two,
  .footer-grid.performance {
    grid-template-columns: 1fr;
  }
}
```

If container queries are not already available in the sidebar, use a normal
media query scoped to the mobile drawer breakpoint.

## Tutorial Compatibility

The tutorial copy already targets:

- `[data-tutorial="auto-rotate"]`
- `[data-tutorial="hide-aids"]`

Add those attributes directly to the corresponding footer labels. This gives
the tutorial high-quality targets while improving the footer at the same time.

Optional additional target:

- `[data-tutorial="floor-grid"]`

This is useful because the tutorial explicitly explains that Floor grid is
separate from Hide aids.

## Implementation Plan

1. Replace the current `sidebar-footer-row` blocks in `LeftControls.svelte`
   with grouped footer markup.
2. Use compact local checkbox labels instead of `ToggleRow` in the footer only.
3. Add tutorial target attributes to Hide aids and Auto-rotate.
4. Update or replace the existing footer CSS with grouped-grid styles.
5. Verify desktop sidebar, mobile drawer width, and tutorial highlight outlines.
6. Run `npm run check` and `npm run build`.

## Non-Goals

- Do not move these controls into pipeline nodes.
- Do not add icons unless the rest of the footer is later iconified.
- Do not hide Min FPS when Auto-reduce is off; disable it so the relationship
  remains visible.
- Do not make the footer a floating card inside the sidebar.
