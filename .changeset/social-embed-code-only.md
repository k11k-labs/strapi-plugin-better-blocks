---
'@k11k/strapi-plugin-better-blocks': patch
---

Fix social embeds that rely on a pasted embed code, and stop TikTok/Pinterest
posts from degrading to a bare link on the frontend.

- **Embed code alone is now enough** — Save is enabled when either a post URL or
  an embed code is present, so platforms without a tokenless oEmbed (Instagram,
  Facebook) can be embedded by pasting their snippet. Pasting a snippet also
  recovers the permalink from it (`data-instgrm-permalink`, `cite`, `href`) and
  auto-detects the platform.
- **Widget scripts are stripped** from both fetched oEmbed markup and pasted
  embed codes. A `<script>` injected via `innerHTML` never executes, and its
  inert tag made renderers believe the platform widget was already loaded — the
  cause of TikTok posts rendering as a raw blockquote of links.
- **Failed oEmbed lookups now surface an error** instead of silently storing an
  empty payload. Pinterest answers HTTP 200 with `{"error": …}` for unresolvable
  pins, which previously saved an embed with no markup that rendered as a
  "View on Pinterest" fallback card.
- **`pin.it` short links are resolved** to their canonical `/pin/<id>/` URL
  before the Pinterest oEmbed request, which rejects short links.
