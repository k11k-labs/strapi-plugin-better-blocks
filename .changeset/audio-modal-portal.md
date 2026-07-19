---
'@k11k/strapi-plugin-better-blocks': patch
---

fix: typing in the audio editor no longer deletes the audio block

The audio editor was a hand-rolled overlay rendered inline inside the Slate
`Editable` tree, so every keystroke in its Title/Caption inputs also bubbled to
the editor's key handlers — which acted on the selected void node and removed
the block, taking the popup with it. The editor now uses the Strapi
`Modal` primitive (portalled out of the editable, like the Button and Social
embed editors), so form input stays in the form.

Fixes #70.
