---
'@k11k/better-blocks-react-renderer': minor
---

feat: render the new `audio` block (Media Library + customizable HTML5 player)

Adds a default renderer for the Better Blocks `audio` node. Embeds audio from the
Strapi Media Library (or a raw URL) via a native `<audio>` element whose player
flags map 1:1 (`controls` defaulting to `true`, `autoplay`, `loop`, `preload`).
`file.url` is rendered as-is (already backend-prefixed, like `image`/`button`).

The player is wrapped in a `<figure className="bb-audio align-{alignment}">`
(alignment defaults to `center`; `none` = full-width). An optional `title` renders
above and an optional `caption` below, each in a `<figcaption>`. The `<audio>` gets
an `aria-label` (the title, falling back to `"Audio player"`) and, when a caption is
present, an `aria-describedby` pointing at it. Fallback text plus a download link
render inside `<audio>` for unsupported formats/browsers. Baseline appearance ships
as inline styles with stable `bb-audio*` classes for consumer overrides.

Override the built-in with the `blocks={{ audio: … }}` map. New exported types:
`AudioNode`, `AudioFile`, `AudioPlayer`, `AudioPreload`, `AudioAlignment`.
