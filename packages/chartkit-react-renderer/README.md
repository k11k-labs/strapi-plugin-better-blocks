# @qkix/chartkit-react-renderer

React renderer for [Chartkit](../chartkit-core) charts. A `ChartSpec` in, an SVG
on the page, and **nothing for the browser to run**.

```bash
npm install @qkix/chartkit-react-renderer
```

## A chart on its own

```tsx
import { Chart } from '@qkix/chartkit-react-renderer';

<Chart spec={spec} locale="en-US" />;
```

| Prop        |                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `spec`      | the chart                                                                                                        |
| `locale`    | number formatting. Worth passing on a server, where the runtime default is whatever the container was built with |
| `idPrefix`  | prefix for the ids the accessible name points at — needed when a page holds several charts                       |
| `className` | class on the wrapping element                                                                                    |
| `fallback`  | rendered instead of the chart when the spec will not draw                                                        |

Without a `fallback`, an invalid spec renders **nothing**. That is deliberate: a
half-drawn chart looks like real data, which is worse than an absence. The
`fallback` receives the same issues `validateChartSpec` reports, with paths.

## A chart inside a Better Blocks document

Chartkit registers itself as a Better Blocks block type, so a chart authored in
the editor draws wherever the document does:

```tsx
import { BlocksRenderer } from '@qkix/better-blocks-react-renderer';
import { chartBlockPlugin } from '@qkix/chartkit-react-renderer';

<BlocksRenderer content={content} blockPlugins={[chartBlockPlugin({ locale: 'en-US' })]} />;
```

Neither package knows the other's internals. Better Blocks knows a block type
called `chart` exists, that it is a void, and that Chartkit can validate and
migrate it; Chartkit knows nothing about rich-text documents at all.

**Leave the plugin out and the chart simply is not drawn** — the rest of the
document renders normally. Content authored with a chart is never lost by a
front end that has not been taught about charts yet.

## No client-side JavaScript

The chart is an SVG string produced by `@qkix/chartkit-core` and handed to
React. There is no chart runtime in the bundle, nothing to hydrate, and no
`useEffect` waiting to run. A page with ten charts downloads exactly as much
JavaScript as a page with none.

## License

MIT
