# Contributing

Thanks for your interest in COLOR LAB. The active app lives in [`fe/`](fe/).

## Development setup

```sh
cd fe
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

## Before you open a pull request

Run both checks from `fe/`:

```sh
npm run check   # svelte-check / TypeScript
npm test        # vitest
```

CI runs the same commands on push (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Project layout

| Path | Role |
|------|------|
| `fe/src/lib/color/` | Pure color math (gamuts, Oklab, interpolation, CVD) |
| `fe/src/lib/engine/` | App state, camera, picking, theme ramp |
| `fe/src/lib/renderer/` | WebGL2 renderer and GLSL shaders |
| `fe/src/lib/documents/` | Named parameter-set persistence (`localStorage`) |
| `fe/src/lib/components/` | Svelte UI shell |
| `_docs/` | Design notes and implementation plans |

Data flows **`ExplorerState` + `Camera` → derived matrices → renderer / picking / theme**.
The GLSL solid shader and `picking.ts` must stay in sync when you change clipping or field math.

## Persistence changes

Parameter sets are the app document. If you add or remove a **persisted** field, follow the
workflow in [`fe/src/lib/documents/README.md`](fe/src/lib/documents/README.md) and
[`.cursor/rules/document-persistence.mdc`](.cursor/rules/document-persistence.mdc):

- Update `engine/types.ts`, `engine/state.svelte.ts`, `documents/snapshot.ts`, and `documents/schema.ts` together.
- Load path is always `parseSnapshot` — never assign raw `localStorage` JSON into live state.
- Add a `parse.test.ts` fixture when schema version or migration behavior changes.
- Bump `CURRENT_STATE_SCHEMA_VERSION` only for breaking renames or format changes.

## Pull request expectations

- Keep diffs focused; match existing naming and file structure.
- Prefer extending existing functions over parallel implementations.
- Update help copy or tutorial steps when user-visible behavior changes.
- Do not commit secrets (`.env`, API keys, tokens).
- Do not add `Co-Authored-By` agent trailers to commit messages.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
