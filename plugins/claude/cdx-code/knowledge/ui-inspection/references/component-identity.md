# Component identity — the resolution ladder

Every selection records `component.identitySource`, the rung that produced its identity. From
strongest to weakest:

| `identitySource` | What it means | Trust |
| --- | --- | --- |
| `data-attribute` | A compile-time source attribute was found on the element or an ancestor (`data-insp-path`, `data-inspector-relative-path`, `data-locatorjs-id`, `data-source-loc`). `sourceFile`/`sourceLine` are exact. | Highest — file:line is authoritative |
| `react-fiber` | Component displayName read from the React fiber tree. Works on React 16–19 **dev builds**; production builds yield minified names (`t`, `xy`). No file path. | Name reliable in dev; grep to locate the file |
| `vue` | Component name from `__vueParentComponent` (Vue 3) or `__vue__` (Vue 2). Dev builds. | Same as react-fiber |
| `dom` | Floor: selector + XPath + accessibility role/name only. Always captured. | Identity from selector/text — locate by grep on `ax.name` or visible text |

## Why file:line needs a compile-time channel

React 19 **removed `_debugSource`** (facebook/react #31981, #32574) — every fiber-based
click-to-source tool broke, with no official replacement. The surviving channel is build-time
DOM attribute injection, which also works in Vue/Svelte/Solid and is framework-version-proof.

## Offering code-inspector-plugin to the user

When sessions come back mostly `dom`/`react-fiber` and the user wants exact source mapping,
offer to add [code-inspector-plugin](https://inspector.fe-dev.cn/en/guide/start.html) to their
**dev** config (never production). It stamps `data-insp-path="<file>:<line>:<col>:<name>"` on
rendered DOM, which cdx-inspect picks up automatically as the `data-attribute` rung.

Vite example (`vite.config.ts`):

```ts
import { codeInspectorPlugin } from "code-inspector-plugin";

export default defineConfig({
  plugins: [
    codeInspectorPlugin({ bundler: "vite", dev: true }),
    // ...existing plugins
  ],
});
```

Webpack/Next/rspack/esbuild variants exist under the same package — follow its docs for the
user's bundler. `npm i -D code-inspector-plugin` first. It is dev-only instrumentation; confirm
with the user before touching their build config, and keep the change minimal.

LocatorJS data-id mode (`@locator/babel-jsx`, attribute `data-locatorjs-id`) is an equivalent
alternative if the project already uses it — cdx-inspect reads both.
