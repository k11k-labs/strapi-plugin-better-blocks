# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets).

To add a changeset, run `npx changeset` and follow the prompts, or create a markdown file manually:

```md
---
'@k11k/strapi-plugin-better-blocks': patch
---

Description of the change.
```

Valid bump types: `patch`, `minor`, `major`.
