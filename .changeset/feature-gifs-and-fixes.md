---
'@k11k/strapi-plugin-better-blocks': patch
---

Fix image caption editing (native `beforeinput`/`input`/`keydown` events now stopPropagation past Slate's Editable, so typing, backspace and enter work inside the caption). Fix emoji picker search (filter now matches against per-emoji keywords instead of always returning true). Add per-feature demo GIFs to documentation.
