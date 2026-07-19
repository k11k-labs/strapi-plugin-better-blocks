---
'@k11k/strapi-plugin-better-blocks': minor
---

feat: generic Embed block and provider-aware Video block (closes #44)

**Embed block** — insert any third-party embed from the `+` Insert menu, the
`/embed` slash command, or the toolbar's media button. Two modes: **URL**
(YouTube, Vimeo, Loom, Wistia, Dailymotion and api.video are converted to an
iframe automatically) and **Embed code** (paste any platform's `<iframe>`).
Pasted markup is never stored verbatim — the iframe is rebuilt from an attribute
allowlist over an https-only `src`, so `<script>`, event handlers, inline styles
and unknown attributes cannot reach your frontend, and the `allow` attribute is
filtered to a safe permission set. Adds live in-editor preview, aspect ratio
(16:9 / 21:9 / 4:3 / 1:1 / custom), alignment, caption and an accessible title.

**Video block** — source a video from the Media Library, a direct URL, or a
hosting provider. Mux, api.video and Cloudinary URLs are detected automatically,
and a bare Mux playback ID fills in the stream URL and poster frame. When
`strapi-plugin-mux-video-uploader` is installed and configured, a **Mux** button
lists and searches your Mux assets inline with thumbnails (assets with a signed
playback policy are not selectable, since they need a per-request JWT that a
stored token could not satisfy). Supports poster image, title, caption, WebVTT
captions/transcript, alignment, aspect ratio and player settings.

The YouTube/Vimeo-only `media-embed` block is **deprecated**: nothing inserts it
any more and the toolbar media button now creates an `embed` node instead, but
existing `media-embed` content still renders, and renderers should keep handling
it.

Both blocks' JSON shapes are documented in the README for frontend renderers,
along with the `frame-src` / `img-src` / `media-src` CSP hosts they need.
