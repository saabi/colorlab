# Data Directory

Downloaded and generated color-science datasets live here.

Run `python3 data/download_datasets.py` then `python3 data/process_datasets.py` from the
repo root to refresh sources (42 CSV + 2 Excel in `data/raw/`).

Verify against committed baseline and alternate hosts:

```bash
python3 data/verify_sources.py
```

See `data/reports/source-verification.md` for the latest audit.

Rules:

- Keep raw downloaded source files under `data/raw/`.
- Keep normalized/generated tables under `data/processed/`.
- Keep fit/audit reports under `data/reports/`.
- Do not commit restricted or unclearly licensed raw datasets.
- Every committed dataset must have provenance, license, source URL, checksum,
  wavelength range, sampling interval, normalization, and generation notes
  documented in `_docs/spectral-dataset-catalog.md`.
- Verified download URLs and a comparison with files in this directory live in
  `_docs/spectral-dataset-sources.md`.

This directory is intended for observer datasets, LMS fundamentals, CMFs, XYZ
spaces, spectral locus tables/curves/surfaces, chromaticity diagrams, luminous
efficiency functions, analytical-fit audit data, and derived comparison reports.
