---
'@k11k/strapi-plugin-better-blocks': minor
---

feat: Button block style presets (Primary, Secondary, Outline, Filled)

Adds a **Style preset** picker to the Button editor so authors can apply on-brand
variants (Primary / Secondary / Outline / Filled) in one click. Editing any color
or the border switches the selection to **Custom**. Presets are configurable per
project via `config/plugins` (`better-blocks.button.presets`); the selected preset
is stored as `style.variant`. Closes #54.
