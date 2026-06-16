# Ramp Builder Status Hierarchy Plan

Status: **implemented** (schema v13 UI).

## Problem

The current Ramp Builder headers show related but inverted information:

- Step **1 Ramp Builder** status shows the selected list and the point count on
  that active list (`List 1/3 · 4 pts`).
- Step **1.1 Source colors** status shows global totals (`3 lists · 12 pts`).
- The list manager inside Step 1 already shows the list chips and active list.
- The Sources panel body also labels the active list (`Points — list 1`).

This makes the information hierarchy feel messy. The parent step is acting like
the active-list editor, while the child source step is acting like the global
list summary. Since Step 1.1 is where users edit the active list's points, its
header should describe the active list. Global totals should live with the list
manager.

## Proposed Hierarchy

Use three distinct layers:

| UI location | Question it answers | Recommended status |
|-------------|---------------------|--------------------|
| Step 1 `Ramp Builder` header | Which ramp pipeline instance is selected? | `List 2 of 4` or `List 2 of 4 · custom settings` |
| List manager row/chips | What lists exist globally? | chips with per-list point counts, plus optional compact total |
| Step 1.1 `Source colors` header | What is in the active source list? | `4 pts` / `No points` / `1 point` |

In short:

- **Parent:** selected list context.
- **List manager:** global list inventory.
- **Sources substep:** active-list point editing state.

## Recommended Copy

### Step 1: Ramp Builder

Status:

- Single list: `List 1`
- Multiple lists: `List 2 of 4`
- If any non-active list has different pipeline settings: `List 2 of 4 · mixed`

Avoid showing the active list's point count here. It creates redundancy with the
Sources substep and makes the parent look like a source-list panel rather than
the owner of Interpolate/Place/Expand settings.

### List Manager

Each chip should carry local list identity and local point count:

```text
1 · 3 pts   2 · empty   3 · 5 pts
```

Optional compact global summary, placed near the list actions rather than in a
pipeline-step header:

```text
3 lists · 8 points total
```

This is the only place where total list count and total point count should be
shown together, because this is the only UI element whose job is managing all
lists.

### Step 1.1: Source Colors

Status:

- No active points: `No points`
- One active point: `1 point`
- Multiple active points: `4 points`

If needed, include selected point state only when useful:

```text
4 points · point 2 selected
```

Do not show total list count here. Step 1.1 edits only the active list.

## Visual Layout

Recommended order inside Step 1:

```text
1 Ramp Builder                         List 2 of 4 · mixed
  [list chips: 1 · 3 pts] [2 · empty] [+] [duplicate] [delete]
  3 lists · 3 points total

  1.1 Source colors                    No points
      ...
  1.2 Interpolate                      Spline Oklch
  1.3 Place                            9 stops · even
  1.4 Expand                           Off
```

If the global summary feels too heavy, omit it entirely. The chip row already
communicates count and distribution better than a repeated text total.

## Implementation Notes

Likely changes:

- In `fe/src/lib/components/pipeline-nodes.ts`:
  - `ramp-builder.status` should return active-list identity only, plus a mixed
    pipeline cue when relevant.
  - `sources.status` should return the active list's point count only.
- In `fe/src/lib/components/ThemeRamp.svelte` `panel="list-manager"`:
  - list chips should expose each list's point count.
  - global totals can be moved here or omitted.
- In `fe/src/lib/components/ThemeRamp.svelte` `panel="sources"`:
  - avoid repeating `Points — list N` if Step 1 and the chip row already show
    active list identity. A simple `Points` heading is enough.

## Acceptance Criteria

- No header shows both global list totals and active-list point totals.
- Step 1.1 always describes the active list, never all lists.
- Global totals, if shown, appear only beside the list manager.
- Users can still identify the active list at a glance.
- The layout remains compact when there is one list and when there are many.
