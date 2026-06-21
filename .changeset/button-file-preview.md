---
'@k11k/strapi-plugin-better-blocks': minor
---

feat: Button (file mode) preview-vs-download toggle

Adds a `filePreview` option to file-download buttons. When enabled the file
opens in a new tab (preview); when disabled it downloads directly. Exposed as a
"Preview file instead of downloading" checkbox in the button editor and stored as
`filePreview` on the block, so the frontend renderers can map it to
`target="_blank"` vs `download`. Closes #57.
