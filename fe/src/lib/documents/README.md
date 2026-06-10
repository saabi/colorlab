# Parameter set persistence

Named parameter sets are the app **document**. They are stored in `localStorage` and loaded through the document bar.

## Purpose

A **parameter snapshot** (`ParameterSnapshot`) is the serializable subset of explorer state plus camera view:

- **Included:** all explorer controls, theme anchors/ramp params, camera pose
- **Excluded:** `hover`, `theme.arm`, `theme.stops` (runtime / derived)

## Architecture

Load path (never use `Object.assign` or `mergeSnapshot` on raw JSON):

```
raw JSON → detectSchemaVersion → migrateSnapshot → coerceSnapshot → ParameterSnapshot
```

Save path:

```
toSnapshot(explorer, camera) → coerceSnapshot (defensive) → localStorage
```

Modules:

| File | Role |
|------|------|
| `types.ts` | `CURRENT_SNAPSHOT_VERSION`, `ParameterSnapshot` |
| `snapshot.ts` | `toSnapshot`, `applySnapshot`, `defaultSnapshot` |
| `schema.ts` | Whitelist coerce + per-field validators |
| `migrate.ts` | Version chain (`migrateVNToVN+1`) |
| `parse.ts` | `parseSnapshot` orchestrator |
| `storage.ts` | Registry CRUD, eager rewrite after migration |

## Decision tree

1. **Does the change affect what is saved in a parameter set?** If no, stop.
2. **What kind of change?**
   - **New field with factory default** → Playbook A
   - **Remove field** → Playbook B
   - **Rename or reformat value** → Playbook C
   - **Registry wrapper change** → Playbook D

## Playbook A — New persisted field (non-breaking)

| Step | File | Action |
|------|------|--------|
| 1 | `engine/types.ts` / `camera.ts` | Add runtime field |
| 2 | `engine/state.svelte.ts` | Factory default |
| 3 | `snapshot.ts` `toSnapshot` | Explicit pick |
| 4 | `schema.ts` | Coerce pick + validator + default |
| 5 | `examples.ts` | Update stubs only if needed |
| 6 | `CURRENT_SNAPSHOT_VERSION` | **Do not bump** |
| 7 | `parse.test.ts` | Test: legacy JSON missing field gets default |

## Playbook B — Remove persisted field

| Step | File | Action |
|------|------|--------|
| 1 | `snapshot.ts` + `schema.ts` | Remove from both whitelists |
| 2 | `migrate.ts` | Only if old value maps to a replacement (then Playbook C) |
| 3 | `parse.test.ts` | Test: old save with removed field loads cleanly |

## Playbook C — Rename, restructure, or format change (breaking)

| Step | File | Action |
|------|------|--------|
| 1 | `types.ts` | Increment `CURRENT_SNAPSHOT_VERSION` |
| 2 | `migrate.ts` | Add `migrateVNToVN+1` + changelog comment |
| 3 | `schema.ts` + `snapshot.ts` | New shape |
| 4 | `parse.test.ts` | **Mandatory** fixture: raw vN in → current out |
| 5 | This README + `migrate.ts` header | One-line version entry |

## Playbook D — Registry envelope change (rare)

| Step | File | Action |
|------|------|--------|
| 1 | `storage.ts` | New key `colorlab:documents:vN`, `migrateRegistryV*` |
| 2 | `types.ts` | Extend `DocumentRegistry.version` |
| 3 | This README | Document migration policy |
| 4 | `parse.test.ts` | Registry fixture if non-trivial |

## File touch map

When adding a persisted field, update **together**:

- `engine/types.ts` (or `camera.ts`)
- `engine/state.svelte.ts`
- `documents/snapshot.ts` → `toSnapshot`
- `documents/schema.ts` → `coerceSnapshot`

**Sync rule:** every line in `toSnapshot` must have a matching coerce line in `schema.ts`.

## PR checklist

- [ ] Identified change type (A / B / C / D)
- [ ] Updated **both** `toSnapshot` and `schema.ts` coerce
- [ ] Did **not** use `Object.assign` / `mergeSnapshot` on raw loaded JSON
- [ ] Bumped `CURRENT_SNAPSHOT_VERSION` iff type C (or B with field mapping)
- [ ] Added `migrateVNToVN+1` when schema version bumped
- [ ] Added `parse.test.ts` fixture for previous schema version
- [ ] Updated `migrate.ts` version changelog comment
- [ ] `npm run check` passes
- [ ] `npm run test` passes

## Anti-patterns

- Adding a field to `ExplorerState` only — old saves won't get defaults; new saves won't persist it.
- Using `mergeSnapshot(defaultSnapshot(), raw)` on the **load** path — unknown keys leak into state.
- Bumping schema version for a purely additive field with a factory default.
- Skipping tests when bumping schema version.
- Persisting `hover`, `theme.arm`, or `theme.stops` without an explicit product decision.

## Schema version history

| Version | Summary |
|---------|---------|
| 0 | Legacy implicit saves (no `schemaVersion` field) |
| 1 | Current: explicit `schemaVersion` on `ParameterSnapshot` |

See `migrate.ts` header for authoritative changelog.

## How to add a test fixture

```ts
import { describe, it, expect } from 'vitest';
import { parseSnapshot } from './parse';

it('migrates vN field rename', () => {
  const legacy = { explorer: { /* old shape */ }, camera: { /* ... */ } };
  const result = parseSnapshot(legacy);
  expect(result.snapshot?.explorer.someField).toBe(expected);
});
```

Run: `npm run test`
