---
'@k11k/strapi-plugin-better-blocks': minor
---

Rework the Math (LaTeX) and Diagram (Mermaid) editors to fix the broken edit menus and improve usability.

The previous anchored popover overflowed with long sources and was dismissed on page scroll, discarding unsaved edits. Both editors now open in a shared, near full-screen modal with a side-by-side source editor and live preview that fill the available height. The diagram/math preview can be zoomed in/out (with a reset) and is centered, so diagrams are no longer rendered too small to read, and the larger LaTeX preview keeps integrals and fractions legible.
