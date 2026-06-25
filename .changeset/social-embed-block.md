---
'@k11k/strapi-plugin-better-blocks': minor
---

feat: Social media embed block (Twitter/X, Instagram, Facebook, TikTok, LinkedIn, Pinterest)

Adds a dedicated **Social embed** block to the editor. Authors pick a platform and
paste a post URL; the plugin fetches the post's official embed server-side via a
new oEmbed proxy (`GET /better-blocks/oembed`) so no platform tokens ever reach
the browser. Responses are cached (configurable TTL). Supports per-embed caption,
alignment, and a manual embed-code override.

Configure enabled platforms and the Instagram/Facebook access tokens under
`config.social` in `config/plugins.{js,ts}`.
