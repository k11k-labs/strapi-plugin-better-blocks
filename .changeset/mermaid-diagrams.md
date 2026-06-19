---
'@k11k/strapi-plugin-better-blocks': minor
---

Add block-level Mermaid diagram support. A new `diagram` block stores the raw
Mermaid definition (`{ type: 'diagram', format: 'mermaid', value }`) and renders
it to SVG with a live preview. Insert it from the blocks selector, the
`/mermaid` slash command, or by typing ` ```mermaid ` followed by a space. The
diagram theme follows Strapi's light/dark mode and Mermaid is loaded lazily so
it stays out of the main admin bundle.
</content>
</invoke>
