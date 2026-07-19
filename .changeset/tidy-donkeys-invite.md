---
'@k11k/better-blocks-react-renderer': minor
---

Render the new `embed` and `video` blocks

`embed` renders the plugin-sanitized `embedHtml` inside an alignment container and a CSS `aspect-ratio` box, with `caption` as a `<figcaption>` and a plain-link fallback when the source was cleared. Override the `embed` block to receive the parsed parts (`embedSrc`, `provider`, `thumbnail`, …) instead of the stored HTML.

`video` renders a native HTML5 player for direct file URLs, mapping the nested `player` flags 1:1 and adding a `<track kind="captions">` for `transcript`. HLS/DASH sources are upgraded opportunistically with no new dependency: `provider: "mux"` nodes render `<mux-player>` when that custom element is registered, `.m3u8` sources attach `hls.js` when it is exposed as `window.Hls`, and otherwise playback falls back to the native element (Safari) or the `poster`.

The deprecated `media-embed` block keeps rendering as before, so existing documents are unaffected.
