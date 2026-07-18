---
'@k11k/better-blocks-react-renderer': minor
---

feat: render the new `social-embed` block (Twitter/X, Instagram, Facebook, TikTok, LinkedIn, Pinterest)

Adds a default renderer for the Better Blocks `social-embed` node. Embed HTML is
chosen by priority: `embedCode` (manual override) → `oembed.html` → a graceful
fallback link card built from `oembed` (`thumbnailUrl` / `title` / `author`) when
neither is present. The embed is wrapped in a `<figure>` with an alignment class
(`social-embed align-{alignment}`, default `center`), an `aria-label` describing
the post, an optional `<figcaption>` caption, and `loading="lazy"` on any embed
`<iframe>`.

Platform widget scripts (Twitter, Instagram, TikTok, Pinterest, Facebook) are
loaded once per platform — deduped by URL and guarded against double-injection —
then their processor is re-run on mount so freshly-mounted embeds get upgraded
(LinkedIn renders a self-contained `<iframe>` and needs no script). Script
loading is client-only, keeping SSR/hydration consistent.

Override the built-in with the `blocks={{ 'social-embed': … }}` map. New exported
types: `SocialEmbedNode`, `SocialPlatform`, `SocialEmbedAlignment`,
`SocialEmbedOembed`.
