---
'@k11k/strapi-plugin-better-blocks': minor
---

Add GitHub-style callout / admonition blocks. A new `callout` block holds
nested rich-text content (`{ type: 'callout', variant, title?, children }`) in
five variants — note, tip, important, warning, and caution — with an optional
custom title. Insert it from the blocks selector or the `/note`, `/tip`,
`/important`, `/warning`, `/caution` slash commands, and switch variant, edit
the title, or dissolve the callout from the header popover. Variant colors use
Strapi's design tokens so they adapt to light and dark mode.
