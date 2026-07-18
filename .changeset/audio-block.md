---
'@k11k/strapi-plugin-better-blocks': minor
---

feat: audio block with Media Library integration and a customizable HTML5 player

Adds a new **Audio** block that lets authors embed audio directly inside the
Blocks field. Pick a file from the Strapi Media Library (upload included) or
paste a direct URL, then set a title, caption, alignment (left / center / right
/ none) and player behaviour — controls, autoplay, loop and preload
(none / metadata / auto). A native `<audio>` player renders inline in the editor
so authors can test playback before saving.

The block serialises to a stable JSON shape (`type: "audio"`, `file`, `title`,
`caption`, `player`, `alignment`) that frontend renderers turn into an HTML5
`<audio>` element — see issue #43 for the React and Astro renderer contract.

The playground now seeds a short sample audio file so the showcase article ships
with a working example.
