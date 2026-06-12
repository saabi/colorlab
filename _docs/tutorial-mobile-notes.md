# Tutorial system — mobile considerations

## The core problem

On mobile (≤760 px wide), the left sidebar is hidden behind the hamburger drawer. The app layout also collapses the right inspector into the bottom third of the screen. This breaks every assumption the tutorial popover makes:

- **`sidebar-inline` steps** point to `[data-tutorial="node-xxx"]` elements that are inside the closed drawer and therefore not in the visible DOM layout. The sidebar's `getBoundingClientRect()` returns an off-screen rect (transform: translateX(-100%)), so `sr.right + 8` places the card far off the left edge.
- **`inspector-adjacent` steps** point to the right panel, which on mobile is stacked at the bottom as a tab strip — a completely different position and geometry than the desktop aside.
- **`viewport-float` steps** still work because the viewport takes up the top 50dvh regardless of layout mode.
- **`docbar-adjacent` steps** mostly work if the header bar is still visible.

## Option A — Disable on mobile (recommended for v1)

Show a non-blocking banner instead of the popover when `window.innerWidth ≤ 760`. The LanePicker should also suppress the Start button and explain why.

**Pros:** Zero complexity. Avoids broken placement entirely. The tutorial is a learning tool, and the full pipeline is not really operable on a small screen anyway (most controls are hidden behind the drawer, which means any tutorial that opens a node to show something would require repeated hamburger taps).

**Cons:** Mobile users can't use the tutorial at all.

**Implementation:** In `TutorialPopover.svelte`, skip rendering entirely if `window.innerWidth ≤ 760`. In `LanePicker.svelte`, show a notice and disable the Start button below the same breakpoint.

## Option B — Drawer-aware placement

Before each `sidebar-inline` step, programmatically open the sidebar drawer, then position the card to the right of the now-visible sidebar. Close the drawer on tutorial stop/done.

**Pros:** Tutorial actually works on mobile.

**Cons:** Significant complexity:
- Need to thread a `drawerOpen` binder down from AppShell into the tutorial state, or use a context/store.
- Opening the drawer for a tutorial step then letting the user dismiss it (by tapping the backdrop) creates a confusing state — tutorial is mid-step but the sidebar is now closed again.
- Steps that interact with the viewport or inspector while the drawer is open will be obscured.
- The inspector tab strip geometry is completely different on mobile; `inspector-adjacent` steps would need a separate placement branch.

**Likely outcome without careful design:** more confusing than helpful on mobile.

## Option C — Mobile-specific bottom sheet

Replace the floating popover with a full-width bottom sheet on narrow screens. Steps still point to targets, but instead of an arrow connector, the sheet slides up from the bottom and a subtle highlight ring on the target is the only pointer.

**Pros:** Works within mobile layout constraints. Bottom sheets are a native mobile pattern.

**Cons:** Requires a second layout mode for TutorialPopover. `sidebar-inline` steps still assume the target is visible — which it isn't unless the drawer is open. So this only helps for `viewport-float` and `docbar-adjacent` steps; sidebar/inspector steps still need drawer-management logic from Option B.

## Recommendation

**Ship v1 with Option A** (disable on mobile). The app's pipeline is not practically usable on small screens without significant UX work beyond the tutorial, so blocking tutorial access on mobile is honest rather than harmful. Add a clear message in the LanePicker: *"Tutorial is designed for desktop use. Open Color Lab on a wider screen to follow along."*

Revisit with Option C once the broader mobile UX of the pipeline controls is addressed — at that point, sidebar-inline steps can be redesigned to target elements that are visible in the mobile layout (e.g., the drawer header or specific open-state controls), and the bottom sheet popover can be built to complement them.

## Breakpoint

The app already switches layout at 760 px (`@media (max-width: 760px)` in `app.css`). Use this same breakpoint for disabling the tutorial popover.

## Files to touch when implementing Option A

- `LanePicker.svelte` — detect narrow viewport; disable Start button and show a note.
- `TutorialPopover.svelte` — skip rendering when `window.innerWidth ≤ 760` (or listen to a media query via `matchMedia`).
- Optionally: `AppShell.svelte` — hide the Tutorial button in the header on mobile to avoid a dead-end flow.
