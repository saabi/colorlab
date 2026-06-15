# Color Space Role Architecture

Status: roadmap architecture note.

This document defines the color-space roles that should guide the next pipeline
and persistence changes. It supersedes older wording that treated "export
gamut", "explorer gamut", and "display gamut" as interchangeable.

## Roles

### Active gamut

The active gamut is the working and output-intent gamut.

It should drive:

- the Explorer solid;
- source/picked color in-gamut checks;
- ramp output intent;
- any ramp-side mapping or constraints that keep generated colors valid for the
  chosen working gamut.

The existing `Gamut` selector should be explained, and eventually labelled, as
`Active gamut`.

### World space

World space is the geometric/perceptual coordinate system used to lay colors out
in the Explorer and to support interpolation choices.

Examples:

- RGB cube;
- CIE XYZ;
- CIELAB;
- Oklab;
- luma layout;
- future perceptual spaces.

World space must not be a durable storage format for ramp source colors. It is a
view/interpolation coordinate system.

### Display gamut

The display gamut describes what the current physical display can actually show.

It should drive:

- Explorer display-gamut classification;
- optional active-gamut-to-display-gamut projection/preview;
- calibration workflows;
- colorimetric precision for on-screen visualization.

Display gamut is user/device preference data, not shared document intent. Store
display-gamut profiles in `localStorage`, because users may have multiple
displays and may switch between them without changing the document.

Initial display gamut behavior can remain `sRGB`, but the architecture should
allow:

- built-in profiles such as sRGB, Display P3, Rec.2020;
- manual primary chromaticity + white point entry;
- imported/downloaded profiles from a display database;
- future calibration-derived profiles.

## Ramp Source Storage

Ramp source lists must be stored in an active-gamut-independent colorimetric
space.

Recommended canonical document/runtime storage:

- `XYZ D65`, relative with `Y = 1` for diffuse white.

Rationale:

- switching Active gamut should not reinterpret source colors;
- switching World space should not reinterpret source colors;
- XYZ is already the app's interchange space between RGB gamuts and perceptual
  spaces;
- existing legacy anchors stored as linear sRGB can migrate by interpreting them
  as linear sRGB D65 and converting once to XYZ D65.

Derived values may still be cached at runtime:

- active-gamut RGB for solid placement and in-gamut checks;
- sRGB/display RGB for preview;
- world coordinates for rendering;
- Oklab/Oklch for interpolation and UI.

Those derived values must not become the canonical document source.

## Source Lists as Pipeline Instances

Different source lists should eventually own independent ramp pipeline settings.

Each source list should be treated as a pipeline instance with its own:

- interpolation mode and space;
- main curve constraint and projection params;
- placement policy;
- Extend/Expand settings;
- extension constraint and projection params;
- visibility/export metadata.

Global controls can remain as defaults or batch operations:

- new lists inherit the current/default pipeline settings;
- duplicated lists copy both source colors and pipeline settings;
- "apply current settings to all lists" can be an explicit command;
- the active list's controls remain the compact default UI.

This avoids the current restriction where all source lists share one set of
ramp settings.

## Constraint Domains

Main curve constraints and extension constraints should be independent.

- Main curve constraint shapes the path through source anchors.
- Extension constraint shapes generated variants after placement.

Examples:

- main curve follows the active clipped surface, extensions remain constant hue;
- main curve stays free, extensions clamp/project to the active gamut boundary;
- each source list chooses a different pair of constraints.

## Ramp Gamut Mapping

The current terminal ramp `Gamut Map` stage is transitional.

Long-term direction:

- ramp source/output intent is the Active gamut;
- main curve and extension constraints should prevent or repair out-of-active
  gamut generated colors at the stage where they are produced;
- terminal mapping may remain as an advanced safety/diagnostic policy, but it
  should not become the main model for ramp color construction.

If terminal ramp mapping remains visible, it should map to the Active gamut, not
to the Display gamut.

## Explorer Display Mapping

Explorer display mapping is independent from ramp output mapping.

Purpose:

- show how the Active gamut relates to the user's Display gamut;
- classify colors that cannot be shown colorimetrically on the current display;
- optionally preview active-gamut-to-display-gamut clipping/projection.

Recommended order:

1. display-gamut profile storage in `localStorage`;
2. shader classification of Active gamut against Display gamut;
3. intersection/outlier visualization;
4. optional projected display preview.

This is a display-accuracy feature, not an export-gamut feature.
