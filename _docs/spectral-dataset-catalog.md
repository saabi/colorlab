# Spectral, Locus, and XYZ Dataset Catalog

Status: seed catalog for exploration/comparison work.

This catalog supports the LMS fundamentals, chromaticity, locus, and XYZ-space
roadmap. COLOR LAB should treat observer datasets, XYZ-like spaces, locus
curves/surfaces, and diagram definitions as explorable data, not as single
hidden constants. The target is to track every known/sourceable public or
standard dataset relevant to spectral-to-tristimulus conversion, cone
fundamentals, chromaticity diagrams, spectral locus geometry, XYZ-like spaces,
and observer comparison.

Bundling policy:

- Bundle only datasets whose license/redistribution terms are compatible with
  the app.
- For restricted or unclear sources, keep metadata and external references but
  do not include raw tables until the license is resolved.
- Preserve source provenance, native sampling interval, wavelength range,
  normalization, field size, and whether data is energy- or quantal-based.
- Keep analytical approximations as dataset/evaluator entries when their source,
  valid range, and error profile are documented.
- Downloaded data goes under `data/`:
  - `data/raw/` for original downloaded files;
  - `data/processed/` for normalized/generated tables;
  - `data/reports/` for audit summaries, fit residuals, and comparison outputs.

## Required Metadata

Each registry entry should record:

| Field | Purpose |
|-------|---------|
| `key` | Stable programmatic id |
| `label` | User-facing label |
| `kind` | `cmf`, `rgbCmf`, `lmsFundamental`, `luminousEfficiency`, `photopigment`, `xyzSpace`, `chromaticityDiagram`, `locusCurve`, `locusSurface`, `derivedMatrix`, `analyticalFit`, `auditReport` |
| `source` | Standard/paper/database citation |
| `url` | Primary source or landing page |
| `license` | Bundling/redistribution status |
| `wavelengthRange` | Native valid wavelength range |
| `sampleIntervalNm` | Native sample interval |
| `fieldSizeDeg` | 2°, 10°, or source-specific |
| `basis` | energy, quantal, normalized, transform-only, etc. |
| `normalization` | peak, area, Y=1, equal-energy, source-specific |
| `storagePath` | `data/raw/...`, `data/processed/...`, or external-only |
| `checksum` | Hash for committed/downloaded source files |
| `status` | `candidate`, `verified`, `bundled`, `external-only`, `rejected` |
| `notes` | Known issues, compatibility, transforms, derived diagrams |

## Seed Dataset Families

### CIE Standard Color-Matching Functions

| Dataset | Kind | Field | Status | Notes |
|---------|------|-------|--------|-------|
| CIE 1931 XYZ CMFs | `cmf` | 2° | candidate | Official CIE open dataset exists at 1 nm steps. Use as baseline for current xy and many RGB/XYZ conversions. |
| CIE 1964 XYZ CMFs | `cmf` | 10° | candidate | Official CIE open dataset exists at 1 nm steps. Useful for large-field comparison. |
| CIE 1931 RGB CMFs | `rgbCmf` | 2° | candidate | Needed for Wright/Guild lineage and negative-primary comparisons; verify source table and license. |

### XYZ-Like Colorimetric Spaces

XYZ-like spaces must be tracked separately from their CMF source tables because
the same source functions can imply multiple projections, diagrams, and derived
loci.

| Dataset | Kind | Field | Status | Notes |
|---------|------|-------|--------|-------|
| CIE 1931 XYZ | `xyzSpace` | 2° | candidate | Standard XYZ space derived from CIE 1931 CMFs; default basis for current xy diagrams and many RGB matrices. |
| CIE 1964 XYZ_10 | `xyzSpace` | 10° | candidate | Large-field XYZ-like space derived from CIE 1964 CMFs. |
| CIE 2006 / CIE 170 XYZ_F | `xyzSpace` | 2° / 10° | candidate | Physiological XYZ-like spaces derived from LMS fundamentals. |
| Judd / Judd-Vos corrected XYZ-like spaces | `xyzSpace` | 2° | candidate | Useful for blue-end correction comparisons. |
| Stiles & Burch RGB spaces | `xyzSpace` / `rgbCmf` | 2° / 10° | candidate | Track primary definitions and derived XYZ-like transforms separately. |
| Custom XYZ from CMF triplets | `xyzSpace` | dataset-specific | deferred | Generated spaces for catalog comparison; must preserve source CMF and transform metadata. |

### Chromaticity Diagrams And Locus Geometry

Chromaticity diagrams and spectral loci are derived data, but they should be
cataloged because the app will display and compare them directly.

| Dataset | Kind | Field | Status | Notes |
|---------|------|-------|--------|-------|
| CIE 1931 xy spectral locus | `locusCurve` | 2° | candidate | Derived from CIE 1931 XYZ CMFs; current xy panel equivalent. |
| CIE 1960 UCS locus | `locusCurve` / `chromaticityDiagram` | 2° | candidate | Needed for CRI-style references and historical UCS comparisons. |
| CIE 1976 u'v' locus | `locusCurve` / `chromaticityDiagram` | 2° / 10° | candidate | Useful perceptual-chromaticity comparison view. |
| CIE 1964 x10 y10 locus | `locusCurve` | 10° | candidate | Derived from CIE 1964 XYZ_10. |
| CIE 2006 physiological xF yF loci | `locusCurve` | 2° / 10° | candidate | Derived from physiological XYZ_F spaces. |
| Purple-line / non-spectral boundary definitions | `locusCurve` | diagram-specific | candidate | Needs explicit endpoint and interpolation policy per diagram. |
| Spectral locus intensity surface | `locusSurface` | observer-specific | deferred | Curved surface across intensity/lightness, as discussed for 3D explorer reference layers. |
| Optimal object color boundary / object-color solid data | `locusSurface` | observer-specific | research | Potential future shell/surface reference; track Burns/optimal-color literature and computed datasets. |

### Historical And Corrected CMFs

| Dataset | Kind | Field | Status | Notes |
|---------|------|-------|--------|-------|
| Wright 1928 / Guild 1931 original data | `rgbCmf` / raw observer data | 2° | external-only until source verified | Useful for provenance and observer-variation demos. |
| Stiles & Burch 1955 RGB CMFs | `rgbCmf` | 2° | candidate | Directly measured RGB CMFs; verify source table and license, likely via CVRL/literature. |
| Stiles & Burch 1959 RGB CMFs | `rgbCmf` | 10° | candidate | Basis for later physiological observers; verify source table and license. |
| Judd 1951 modified CIE 1931 | `cmf` | 2° | candidate | Blue-end correction lineage. |
| Judd-Vos 1978 modified CIE 1931 | `cmf` / `luminousEfficiency` | 2° | candidate | Common corrected 2° observer/luminous efficiency reference. |

### Physiological LMS / CIE 2006 Family

| Dataset | Kind | Field | Status | Notes |
|---------|------|-------|--------|-------|
| Stockman & Sharpe 2000 LMS fundamentals | `lmsFundamental` | 2° | candidate | Current app appears close to this family; compare current fit against full table. |
| Stockman & Sharpe 2000 LMS fundamentals | `lmsFundamental` | 10° | candidate | Large-field physiological comparison. |
| CIE 2006 / CIE 170 physiological XYZ_F CMFs | `cmf` | 2° / 10° | candidate | Derived from LMS fundamentals; useful for physiological chromaticity diagrams. Verify publication/data status and redistribution terms. |

### Cone Fundamentals And Photopigment Data

| Dataset | Kind | Field | Status | Notes |
|---------|------|-------|--------|-------|
| Smith & Pokorny 1975 | `lmsFundamental` | 2° | candidate | Historical cone-fundamental alternative. |
| Stockman, MacLeod & Johnson variants | `lmsFundamental` | source-specific | candidate | Include when source tables are verified. |
| Photopigment absorbance templates | `photopigment` / `analyticalFit` | source-specific | candidate | Useful for observer-variability and anomalous-trichromat exploration; keep distinct from CMFs. |
| Govardovskii-style templates | `analyticalFit` | source-specific | candidate | Potential continuous evaluator/fitting basis; benchmark before use. |

### Luminous Efficiency References

| Dataset | Kind | Field | Status | Notes |
|---------|------|-------|--------|-------|
| CIE 1924 photopic `V(lambda)` | `luminousEfficiency` | 2° | candidate | Historical photopic baseline. |
| Judd-Vos corrected photopic `V(lambda)` | `luminousEfficiency` | 2° | candidate | Blue-end corrected luminous efficiency reference. |
| CIE scotopic `V'(lambda)` | `luminousEfficiency` | n/a | candidate | Useful for comparison, not a color-matching observer. |
| CIE mesopic references | `luminousEfficiency` | n/a | deferred | Relevant later if the app explores brightness/lighting conditions. |

### Analytical Approximation Families

| Dataset | Kind | Field | Status | Notes |
|---------|------|-------|--------|-------|
| Current COLOR LAB Gaussian-derivative LMS fit | `analyticalFit` | current default | candidate | Keep as a comparison/evaluator candidate; preserve subranges that pass error/tail criteria. |
| Wyman/Sloan/Shirley CIE XYZ Gaussian approximation | `analyticalFit` | 2° CIE 1931 | candidate | Useful benchmark for compact continuous XYZ approximation. |
| Future generated segmented fits | `analyticalFit` | dataset-specific | deferred | Generated from catalog datasets with documented error bounds. |

### Derived LMS-Like Transform Matrices

These are not measured fundamentals, but they matter for adaptation and display
models. The UI should label them as transform spaces, not observer datasets.

| Dataset | Kind | Field | Status | Notes |
|---------|------|-------|--------|-------|
| Hunt-Pointer-Estevez | `derivedMatrix` | n/a | candidate | LMS-like transform for appearance/adaptation models. |
| Bradford | `derivedMatrix` | n/a | candidate | Planned chromatic adaptation default. |
| CAT02 | `derivedMatrix` | n/a | candidate | Used by CIECAM02-style adaptation. |
| CAT16 | `derivedMatrix` | n/a | candidate | Relevant if CAM16 tooling expands. |

### Observer Variability / Individual Observer Data

| Dataset | Kind | Field | Status | Notes |
|---------|------|-------|--------|-------|
| Individual Stiles & Burch observers | raw observer / `rgbCmf` | source-specific | candidate | Useful for comparing mean vs individual observers if tables are available. |
| ICVIO / newer observer-variability datasets | raw observer / `cmf` | source-specific | research | Track modern datasets, but verify availability and licensing before bundling. |
| Age/lens/macular pigment parametric models | `analyticalFit` / model | source-specific | research | Useful for exploration, not a direct replacement for standard observers. |

## Implementation Notes

- The registry should separate **source tables** from **evaluators**. Multiple
  evaluators can be benchmarked against one source table.
- The first production evaluator can remain hidden while the catalog and reports
  are built.
- The comparison UI should eventually show:
  - curve overlays;
  - spectral locus differences;
  - maximum/RMS error;
  - signed residuals;
  - valid range and extrapolation behavior;
  - license/provenance badges.
- Direct chromaticity picking must record which diagram/observer is active if
  the choice affects the inverse mapping.

## Initial Source Leads

Verified download URLs, `data/` file inventory, and script coverage are documented in
[`spectral-dataset-sources.md`](spectral-dataset-sources.md).

Summary:

- CIE open datasets: https://cie.co.at/data-tables → `https://files.cie.co.at/*.csv`
- CVRL / UCL tables: http://www.cvrl.org/ (POST forms; see sources doc for endpoints)
- Original and review literature for Wright/Guild, ICVIO variability, Wyman/Sloan/Shirley,
  Govardovskii templates, and CAT/HPE matrices where no tabular download exists
