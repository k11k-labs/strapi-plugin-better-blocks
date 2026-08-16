# Rewind

Document version history for Strapi 5. Every save is snapshotted, and any
snapshot can be put back.

## What this is, and what it is not

Strapi sells a feature called **Content History** on its Growth and Enterprise
plans. Rewind is **not that feature**, is not a drop-in replacement for it, and
does not unlock it.

It is the poor cousin. If you pay for Growth, use Strapi's — it is deeper, it is
supported by the people who wrote the CMS, and it will stay in step with Strapi
in a way a third-party plugin cannot promise. Rewind exists for everyone on
Community Edition, who today has nothing at all: no way to see what a document
said last Tuesday, and no way to get it back after someone pastes over it.

A few things it does that the paid feature does not, mostly because they were
cheap to add once the plumbing existed:

- **Restoring keeps fields that were added after the version was taken.**
  Strapi's restore sets them to `null`, which quietly loses whatever was in
  them.
- **Discarding a draft is recorded before the draft is gone**, so the work you
  threw away is still recoverable. A snapshot taken afterwards can only ever
  contain the published copy you already had.
- **A save that changed nothing does not create a version.** Strapi writes a row
  either way.
- **The schema snapshot descends into nested components.** Strapi's stops one
  level down and carries an open TODO about it.
- **Writes from outside the Content Manager can be versioned** (opt-in), where
  Strapi only ever records admin-panel edits.

And a good deal it does _not_ do — see [Limits](#limits).

### On not touching the paywall

Rewind never reads or writes `strapi.ee`, never inspects a licence, and never
enables a gated feature. It is an independent implementation writing to its own
table, and it works the same whether or not you have a Strapi licence. Strapi's
history code is MIT-licensed and was read while working out what the problem
actually is — the way you would read any open-source implementation before
writing your own — but the code here is written for this plugin.

## Install

```bash
npm install @qkix/strapi-plugin-rewind
```

```ts
// config/plugins.ts
export default {
  rewind: {
    enabled: true,
    config: {
      // Nothing is tracked until you say so.
      contentTypes: ['api::article.article'],
    },
  },
};
```

That empty default is deliberate. A plugin that starts writing a database row on
every save the moment it is installed is a plugin that gets uninstalled after
the first disk alert.

## What gets recorded

Six actions on a tracked content type: `create`, `update`, `clone`, `publish`,
`unpublish` and `discardDraft`. Each version stores the document's content, its
relations, and a snapshot of the schema at the time — the last of which is what
lets a restore tell "this field was empty" apart from "this field did not exist
yet".

Publishing records **one** version, not two, even though the Content Manager
saves the draft and publishes it as two separate operations.

A save that is rolled back records nothing.

## Restoring

Restore writes to the **draft only**. The document moves to _Modified_, and
publishing stays something a person decides to do.

Before anything is written, the state being replaced is itself recorded, so a
restore can always be undone.

The panel shows a preview before asking you to confirm, because the interesting
part of a restore is what it will _not_ do:

- fields not present in that version keep their current values
- fields no longer in the model are skipped
- links to documents or media that have since been deleted are dropped, and
  reported
- **fields that are not translated per locale change in every locale at once** —
  restoring the Polish version of a document rewrites a shared field for every
  other language too. This is not a choice the plugin makes; a non-localised
  field physically has one value. The dialog names those fields and counts the
  locales before you commit.

## Configuration

| Option           | Default | Meaning                                                                                                         |
| ---------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `contentTypes`   | `[]`    | Which content types to version. Empty means none.                                                               |
| `trackApiWrites` | `false` | Also version writes from outside the Content Manager (REST, GraphQL, programmatic). `userId` is null for those. |

## Limits

Worth knowing before you install it, not after:

- **No diff view yet.** The panel lists versions and restores them; it does not
  yet show you what changed between two of them.
- **No retention yet.** The table grows. A thinning policy is the next thing
  planned, but today nothing prunes old versions.
- **Polymorphic relations are skipped**, and reported as unsupported in the
  restore preview rather than silently mangled.
- **Only the Document Service is visible.** Writes made through
  `strapi.db.query()` or the legacy entity service bypass the middleware
  entirely and cannot be captured at any setting.
- **Deleted relation targets lose their names.** A version stores which document
  a relation pointed at, not what it was called, so a link to something since
  deleted shows as missing rather than as "the article it used to be".
- **Media is referenced, never copied.** Delete the file and the version knows
  the file is gone; it cannot bring it back.

## Keeping your history when the plugin is off

Strapi's schema sync drops tables belonging to content types it no longer sees.
Disable this plugin for a single boot and the history would go with it — so on
boot Rewind adds its table to Strapi's `persisted_tables` list, which is the
same mechanism Strapi uses to protect its own. Nothing to configure.

## Requirements

Strapi 5, Node 20 or 22.

## License

MIT.
