# Releasing

COLOR LAB uses [Semantic Versioning 2.0.0](https://semver.org/) for **application releases**.

The canonical version string is **`fe/package.json`** → `"version"`. Git tags use a `v` prefix: `v1.2.3`.

## Version bumps

| Level | When |
|-------|------|
| **MAJOR** | Breaking change for users: saved documents that cannot be migrated, removed export format, or user-visible behavior that breaks existing workflows |
| **MINOR** | New backward-compatible capability: feature, gamut/space, export option, tutorial track, additive persisted field (with migration when needed) |
| **PATCH** | Backward-compatible fix: bug fix, copy, performance, visual polish |

While the version is `0.x.y`, treat MINOR as potentially breaking; prefer PATCH for fixes only. Ship **1.0.0** when the public surface and document format are stable.

## Not the app version

These are separate from semver releases:

| Version | Location | Purpose |
|---------|----------|---------|
| Document schema | `CURRENT_STATE_SCHEMA_VERSION` in `fe/src/lib/documents/` | Breaking changes to saved parameter sets — see [`fe/src/lib/documents/README.md`](fe/src/lib/documents/README.md) |
| Registry layout | `DocumentRegistry.version` in `storage.ts` | `localStorage` registry envelope |

Do not tie document-schema bumps to app semver automatically.

## Release checklist

1. Ensure `main` is green (`npm run check` and `npm test` in `fe/`).
2. Bump `fe/package.json` `"version"`.
3. Update `fe/package-lock.json` if needed (`npm install` in `fe/`).
4. Commit: `chore: release vX.Y.Z` (note user-facing changes in the body).
5. Tag: `git tag vX.Y.Z`
6. Push branch and tag to remotes:

```sh
git push github main --tags
git push gitlab main --tags
```

7. Deploy production build if applicable (`npm run build` in `fe/`, then your usual host process).

## Changelog

There is no `CHANGELOG.md` yet. Until one exists, put release notes in the release commit message or GitHub/GitLab release description.
