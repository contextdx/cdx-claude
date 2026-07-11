---
name: ui-inspection
description: Interpret cdx-inspect sessions — screenshots, picked components, annotations — and turn them into precise code changes or intent language. Use when reading .contextdx/inspections/ manifests, after /inspect completes, or when component identity in a session needs improving. Covers the identity ladder, ui.page correlation, and adopting compile-time source attributes.
---

# UI Inspection Sessions

A cdx-inspect session (`.contextdx/inspections/<sessionId>/manifest.json`) is visual evidence:
what the user pointed at in the running app, with screenshots and structured identity. Your job
is judgment on top of it — mapping picks to code and drafting change language — never re-deriving
what the manifest already states.

## Reading a session

- `selections[]` — components the user clicked. Each has `cssSelector`, `xpath`, `ax`
  (accessibility role/name), `component` (name + optional source file/line + `identitySource`),
  a `note`, and a clipped `screenshot` (path relative to the session dir).
- `annotations[]` — boxes the user drew with a required note; `anchorSelector` is the element
  under the box center. The capture's `screenshot.composite` shows the boxes burned in.
- `captures[]` — one per page: `route`, clean `screenshot.full`, an `elementMap` JSON (visible
  elements with geometry + identity), and `pageAspectSlug`/`boardNodeSlug` when the route matched
  the local ui.pages extraction.

**Token discipline:** Read only the screenshots you need — selection clips over full pages, the
composite only when annotations matter. Never read every capture by default.

## Mapping a selection to code (in order)

1. `component.sourceFile` when present — it is exact (compile-time attribute).
2. `component.name` — Glob/Grep for the component definition (`function <Name>`, `const <Name>`,
   `<Name>.tsx`).
3. Correlated `pageAspectSlug` → the page's source files via the ui.pages extraction
   (`.contextdx/aspects/tmp/pages-payload.json`, `renderTree` sources).
4. Floor: `cssSelector` + `ax.name` — grep for the visible text/aria-label.

`component.identitySource` tells you how much to trust the identity — see
[references/component-identity.md](references/component-identity.md) for the ladder, why React
19 broke `_debugSource`-based tools, and how to offer `code-inspector-plugin` to the user's dev
config (the one channel that yields exact file:line everywhere). Offer it when sessions come
back with mostly `dom`/`react-fiber` identity and the user wants precise source mapping; never
add it unasked.

## Drafting intent language from a session

One session → one intent by default; suggest a split only when captures span multiple routes AND
the notes describe unrelated concerns. For the intent text:

- **Name:** the user's ask in imperative form ("Make the add-to-cart button prominent"), not the
  component name.
- **Description:** what was observed — route, component, note, verbatim where short.
- **Directive:** the change, referencing the component identity (`<AddToCartButton>` in
  `src/components/Hero.tsx`) and the evidence ("see selection 1 screenshot").
- **Anchors:** the capture's `pageAspectSlug` (aspect kind `ui.page`) or `boardNodeSlug` when
  correlated; otherwise the board node whose files contain the resolved component source.
