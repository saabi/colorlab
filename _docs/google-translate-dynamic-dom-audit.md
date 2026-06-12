# Google Translate Dynamic DOM Audit

Google Translate mutates rendered text nodes in place. In Svelte components where translated text remains mounted while app state swaps the underlying content, the browser extension may keep showing stale translated DOM. The tutorial popover was fixed by remounting each tutorial step with a keyed subtree.

This note lists other places worth testing on the live site before applying the same pattern broadly.

## Highest Priority

### `GestureReferencePopover.svelte`

Test flow:

1. Open `Gestures`.
2. Translate the page.
3. Switch between `Mouse`, `Touch`, and `Keyboard`.

Reason:

The same popover remains mounted while the internal tab swaps entire groups of labels and descriptions. This is close to the tutorial failure pattern.

### `PanelHelp.svelte`

Test flow:

1. Open any `?` help popup.
2. Translate the page.
3. Click another `?` help popup without reloading.

Reason:

The component renders many different help bodies through the same repeated structure. It may need to key the opened help body by `helpId` and `instanceId`.

### `LanePicker.svelte`

Test flow:

1. Open `Tutorial`.
2. Translate the page.
3. Switch `Explore` / `Design`.
4. Switch `Quick` / `Pipeline`.

Reason:

The selected track summary, description, and start button label update in place inside an already translated dialog.

## Medium Priority

### `ThemeRamp.svelte`

Test flow:

1. Translate the page while the ramp controls are visible.
2. Switch source lists.
3. Select different source points.
4. Toggle the color picker.
5. Toggle interpolation, expand, and gamut mapping sections.

Reason:

Several notes, headings, and button labels change based on ramp state while the panel remains mounted. The highest-risk areas are source point editing, staged color picker text, and conditional explanatory notes.

### `RightInspector.svelte`

Test flow:

1. Translate the page.
2. Switch inspector tabs.
3. Hover different colors in the 3D display.
4. Check the `Values` panel and the LMS spectrum wavelength label.

Reason:

The `Values` panel updates continuously from hover state. The LMS panel header also receives dynamic wavelength metadata. This may be acceptable if translated numeric/value content is not important, but stale labels would be confusing.

## Lower Priority

### `DocumentBar.svelte`

Test flow:

1. Translate the page.
2. Open `More`.
3. Trigger save, save-as, rename, and delete dialogs.
4. Toggle dirty/clean document state.

Reason:

Most dialogs mount fresh, which lowers risk. Dynamic confirm messages and button titles are still worth checking.

### `A11yPanel.svelte`

Test flow:

1. Open `Text`.
2. Translate the page.
3. Change font scale, secondary contrast, and line height options.

Reason:

Text is mostly static. The main risk is translated option labels inside a popup that remains mounted while active state changes.

### `PipelinePopover.svelte`

Test flow:

1. Translate the page.
2. Open the `pipeline` hover popup.
3. Enable a color vision deficiency mode.
4. Change severity and re-open the popup.

Reason:

The CVD pipeline step label and detail are dynamic. Since the popup is hover-driven, risk depends on whether Google Translate processes it while it is open.

## Likely Fix Pattern

If any of these reproduce the stale-text issue, prefer a local keyed remount around the smallest dynamic text subtree:

- `GestureReferencePopover`: key the panel body by selected tab.
- `PanelHelp`: key the popover content by `openKey`.
- `LanePicker`: key the summary/action area by selected track.
- `ThemeRamp`: key only the dynamic subpanel or source-picker header, not the whole control surface.
- `RightInspector`: key tab panel content by active tab if stale tab text appears.

Avoid `translate="no"` for these sections unless the text should intentionally remain untranslated.
