# Plan: Move the Pipeline into the Left Sidebar

Status: proposal + implementation plan.

## Problem (from `_docs/pipeline-ui-layout.png`)

Screenshot of the layout **before** Proposal A moved the pipeline into the left sidebar — the horizontal rail in the center column as implemented prior to that change.

The horizontal pipeline rail sits in the center column (`.pipeline-graph-region`: `grid-column: 2; grid-row: 2`), so it is only as wide as the viewport (screen − 280px left − 300px right) yet must fit **13 nodes across three lanes plus per-node status**. The result:

- Node text is unreadable; the rail `overflow-x: auto`s and still barely fits.
- It consumes a full horizontal band above the viewport, shrinking the 3D view.
- It largely duplicates the quick bar (Space/Gamut/Slice/Cylinder/Vision/Touch) that sits right below it.
- The rail is a *second* navigation surface competing with the left sidebar groups, which already list the same stages.

The rail's job (show the pipeline + navigate to a stage + at-a-glance status) is real, but a cramped horizontal strip is the wrong vehicle. The left sidebar is tall, scrollable, and already hosts the controls — it's the natural home for a pipeline read top-to-bottom.

## Goal

Make the **left sidebar itself the pipeline**: two pipeline lanes (Explorer, Ramp) plus a Support lane, each rendered as an ordered, numbered sequence of collapsible steps that visibly read as "stage 1 → stage 2 → …". Remove the top rail. Keep the quick bar as the high-frequency mirror. Reclaim the viewport band.

Design principles (carried from `pipeline-node-ui-proposal.md` revisions): `pipeline-nodes.ts` stays the single source of truth; each step shows an **affects** badge and a status; out-of-gamut and "what changed?" cues live on the step headers; ramp steps dim until a source color exists.

---

## Proposal A (primary — the requested layout)

**Lane-grouped accordion with numbered steps and a connector rail, in the left sidebar. Remove the top pipeline strip.**

The sidebar is divided into three labeled **lane bands**, each with a one-line purpose. Within a band, every step is a collapsible group whose header carries a step number, name, status chip, affects badge, optional OOG warning, and the `?` help button. A thin vertical line with a numbered marker per step runs down the band's left edge so the sequence reads as a flow.

```text
┌ LEFT SIDEBAR ───────────────────────────────┐
│ EXPLORER · what the 3D solid shows           │
│  ┌─┐                                         │
│  │1│■ Gamut            sRGB        Viewport ?│
│  └┬┘   (expanded controls…)                  │
│   │                                          │
│  ┌┴┐                                         │
│  │2│▸ World space      Oklab       Viewport ?│
│   │                                          │
│  ┌┴┐                                         │
│  │3│▸ Clip / cut       Slice       Viewport ?│
│   │                                          │
│  ┌┴┐                                         │
│  │4│▸ Vision           Normal    Display·prv ?│
│  ┌┴┐                                         │
│  │5│▸ Display aids      sRGB     Display·prv ?│
│                                              │
│ RAMP · how export tokens are generated       │
│  ┌─┐                                         │
│  │1│▸ Pick             Idle           Ramp  ?│
│  │2│▸ Anchors / points  A·B           Ramp  ?│
│  │3│▸ Interpolate      Spline    ⚠ 3 OOG    ?│
│  │4│▸ Adjust           4.5:1          Ramp  ?│
│  │5│▸ Gamut map        adaptive…    Export  ?│
│  │6│▸ Export           7 stops      Export  ?│
│                                              │
│ SUPPORT · view & rendering                   │
│  ▸ View                Camera      View·only?│
│  ▸ Performance         128/30fps   View·only?│
└──────────────────────────────────────────────┘
```

### How it reads as a pipeline

- **Lane bands** group by workflow and state their purpose in a subtitle, so users learn the two pipelines are separate (Explorer affects the solid; Ramp affects exported tokens).
- **Numbered step markers + a connector line** down the band's left edge make order explicit — the key request: GAMUT, WORLD SPACE, CLIPPING etc. are visibly "step 1, 2, 3 …", not a flat list.
- **Status chip** on each collapsed header (the old node status) keeps the at-a-glance dashboard value the rail provided.
- **Affects badge** (`Viewport` / `Ramp` / `Export` / `Display only` / `View only`) keeps the scope signal.
- The connector line + numbers stay visible even when a step is collapsed, so the whole pipeline is always scannable.

### Expansion model — independent, multi-open (not a single-select accordion)

Each step collapses/expands **independently**; any number of steps can be open at once. This is a hard requirement, not a nicety: a common workflow is to drag spline control points on the 3D viewport while keeping **Export** (the generated ramp preview) *and* **Gamut map** open so the ramp updates live as both the points and the mapping policy change. We must not auto-collapse other steps when one opens.

- Steps remember their own open state (each `ControlGroup` already owns it).
- Default-open set on first load is conservative (e.g. the active stage per lane, or all collapsed except the current edit target); the user can then open as many as they want and we persist that set in session UI state.
- Lane bands are themselves collapsible (to hide a whole pipeline), but collapsing a lane never discards the per-step open states inside it.

### What changes

| File | Change |
|------|--------|
| `AppShell.svelte` | Remove `<PipelineGraph>` and the `.pipeline-graph-region` wrapper; viewport spans `grid-row: 2 / 4`. Drop `selectedPipelineNode` routing (or repurpose to "focused step" for scroll-into-view). Keep `touchTool`. |
| `app.css` | Drop the `.pipeline-graph-region` row; change `.app-shell` to two body rows (`48px minmax(0,1fr)`); remove `.pipeline-graph*` rail styles; add `.lane-band`, `.pipeline-step`, numbered-marker + connector styles. |
| `LeftControls.svelte` | Stop gating by `selectedNode`. Iterate `PIPELINE_NODES` grouped by `lane` (skip `all`), render a lane band per group and a `ControlGroup` per step in order, passing step index/status/affects/warn/enabled. Always show all lanes (the old `All` view becomes the only view). |
| `ControlGroup.svelte` | Add optional `index`, `status`, `affects`, `warn`, `disabled` props; render the numbered marker, connector, status chip, affects badge, and OOG chip in the header. Keep `helpId`. |
| `pipeline-nodes.ts` | Unchanged as the source of truth (lane/label/affects/status/warn/requiresSource). The `all` node and `getPipelineNode` become unused by the sidebar; keep or drop. |
| `PipelineGraph.svelte`, `pipeline-nodes` status-pulse | Delete `PipelineGraph.svelte`. Move the "what changed?" pulse and OOG badge onto `ControlGroup` headers. |
| Help | Unchanged; each `ControlGroup` keeps its `pipeline*` help id. |
| Persistence | Optional: persist the set of expanded steps (or a single focused step) in **session** UI state, not the document. |

### Trade-offs

- **+** Readable, teaches the two pipelines, frees the viewport band, removes the duplicate navigation surface, reuses existing `ControlGroup`/help.
- **−** The sidebar gets taller; with everything expanded it scrolls. Mitigated by conservative default-collapsed state, collapsible lane bands, the always-visible numbered headers, and (Proposal B) the gutter — never by forcing a single open step. Loses the rail's "jump to any stage in one click from anywhere" — replaced by scroll + the optional gutter in Proposal B.

---

## Proposal B (recommended if quick navigation matters — A plus a vertical step gutter)

Everything in A, **plus a thin vertical gutter** pinned to the sidebar's left edge: one small numbered dot/icon per step, grouped by lane, acting as a table-of-contents. Hovering shows the step name; clicking scrolls the step into view and **expands it (additively — it never collapses the steps already open)**; the dot reflects status color and shows the OOG dot. The gutter is pure navigation over the multi-open panel of Proposal A — it is *not* a single-select tab switcher — so the live-editing workflow (Export + Gamut map open together while editing on the viewport) is preserved. It re-expresses the rail's *navigation + dashboard* value **vertically with no tiny horizontal text** — which is exactly what failed on the top bar.

```text
│ ┌──┐  EXPLORER · what the 3D solid shows
│ │①│  ┌─┐
│ │②│  │1│ Gamut         sRGB    Viewport ?
│ │③│  │2│ World space   Oklab   Viewport ?
│ │④│  …
│ │⑤│
│ ├──┤  RAMP · how tokens are generated
│ │①│  …
│ │⋮│
│ ├──┤  SUPPORT
│ │▸│
│ └──┘
```

### Why B may be better than A

- Preserves the one-click "go to any stage" the rail offered, without the unreadable horizontal text.
- Doubles as a compact always-visible pipeline overview and status/OOG dashboard while the main column shows one stage's controls.
- Scales to small heights: the gutter stays fixed while the panel scrolls.
- Keeps a true navigation affordance, so we can collapse most steps by default without burying them.

### Extra cost over A

- A new `PipelineGutter.svelte` (vertical, icon/number only), scroll-sync between gutter and step sections (IntersectionObserver to highlight the in-view step), and a slightly narrower content area (gutter ~28–32px).
- Accessibility: the gutter is a `nav` of in-page links/buttons (`aria-current` for the in-view step) — simpler and more honest than the previous tablist, since the panel now shows everything rather than swapping one tabpanel.

---

## Proposal C (lighter alternative — lane tabs)

Top of the sidebar gets three tabs (Explorer / Ramp / Support); selecting one shows that lane's ordered steps. Less scrolling per lane, and it keeps a tablist model. **Weaker for this goal:** it hides two of the three pipelines at a time, working against "show both pipelines as groups." Worth it only if sidebar height becomes a hard problem. Not recommended as primary.

---

## Recommendation

Ship **Proposal A** first (it is the requested layout and the smallest change: delete the rail, regroup the existing sidebar, restyle `ControlGroup`). Then add the **Proposal B gutter** as an enhancement if user testing shows people miss fast stage-jumping. A→B is incremental: B is purely additive over A. Avoid C unless vertical space proves insufficient.

## Implementation order (Proposal A)

1. `ControlGroup.svelte`: add `index` / `status` / `affects` / `warn` / `disabled` header props + numbered-marker, connector, status/affects/OOG chips; keep collapsible + help.
2. `LeftControls.svelte`: render three lane bands from `PIPELINE_NODES` (grouped, ordered), one `ControlGroup` per step; wire status/affects/warn/`requiresSource`→disabled + the source-missing hint; keep all existing control bodies.
3. `AppShell.svelte` + `app.css`: remove `<PipelineGraph>` / `.pipeline-graph-region`; let the viewport take the freed row; add lane/step styles; move the pulse + OOG cues onto `ControlGroup`.
4. Delete `PipelineGraph.svelte`; prune now-unused bits (`selectedPipelineNode`, the rail-only `getPipelineNode`/`all` node if unreferenced).
5. Decide expand/collapse defaults; optionally persist expanded steps in session UI state.
6. `npm run check`, `npm test`, `npm run build`; re-screenshot desktop + mobile drawer.

## Risks & mitigations

- **Sidebar too tall / heavy scrolling** — conservative default-collapsed state, collapsible lane bands, sticky lane headers, and (Proposal B) the gutter for jumping. Do **not** force single-open (breaks the live-editing workflow); persist whatever set the user opens.
- **Losing the rail's at-a-glance overview** — status chips on headers + (B) the gutter preserve it.
- **Mobile drawer length** — same lane bands stack vertically; the gutter (B) can pin to the drawer's top as a horizontal scroll-spy row only if needed, otherwise rely on accordion.
- **Accessibility regression** — the tablist/tabpanel model goes away; replace with standard disclosure groups (`aria-expanded` on each step header, already in `ControlGroup`) and, for B, an in-page nav with `aria-current`. Net simpler and more robust than the cramped tablist.

## UI-state & footer-policy persistence (added stage)

Persistence splits into three buckets by whether the value is part of the *shareable artifact* or a *per-device convenience*:

1. **Document (saved/shared snapshot):** scene state, including **`hideAids`** — it's a presentation choice of the artifact, so it stays document-persisted (already implemented).
2. **Session UI (localStorage, per-device, NOT in the document):** the **expanded/collapsed step set** — restore on load so working context survives reloads; never written to the saved document. (This is the previously-deferred item.)
3. **Not in the document:** the **auto-reduce tessellation policy** (`autoPerformance` + `minAverageFps`) — a runtime performance accommodation, irrelevant to a shared palette. Move it **out of the saved snapshot** into session UI state (per-device), so it's remembered locally but not exported.

Implementation notes:

- **Expanded-step persistence requires controlled open-state.** Today each `ControlGroup` owns `open` internally (with `defaultOpen`). To persist the set, lift open-state to the panel (the controlled-`open`/`onToggle` model that is currently in `stash@{0}` from Proposal B) and store the open ids in session localStorage (e.g. `colorlab:ui:open-steps`), restored on mount. Default-open set (Gamut/Pick/Interpolate) applies only when nothing is stored.
- **Removing auto-reduce from the document = Playbook B** (remove persisted fields): add `autoPerformance` / `minAverageFps` to the `PersistedExplorer` `Omit` (keep them on `ExplorerState` as runtime), drop them from `toPersistedExplorer` / `coerceExplorer` / the `coerceSnapshot` defaults block, and persist them in session UI state instead. Add a `parse.test.ts` fixture asserting a saved doc that contains them ignores them on load (and that omitting them is fine). No schema-version bump needed (removal with a runtime default is non-breaking on load).
- **`hideAids` is unchanged** — stays document-persisted.

Schedule: bundle with the sidebar work (it's UI-state, independent of the ramp pipeline stages). The expanded-step half pulls in the controlled-`open` refactor, so it pairs naturally with reviving Proposal B if/when that happens; the auto-reduce half can ship on its own.
