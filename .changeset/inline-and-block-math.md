---
'@k11k/strapi-plugin-better-blocks': minor
---

Add inline and block math (LaTeX / KaTeX) to the editor. Math is stored as a void `math` node (`{ type: 'math', format: 'inline' | 'block', value }`) and rendered with KaTeX in the editor preview. Insert block math from the blocks selector, the `/math` slash command, or by typing `$$ `; insert inline math from the toolbar Σ button or by typing `$…$ `. Clicking a formula opens a popover with a LaTeX input and live preview.
