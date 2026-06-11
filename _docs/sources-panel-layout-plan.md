# Plan: Sources step layout rework

Status: **implemented**. Follow-up to the multi-list work in
[picker-and-multilist-plan.md](./picker-and-multilist-plan.md) and the Set A/B
removal.

## Problem

After removing Set A/B and adding list chips, the Sources panel reads as four
disconnected fragments, in this order:

1. "Pick source colors" label + **+ Add point** button
2. Touch tool select + long instructional note
3. "Show points in 3D" toggle
4. "Source lists" chips (+ note)
5. "Points" rows (select / chip / hex / Up / Down / Copy / ×)
6. "Open color picker" + inline picker at the very bottom

Specific issues:

- **+ Add point is isolated** from the points list it appends to — separated
  by the touch tool, a paragraph, a toggle, and the chips.
- Two ways of adding a point (**pick on solid** vs **color picker**) sit at
  opposite ends of the panel even though they are siblings.
- Three competing headers ("Pick source colors", "Source lists", "Points")
  fragment what is one concept: *the lists and their points*.
- Auxiliary settings (touch tool, 3D visibility) interleave with the primary
  edit flow instead of trailing it.

## Proposed layout

Order by the user's mental model: *choose list → see its points → add/edit
points → auxiliary options*. Add actions become the **footer of the points
list**, like an "add row" affordance in a table.

```text
SOURCES
┌────────────────────────────────────────┐
│ Lists   (1) (2) (3)  [+] [×]           │  ← chips first: context for all below
│  Each list is its own ramp. Editing 2. │  ← only when >1 list (existing note)
├────────────────────────────────────────┤
│ Points — list 2                        │
│  1  ▓ #aabbcc          Up Dn Copy ×    │
│  2  ▓ #ddeeff          Up Dn Copy ×    │
│  (empty list: "No points yet — add     │
│   below or hold A and click the 3D.")  │
│ ┌──────────────────┬─────────────────┐ │
│ │ + Pick on solid  │ + Color picker  │ │  ← add actions, attached to the list
│ └──────────────────┴─────────────────┘ │
│  [inline ColorPicker when open]        │  ← directly under its trigger
├────────────────────────────────────────┤
│ Show points in 3D            [toggle]  │  ← aux block trails the edit flow
│ Touch tool                  [select ▾] │
│  Drag a point in 3D to move it ·       │
│  Delete removes · A + click adds.      │  ← one-line caption, not a paragraph
└────────────────────────────────────────┘
```

### Details

- **Chips row** keeps current behavior (select / add / remove, min 1). Move it
  to the top; its label becomes the step's only header besides "Points".
- **+ Pick on solid** = the current "+ Add point" arm toggle, renamed so the
  mechanism is explicit next to "+ Color picker". Armed state keeps the
  "Adding… click the solid" label.
- **+ Color picker** = the current "Open color picker" in staging mode
  (`selectedPoint = null`); the picker opens inline directly beneath the two
  buttons with the existing "Add as new point" header. Clicking a point row
  still opens the same picker in edit mode — so the picker has exactly one
  home, right under the points it edits.
- **Empty-list state**: keep the panel useful when a fresh list is added — a
  short placeholder line inside the points area, with the add actions visible
  right below it (today the actions sit above and the hint paragraph far
  above).
- **Aux block**: "Show points in 3D" + "Touch tool" move to the bottom of the
  step; the instructional paragraph shrinks to a one-line caption (the gesture
  reference popover already documents the rest).
- The "Pick source colors" label is dropped (redundant with the step header).

### Out of scope (noted, not planned)

- Compacting the per-row Up/Dn/Copy/× buttons into icons or a drag handle.
- Per-list color/name tags on chips (could later mirror each list's ramp
  endpoint colors).

## Touch surface

| File | Change |
|---|---|
| `fe/src/lib/components/ThemeRamp.svelte` | Sources markup reorder + button labels + empty state + caption; small CSS (add-actions grid) |
| `fe/src/lib/inspector/help-copy.ts` | Sources stage row wording if labels change |

No engine, schema, or persistence changes; `npm run check` + `npm test` +
`npm run build`, then one commit.
