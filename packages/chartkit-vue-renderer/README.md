# @qkix/chartkit-vue-renderer

Vue 3 renderer for [Chartkit](https://www.npmjs.com/package/@qkix/chartkit-core)
charts. The chart is an **SVG built on the server** - a page with a chart on it
ships exactly as much chart library as a page without one: none.

```bash
npm install @qkix/chartkit-vue-renderer
```

Works in Nuxt (server-rendered, nothing to hydrate) and in any plain Vue 3 app.

## A chart on its own

```vue
<script setup lang="ts">
import { Chart, type ChartSpec } from '@qkix/chartkit-vue-renderer';

defineProps<{ spec: ChartSpec }>();
</script>

<template>
  <Chart :spec="spec" locale="en-US" />
</template>
```

| Prop        |                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------ |
| `spec`      | the chart                                                                                  |
| `locale`    | number formatting, worth passing explicitly when building on a server                      |
| `id-prefix` | prefix for the ids the accessible name points at - needed when a page holds several charts |

`class`, `style` and any other attribute you put on `<Chart>` land on the
wrapping element.

A spec that will not draw renders **nothing**, the same as any other broken
content. A half-drawn chart would look like real data.

## A chart inside a Better Blocks document

```vue
<script setup lang="ts">
import { BlocksRenderer } from '@qkix/better-blocks-vue-renderer';
import { chartBlockPlugin } from '@qkix/chartkit-vue-renderer';

defineProps<{ content: unknown }>();
</script>

<template>
  <BlocksRenderer :content="content" :block-plugins="[chartBlockPlugin]" />
</template>
```

Neither package knows the other's internals. Leave the plugin out and the chart
is not drawn, while the rest of the document renders normally - content is never
lost by a front end that has not been taught about charts.

Unlike the React plugin this is a constant rather than a factory: a Vue
component reads what it needs from its own props, so there is nothing to close
over.

Charts in one document get distinct id prefixes derived from their title, so
their accessible names never collide.

## License

MIT
