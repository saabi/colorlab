# Dataset Source Verification

Generated: 2026-06-09. Re-run: `python3 data/verify_sources.py`

Compares current `data/raw/` against commit `836ed18` (original CVRL/embedded
sources) and live alternate hosts (CVRL vs CIE).

## Summary

| File | Verdict | Notes |
|------|---------|-------|
| `ss2deg_1nm.csv` | **Fixed** | Was regressed to CIE 5 nm (89 rows); restored CVRL 1 nm (441 rows) |
| `ss10deg_1nm.csv` | **Fixed** | Same as above |
| `ciexyz31_1nm.csv` | OK | CVRL `ciexyz31_1.csv` — matches committed; CIE file is numerically identical but different formatting |
| `ciexyz64_1nm.csv` | OK | CIE ≡ CVRL ≡ committed, byte-identical |
| `vl1924e_1nm.csv` | OK | CIE ≡ CVRL ≡ committed |
| `scvle_1nm.csv` | OK | CIE ≡ CVRL ≡ committed |
| `sbrgb2deg_5nm.csv` | OK | Live CVRL ≡ committed embedded constants |
| `sbrgb10deg_5nm.csv` | **Better** | CVRL `sbrgb10w.csv` extends 390–830 nm (89 rows) vs old embedded 390–730 nm (69 rows) |
| `lens_density`, `macular_pigment`, `photopigment` | OK | Unchanged across refresh |

## Regression found and fixed

**Stockman & Sharpe LMS (2° and 10°)**

The gap-fill script briefly sourced `ss2deg_1nm.csv` / `ss10deg_1nm.csv` from:

- `https://files.cie.co.at/CIE_lms_cf_2deg.csv`

That CIE table is **5 nm** sampling (89 rows, λ 390–830), not 1 nm.

The committed baseline and CVRL `conerequest_ss2.php` / `conerequest_ss10.php` with
`Cone_steps=1` provide **441 rows at 1 nm**. Max numeric delta at overlapping λ was
~1×10⁻⁵ (rounding), but **352 wavelength samples were missing** — unsuitable for
evaluator benchmarking and tail analysis.

**Fix:** `download_datasets.py` now fetches SS LMS from CVRL 1 nm only. CIE LMS files
are not used for these paths.

## CIE vs CVRL for standard CMFs

| Dataset | CIE file | CVRL | Sampling | Recommendation |
|---------|----------|------|----------|----------------|
| CIE 1931 XYZ | `CIE_xyz_1931_2deg.csv` | `ciexyz31_1.csv` | Both 1 nm, 471 rows | Either; numerically identical (diff &lt; 1e⁻¹⁰). CIE preferred for provenance. |
| CIE 1964 XYZ | `CIE_xyz_1964_10deg.csv` | `ciexyz64_1.csv` | Both 1 nm | Either; byte-identical in practice. |
| SS LMS 2°/10° | `CIE_lms_cf_*.csv` | `conerequest_ss*.php` | **CIE 5 nm / CVRL 1 nm** | **CVRL only** |

## Stiles & Burch 10°

Old script embedded colour-science constants (69 points, 390–730 nm). Live CVRL
`sbrgb10w.csv` adds 390–830 nm at 5 nm (89 points). Values on the shared range match
the committed file. **Keep CVRL fetch.**

## Source policy in `download_datasets.py`

1. **CIE GET** — official CMFs, chromaticity loci, XYZ_F, V(λ), mesopic, MacLeod–Boynton.
2. **CVRL 1 nm** — Stockman & Sharpe LMS (`conerequest_ss*`).
3. **CVRL POST** — corrected CMFs, log-energy cones, Judd–Vos V(λ), S&B RGB, prereceptoral.
4. **CVRL Excel** — individual S&B observers (not normalized to CSV).

## New datasets (no prior baseline)

Added files (cone alternatives, loci, physiological XYZ_F, etc.) have no commit
`836ed18` comparison. They were verified at fetch time (HTTP 200, expected row counts).
No quality regression applies to those.
