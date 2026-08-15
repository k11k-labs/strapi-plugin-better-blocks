<h1 align="center">Better Blocks Core</h1>

<p align="center">The document format and shared logic behind the Better Blocks renderers.</p>

---

## What this is

`@qkix/better-blocks-core` holds everything about Better Blocks content that
does not depend on how it is displayed:

- **Document and block types** — the shape the Strapi plugin stores. Single
  source of truth for every renderer.
- **Attribute mapping** — alignment, line-height, indent, colours, background
  and font marks resolved to a neutral representation each renderer turns into
  its own markup.
- **Shared resolution rules** — code language → highlighter grammar, aspect
  ratio → CSS ratio, list nesting → list-style-type, file → icon and size.
- **Validation** — is this JSON actually a Better Blocks document?
- **Schema versioning and migrations** — bringing older documents forward.

## Validating a document

`validateDocument` checks the structure a renderer depends on: the node types
it dispatches over and the child shapes it walks into. It reports every problem
it finds, with a path, rather than stopping at the first.

```ts
import { validateDocument, isBlocksContent } from '@qkix/better-blocks-core';

const { valid, issues } = validateDocument(await res.json());
// issues: [{ path: '[2].children[0].text', message: 'text must be a string' }]

if (isBlocksContent(value)) {
  // narrowed to BlocksContent
}
```

It deliberately ignores attributes it does not know about: a newer plugin
adding one must not make a document invalid for an older renderer.

## Schema versions

Documents carry no version marker — the plugin has never written one, and
adding a field to content already in people's databases is not worth a version
number. The version is inferred from what a document contains instead.

| Version | What changed                                                                                                |
| ------- | ----------------------------------------------------------------------------------------------------------- |
| 1       | The original format. Media was a `media-embed` block — a URL renderers turned into a hardcoded 16:9 iframe. |
| 2       | `media-embed` was superseded by the richer `embed` and `video` blocks. Nothing inserts it any more.         |

```ts
import { migrateDocument } from '@qkix/better-blocks-core';

const { content, changed, skipped } = migrateDocument(document);
```

**Migrating is opt-in.** Both renderers still handle `media-embed`, so nothing
breaks if you never run it — this is for normalising stored content, say in a
Strapi migration or a one-off script. The input is never mutated, and blocks
that need no change are carried over by reference.

The migrated block renders the same frame, from the same source, at the same
aspect ratio. The wrapper markup differs, because an `embed` renders as a
`bb-embed` figure rather than the old bare div. A `media-embed` whose URL is
not `http(s)` is left alone and reported in `skipped` rather than guessed at.

## Zero runtime dependencies

By design. Nothing here imports React, Astro, Strapi or Slate, so any consumer
can depend on it without pulling a framework along.

## Who uses it

| Package                                                                 | Uses core for                                 |
| ----------------------------------------------------------------------- | --------------------------------------------- |
| [`@qkix/better-blocks-react-renderer`](../better-blocks-react-renderer) | types, marks, and the shared resolution rules |
| [`@qkix/better-blocks-astro-renderer`](../better-blocks-astro-renderer) | the same                                      |

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
