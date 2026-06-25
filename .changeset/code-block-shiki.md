---
'@k11k/strapi-plugin-better-blocks': minor
---

feat: Shiki syntax highlighting in the editor code block

Code blocks in the editor now render with Shiki syntax highlighting that follows
the admin's light/dark theme. The language selector is no longer hidden — it is
an always-visible, colored pill in the top-right corner of the block — and the
code block has a distinct background so it stands out from surrounding text.
Grammars load on demand; `plaintext` renders without highlighting.
