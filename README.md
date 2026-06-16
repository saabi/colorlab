# COLOR LAB — Gamut Explorer

A browser-based color science instrument for exploring RGB gamuts as interactive 3D solids, inspecting the full stimulus-to-display pipeline, and building perceptual theme ramps.

Orbit gamuts from sRGB through P3 and Rec.2020 in linear RGB, CIELAB, Oklab, and related spaces. Slice volumes on arbitrary planes, hover any point to trace it through transfer curves, cone fundamentals, and chromaticity diagrams, then export CSS or DTCG design tokens with optional WCAG contrast fitting.

Built with **SvelteKit 5**, **TypeScript**, and **WebGL2**. Parameter sets are saved in the browser; nothing is uploaded by default.

**Live site:** [colorlab.ferreyrapons.com](https://colorlab.ferreyrapons.com)

![COLOR LAB — 3D gamut explorer with pipeline controls and inspector panels](_docs/pipeline-ui-layout-1.png)

**Author:** [Sebastian Ferreyra Pons](https://ferreyrapons.com)

## Repository layout

| Path | Description |
|------|-------------|
| [`fe/`](fe/) | SvelteKit application (active codebase) |
| [`_docs/`](_docs/) | Design notes, migration plans, and prototype artifacts |

The legacy Sapper/Rollup prototype (`fe.old/`) was removed from the main branch; it remains in git history before the open-source cleanup.

## Quick start

```sh
cd fe
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

For build, deploy, environment variables, and project structure, see [`fe/README.md`](fe/README.md).

## Beta limitations

Color Lab is **pre-release beta** software (see [`_docs/v1-release-criteria.md`](_docs/v1-release-criteria.md)). The core workflows are usable, but note:

| Area | Status |
|------|--------|
| **WebGL2** | Required — no canvas/CPU fallback. Unsupported browsers will not render the 3D solid. |
| **Ramp gamut map** | The terminal gamut-map step targets the **active colorspace** (sRGB by default). The analytic mapper is sRGB-specific; mapping to other active gamuts is planned but not yet implemented. |
| **Non-D65 gamuts** | Bradford chromatic adaptation to the D65 interchange white (NTSC / Illuminant C, CIE 1931 RGB / Illuminant E). D65 gamuts unchanged. |
| **Display gamut** | Assumed to be an sRGB-compliant monitor. Custom display primaries and calibration are planned for a future release. |

## Documentation

- [`CHANGELOG.md`](CHANGELOG.md) — release history (linked in the live app)
- [`_docs/Roadmap.md`](_docs/Roadmap.md) — current priorities and open work
- [`_docs/v1-release-criteria.md`](_docs/v1-release-criteria.md) — Beta → RC → 1.0.0 release gates and task checklist
- [`_docs/design.md`](_docs/design.md) — architecture and color-pipeline design
- [`_docs/references.md`](_docs/references.md) — external references (CIE/ISO, IEC/ITU/SMPTE, CSS/DTCG, Oklab, CVD, non-Riemannian geometry)
- [`_docs/svelte-migration.md`](_docs/svelte-migration.md) — SvelteKit migration plan
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — development setup, tests, and merge request expectations
- [`RELEASING.md`](RELEASING.md) — semantic versioning and release checklist
- [`fe/src/lib/documents/README.md`](fe/src/lib/documents/README.md) — parameter-set persistence

## License

[MIT](LICENSE). See [THIRD_PARTY.md](THIRD_PARTY.md) for attributed third-party code.
