---
'@k11k/strapi-plugin-better-blocks': patch
---

fix: consistent, always-visible scrollbar on toolbar dropdowns

The toolbar's block-type ("Text"), font-size and font-family pickers were built
on the design-system `SingleSelect`, which wraps its options in a Radix
ScrollArea. That produced an inconsistent, sometimes doubled scrollbar compared
to the `Menu`-based dropdowns (insert "+", alignment, line height).

These three pickers are now built on the same `Menu` component as the other
dropdowns, so every toolbar menu shares one scroll container and renders a
single, always-visible, theme-aware scrollbar that makes it clear the list can
be scrolled up and down.
