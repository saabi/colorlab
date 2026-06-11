# Help Popup Visual Design Plan

Status: design plan.

## Problem

Pipeline help popups now have more accurate text, but the repeated paragraph pattern is visually monotonous. Most entries follow the same semantic structure:

- Input
- Changes
- Output
- Does not affect

Because these labels are embedded as ordinary paragraph text, every popup becomes a stack of similar-looking lines. That makes it harder to quickly recognize the structure and harder to spot the distinctive message in each section.

## Goal

Make help popups easier to scan while keeping them compact, quiet, and compatible with the existing `PanelHelp.svelte` component.

The user should be able to identify:

1. The stage summary.
2. The repeated pipeline pattern.
3. The distinctive content inside each pattern section.
4. The sources, without the sources visually competing with the core explanation.

## Design Direction

Use a structured "stage card" layout inside the popup rather than a flat paragraph stack.

Recommended visual hierarchy:

```text
TITLE
One-sentence summary

Input           encoded RGB cube coordinates
Changes         RGB primaries, matrices, transfer curve
Output          linear RGB / XYZ basis
Does not affect ramp gamut mapping, CVD, camera

Sources
...
```

The labels should be visually consistent, but the values should carry the readable weight.

## Content Model

Keep `PanelHelpContent.details` for compatibility, but add an optional structured field:

```ts
export interface HelpStageRow {
  label: 'Input' | 'Changes' | 'Output' | 'Does not affect' | string;
  text: string;
  tone?: 'neutral' | 'change' | 'output' | 'exclude';
}

export interface PanelHelpContent {
  title: string;
  summary: string;
  details?: string[];
  stageRows?: HelpStageRow[];
  sources: HelpSource[];
}
```

Migration strategy:

- Add `stageRows` to pipeline help entries.
- Keep `details` for inspector popups and any legacy content.
- In `PanelHelp.svelte`, render `stageRows` when present; otherwise render `details`.

This avoids parsing labels out of strings such as `Input: ...`.

## Visual Treatment

### Stage Rows

Use compact two-column rows:

- Left column: fixed-width label, uppercase or small caps.
- Right column: sentence text.
- Row gap: small but clear.
- Label color: muted but not faint.
- Text color: main text for content.

Suggested CSS:

```css
.panel-help-stage {
  display: grid;
  gap: 5px;
  margin-top: 2px;
}

.panel-help-stage-row {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  border-left: 2px solid transparent;
  padding: 4px 0 4px 7px;
}

.panel-help-stage-label {
  color: var(--dim);
  font-size: 9px;
  font-weight: 700;
  line-height: 1.35;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.panel-help-stage-text {
  color: var(--txt);
  font-size: 11px;
  line-height: 1.4;
}
```

### Tone Markers

Add restrained left-border color markers to make the pattern recognizable:

- `Input`: neutral blue-gray.
- `Changes`: amber/accent.
- `Output`: green/cyan.
- `Does not affect`: muted red/gray.

Keep these subtle. They should help scan the sections, not turn the popup into a warning panel.

Example:

```css
.panel-help-stage-row.neutral {
  border-left-color: color-mix(in srgb, var(--dim), transparent 45%);
}

.panel-help-stage-row.change {
  border-left-color: color-mix(in srgb, var(--accent), transparent 20%);
}

.panel-help-stage-row.output {
  border-left-color: #65bfa8;
}

.panel-help-stage-row.exclude {
  border-left-color: #a06f6f;
}
```

If the palette feels too colorful in context, use one accent color for all rows and differentiate only by label weight.

### Summary

The summary should remain a normal paragraph, but it needs more separation from stage rows:

- Keep it directly under the title.
- Add a little bottom margin before the structured rows.
- Do not put it inside a card.

### Sources

Sources should be visually de-emphasized:

- Add a top border or slight spacing before `Sources`.
- Keep source labels smaller.
- Use links only where there is a URL.
- Consider collapsing sources later if popups become too tall.

## Mobile Behavior

On narrow popups, collapse stage rows to one column:

```text
Input
encoded RGB cube coordinates

Changes
RGB primaries, matrices, transfer curve
```

CSS:

```css
@media (max-width: 520px) {
  .panel-help-stage-row {
    grid-template-columns: 1fr;
    gap: 1px;
  }
}
```

## Implementation Plan

1. Add `HelpStageRow` and optional `stageRows` to `help-copy.ts`.
2. Convert all `pipeline*` help entries from `details: ['Input: ...']` strings to `stageRows`.
3. Update `PanelHelp.svelte`:
   - render `content.stageRows` as structured rows when available;
   - preserve the existing `details` rendering for inspector and legacy help.
4. Add popup CSS for stage rows and tone markers.
5. Keep popup width unchanged initially; adjust only if the two-column layout feels cramped.
6. Run `npm run check` and `npm run build`.

## Acceptance Criteria

- Pipeline popups expose the repeated pattern visually, not only textually.
- The distinctive content in each row is easier to scan than the labels.
- Inspector popups continue rendering correctly.
- Popups remain compact on desktop and usable on mobile.
- No new cards or nested card styling are introduced.

## Optional Follow-Up

Add small node-scope chips near the title:

- `Explorer`
- `Ramp`
- `Display`
- `Export`
- `View`

This should only be added if it clarifies ownership without adding clutter. The pipeline graph already carries scope, so the popup does not need to repeat it unless user testing shows confusion.
