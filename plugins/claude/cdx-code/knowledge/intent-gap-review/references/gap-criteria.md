# Blocking gap criteria & note examples

## What counts as a blocking gap

Classify the intent as **blocking** — do not implement, take it to the user — when **any** of these hold:

1. **Anchor files or elements are gone.** An anchor points to a file, node, or edge that no longer exists, and no clear successor is identifiable. (A file that was merely *moved* and is unambiguously the same thing is a nit, not a gap.)
2. **The intent is stale.** `stale: true` — the server detected the anchor facts drifted from the baseline the architect authored against. Staleness alone is blocking unless the drift is provably irrelevant to this change.
3. **The directive references components that don't exist.** It instructs you to modify/extend something the code doesn't contain (a service, endpoint, table, or module that was never built or was removed).
4. **A `board_diff` suggestion is inapplicable.** An `add` for something already present in a conflicting shape, a `remove` of something that isn't there, or a `modify` of an element that no longer matches the suggestion's premise.
5. **An attachment contradicts the code.** A spec image/PDF/file describes a shape (schema, API surface, flow) that the current code plainly no longer follows.
6. **Most anchors are unresolved.** More than ~half of the intent's anchors fail to resolve to real code — the intent's frame of reference has moved out from under it.

If none of these hold and the only differences are cosmetic or trivially bridgeable, it is `minor` (implement) — not blocking.

## Drafting the bounce-back note

Structure (≤1800 chars):

```
<one-line reason this can't be implemented as written>

- expected: <what the intent assumed>  →  found: <what the code shows>
- expected: <…>  →  found: <…>

Decision needed: <what the architect must change or confirm>
```

### Example — anchor removed

```
Intent targets PaymentService, but that service was removed in the payments refactor.

- expected: PaymentService.charge() anchored on node `payment-service`  →  found: node gone; billing now lives in `billing-gateway` with a different interface
- expected: directive "add retry to charge()"  →  found: no charge() method exists anywhere

Decision needed: re-anchor this intent to billing-gateway (and confirm the retry belongs on its `capture()` path), or confirm PaymentService should be reintroduced.
```

### Example — board_diff inapplicable

```
The proposed "remove edge webhook-dispatcher → legacy-queue" no longer applies.

- expected: edge webhook-dispatcher → legacy-queue exists to be removed  →  found: that edge was already deleted; dispatcher now writes to `event-bus`
- expected: directive assumes legacy-queue is still wired  →  found: legacy-queue module deleted

Decision needed: confirm this intent is already satisfied (I can resolve it as resolved_other), or repoint it at the new event-bus path if a different change is wanted.
```

Keep it specific: name the elements, quote the assumption, state the found reality. Vague notes ("this doesn't match") force another round-trip.
