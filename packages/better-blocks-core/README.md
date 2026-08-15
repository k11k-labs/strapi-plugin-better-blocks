<h1 align="center">Better Blocks Core</h1>

<p align="center">The document format and shared logic behind the Better Blocks renderers.</p>

---

## What this is

`@k11k/better-blocks-core` holds everything about Better Blocks content that
does not depend on how it is displayed:

- **Document and block types** — the shape the Strapi plugin stores. Single
  source of truth for every renderer.
- **Attribute mapping** — alignment, line-height, indent, colours, background
  and font marks resolved to a neutral representation each renderer turns into
  its own markup.
- **Shared resolution rules** — code language → highlighter grammar, aspect
  ratio → CSS ratio, list nesting → list-style-type, file → icon and size.

## Zero runtime dependencies

By design. Nothing here imports React, Astro, Strapi or Slate, so any consumer
can depend on it without pulling a framework along.

## Who uses it

| Package                                                                 | Uses core for                                 |
| ----------------------------------------------------------------------- | --------------------------------------------- |
| [`@k11k/better-blocks-react-renderer`](../better-blocks-react-renderer) | types, marks, and the shared resolution rules |
| [`@k11k/better-blocks-astro-renderer`](../better-blocks-astro-renderer) | the same                                      |

Both renderers re-export the document types, so consumers keep importing
`BlocksContent` from the renderer they already use.

## Why it exists

The two renderers each carried their own copy of these types and helpers, kept
in sync by hand. They had already drifted — `VideoNode.provider` was required in
one and optional in the other, `embedHtml` likewise in the opposite direction,
and `VideoFile.url` existed in only one of them. Adding a block attribute meant
three edits instead of one.

## Rendering stays out

Turning a block into markup belongs to the renderers, and so do their
presentation dependencies — `katex`, `mermaid` and `shiki` are not here.

The Strapi plugin's editor types are not here either: they extend Slate's
`BaseElement`, and describe the editor's working state rather than the stored
document.

## License

[MIT](../../LICENSE)
