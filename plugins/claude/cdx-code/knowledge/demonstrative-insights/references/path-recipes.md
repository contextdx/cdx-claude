# Path Recipes

Three reusable, archetype-agnostic recipes for demonstrative paths. Each maps a graph signal → a path shape → a polarity. Pick nodes from `pack.degree` (ranked fan-in/fan-out) and ground every step pair on `pack.edges`; the worked examples use the React monorepo root board (`master`), but the heuristics apply to any board.

A note on the examples: they assume `scope.boards` has the target board aliased as `ovw`, and use short element keys (`recon`, `sched`, …) registered in `scope.elements`.

---

## Recipe 1 — Execution Journey (observation)

**Use for:** `feature-journey`, `how-does-it-work`, `onboarding-map`. The friendliest demo path: a single flow from where work enters to where it ends.

**Graph signal:** an entrypoint node (low inbound from internal nodes, or a renderer/controller/UI archetype) with a forward chain of outbound edges into an engine and then a leaf dependency.

**Shape:** linear, 3–5 steps, optionally one branch to an adapter/sibling the entrypoint also calls.

```
entrypoint ──▶ engine ──▶ scheduling/IO leaf
                └─(branch)─▶ adapter
```

**How to pick nodes:**
1. Entrypoint = the node a user action hits first.
2. Follow outbound edges to the component that does the real work (the engine).
3. Continue to the terminal dependency (a queue, scheduler, store, or external call) — the latency-sensitive hop.
4. If the entrypoint also calls an adapter/bindings layer, hang it off the entrypoint as a branch.

**Worked example (render pipeline):**
`react → react-dom` (branch → `react-dom-bindings`) `→ react-reconciler → scheduler`. Anchor a finding on the entrypoint (`react-dom`) and the latency hop (`scheduler`). Polarity: observation.

---

## Recipe 2 — Blast-Radius Cascade (risk)

**Use for:** `blast-radius`. The most dramatic shape — one failure fanning out across the system.

**Graph signal:** a **single point of failure** = highest fan-in node (many inbound edges) that is also synchronously depended upon. Often there's a deeper kernel one ring below it (a node the SPOF itself depends on).

**Shape:** root → SPOF hub with a wide `branches[]` fan-out (Ring 1 dependents) → continue the main line to one downstream degradation (Ring 2).

```
kernel ──▶ SPOF hub ──▶ primary dependent ──▶ downstream degradation
              ├─(branch)─▶ dependent A
              ├─(branch)─▶ dependent B
              └─(branch)─▶ dependent C …
```

**How to pick nodes:**
1. Scan `pack.degree` for the node with the highest `fanIn` (the rows are ranked by combined fan-in+fan-out, so the SPOF may not be row 1 — sort by `fanIn` yourself). That node is the SPOF hub; anchor a `critical` risk finding on it.
2. If the hub itself depends on a lower node (e.g. a shared kernel), make that the root (Ring 0) — anchor a second risk finding there.
3. Put all the hub's other dependents in `branches[]` (Ring 1) — one branch each, labelled with how they fail.
4. Continue the main line through one dependent to something it in turn affects (Ring 2 degradation).

**Worked example (reconciler cascade):**
`shared → react-reconciler` (branches: `react-art`, `react-native-renderer`, `react-test-renderer`, `react-noop-renderer`, `devtools`) `→ react-dom → server-components`. A second short path can show the *upstream* direction: `scheduler → react-reconciler` ("if the thing the engine depends on stalls, the engine freezes"). Polarity: risk.

---

## Recipe 3 — Hidden-Dependency Chokepoint (risk / observation)

**Use for:** `hidden-dependency`. Shows the unassuming node everything quietly runs through.

**Graph signal:** a node whose fan-in is disproportionate to its archetype — a "utility"/"shared"/"config" type with far more inbound edges than expected. Multiple independent callers reach the same node.

**Shape:** one caller → chokepoint, with `branches[]` to the *other* independent callers (fan-**in** visualised). Optionally a second, thin chain that ends at a universal hub.

```
caller ──▶ chokepoint
            ├─(branch)─▶ other caller A
            ├─(branch)─▶ other caller B
            └─(branch)─▶ other caller C
```

**How to pick nodes:**
1. Scan `pack.degree` for a node with anomalous `fanIn` for its type (a small/utility package with many dependents).
2. Make one dependent the main entry step, the chokepoint the second step (anchor the finding here), and the remaining dependents branches.
3. For a contrasting second path, trace a long thin chain (A → B → hub) into a node with the highest fan-in overall and branch out its dependents — the "universal hub" observation.

**Worked example (scheduler + shared + react):**
- `react-dom → scheduler` (branches: `react-art`, `react-native-renderer`, `react-reconciler`) — the tiny package on everyone's hot path.
- `react-dom-bindings → shared` (branches: `react-reconciler`, `server-components`) — the unpublished kernel.
- `use-subscription → use-sync-external-store → react` (branches: `react-cache`, `react-refresh`, `devtools`, `server-components`, `build-tooling`) — the universal peer hub.

Polarities: risk for the chokepoints, observation for the universal hub (expected coupling, worth noting not fixing).

---

## Combining recipes for a set

A strong 3-insight demo uses one of each: **Journey** (observation) + **Cascade** (risk) + **Chokepoint** (risk/observation). That spread gives the board a flow, a dramatic fan-out, and a coupling story — three different visual signatures and a balance of colour. Keep total nodes-in-paths roughly 6–11 per insight so each stays readable.
