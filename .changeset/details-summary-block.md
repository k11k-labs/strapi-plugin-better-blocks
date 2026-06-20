---
'@k11k/strapi-plugin-better-blocks': minor
---

feat: add GitHub-style Details / Summary collapsible block

Adds a native collapsible `details` block to the editor. Insert it from the blocks selector or the `/details` slash command. Each block has a plain-text `summary` label, a `defaultOpen` toggle (maps to the HTML `open` attribute), and full rich-text block content as children (paragraphs, lists, tables, images, and even nested details). The editor preview renders a bordered/GitHub-style header with a disclosure triangle and animated expand/collapse.

Admins can set the default summary text and choose between a GitHub-minimal or bordered style — globally via `config/plugins.js` (`config.details.defaultSummary` / `config.details.style`), or per field in the Content-Type Builder (per-field overrides the global config).

JSON output:

```json
{ "type": "details", "summary": "Click to expand", "defaultOpen": false, "children": [ ... ] }
```
