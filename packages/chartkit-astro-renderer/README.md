# @qkix/chartkit-astro-renderer

Astro renderer for [Chartkit](https://www.npmjs.com/package/@qkix/chartkit-core) charts. **Zero client-side
JavaScript** - an Astro page with a chart on it ships exactly as much script as
one without.

```bash
npm install @qkix/chartkit-astro-renderer
```

## A chart on its own

```astro
---
import { Chart } from '@qkix/chartkit-astro-renderer';
---

<Chart spec={spec} locale="en-US" />
```

| Prop       |                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------ |
| `spec`     | the chart                                                                                  |
| `locale`   | number formatting, worth passing explicitly when building on a server                      |
| `idPrefix` | prefix for the ids the accessible name points at - needed when a page holds several charts |
| `class`    | class on the wrapping element                                                              |

A spec that will not draw renders **nothing**, the same as any other broken
content. A half-drawn chart would look like real data.

## A chart inside a Better Blocks document

```astro
---
import { BlocksRenderer } from '@qkix/better-blocks-astro-renderer';
import { chartBlockPlugin } from '@qkix/chartkit-astro-renderer';
---

<BlocksRenderer content={content} blockPlugins={[chartBlockPlugin]} />
```

Neither package knows the other's internals. Leave the plugin out and the chart
is not drawn, while the rest of the document renders normally - content is never
lost by a front end that has not been taught about charts.

Unlike the React plugin this is a constant rather than a factory: an Astro
component reads what it needs from its own props, so there is nothing to close
over.

## License

MIT
