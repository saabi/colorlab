# COLOR LAB — Gamut Explorer

A browser-based color science instrument for exploring RGB gamuts as interactive 3D solids, inspecting the full stimulus-to-display pipeline, and building perceptual theme ramps.

Orbit gamuts from sRGB through P3 and Rec.2020 in linear RGB, CIELAB, Oklab, and related spaces. Slice volumes on arbitrary planes, hover any point to trace it through transfer curves, cone fundamentals, and chromaticity diagrams, then export CSS or DTCG design tokens with optional WCAG contrast fitting.

Built with **SvelteKit 5**, **TypeScript**, and **WebGL2**. Parameter sets are saved in the browser; nothing is uploaded by default.

**Live site:** [colorlab.ferreyrapons.com](https://colorlab.ferreyrapons.com)

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

## Documentation

- [`_docs/design.md`](_docs/design.md) — architecture and color-pipeline design
- [`_docs/references.md`](_docs/references.md) — external references (CIE/ISO, IEC/ITU/SMPTE, CSS/DTCG, Oklab, CVD, non-Riemannian geometry)
- [`_docs/svelte-migration.md`](_docs/svelte-migration.md) — SvelteKit migration plan
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — development setup, tests, and merge request expectations
- [`RELEASING.md`](RELEASING.md) — semantic versioning and release checklist
- [`fe/src/lib/documents/README.md`](fe/src/lib/documents/README.md) — parameter-set persistence

## License

[MIT](LICENSE). See [THIRD_PARTY.md](THIRD_PARTY.md) for attributed third-party code.
