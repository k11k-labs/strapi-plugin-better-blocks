---
'@k11k/strapi-plugin-better-blocks': minor
---

feat: WordPress-style Button block with full styling, link & file-download modes

Adds a new **Button** block (insert from the blocks selector, the `+` menu, or by typing `[button]`). Two modes:

- **Link** — URL, open-in-new-tab (auto `rel="noopener noreferrer"`), ARIA label.
- **File** — pick any Media Library asset to render a download button with optional file size and type icon.

A full-screen editor with live preview controls alignment, background/text colors (incl. hover), border radius, font size/weight, padding presets, a structured border (toggle + thickness + style + color), and a custom CSS class. Admins can set default button colors via `config/plugins` or per field. Stored as `{ "type": "button", "buttonType": "link" | "file", "label": "…", … }`.
