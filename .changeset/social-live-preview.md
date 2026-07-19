---
'@k11k/strapi-plugin-better-blocks': minor
---

Social embeds can now show the real post inside the editor. Each card gets a
**Show live post** toggle that swaps in the platform's script-free iframe embed
(X, Instagram, Facebook, TikTok, LinkedIn, Pinterest) — no widget JavaScript
runs in the admin, so the `script-src 'self'` CSP is untouched.

Third-party frames load only after that click, never on page load, and the
choice isn't persisted in the content. Add the platform hosts you use to
`frame-src` in `config/middlewares.ts` (see the README) — without them the card
still works, the frame just renders empty.
