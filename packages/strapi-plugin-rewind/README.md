<p align="center">
  <img src="https://raw.githubusercontent.com/qkix/strapi-plugins/main/packages/strapi-plugin-rewind/docs/logo.png" alt="Rewind" width="120" />
</p>

<h1 align="center">Rewind for Strapi</h1>

<p align="center">Document version history for Strapi v5. Every save is snapshotted, and any snapshot can be <strong>put back</strong>.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@qkix/strapi-plugin-rewind">
    <img alt="npm version" src="https://img.shields.io/npm/v/@qkix/strapi-plugin-rewind.svg" />
  </a>
  <a href="https://www.npmjs.com/package/@qkix/strapi-plugin-rewind">
    <img alt="npm downloads" src="https://img.shields.io/npm/dm/@qkix/strapi-plugin-rewind.svg" />
  </a>
  <a href="https://github.com/qkix/strapi-plugins/blob/main/LICENSE">
    <img alt="license" src="https://img.shields.io/npm/l/@qkix/strapi-plugin-rewind.svg" />
  </a>
  <a href="https://buymeacoffee.com/qkix">
    <img alt="Buy Me a Coffee" src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black" />
  </a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/qkix/strapi-plugins/main/packages/strapi-plugin-rewind/docs/edit-view.png" alt="The history panel beside a document in the Strapi edit view" width="900" />
</p>

The panel sits in the edit view, next to the document it belongs to. Each entry
is a point you can go back to: what the document said, when, and who saved it.

## What this is, and what it is not

Strapi sells a feature called **Content History** on its Growth and Enterprise
plans. Rewind is **not that feature**, is not a drop-in replacement for it, and
does not unlock it.

It is the poor cousin. If you pay for Growth, use Strapi's - it is deeper, it is
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

And a good deal it does _not_ do - see [Limits](#limits).

### On not touching the paywall

Rewind never reads or writes `strapi.ee`, never inspects a licence, and never
enables a gated feature. It is an independent implementation writing to its own
table, and it works the same whether or not you have a Strapi licence. Strapi's
history code is MIT-licensed and was read while working out what the problem
actually is - the way you would read any open-source implementation before
writing your own - but the code here is written for this plugin.

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
relations, and a snapshot of the schema at the time - the last of which is what
lets a restore tell "this field was empty" apart from "this field did not exist
yet".

Publishing records **one** version, not two, even though the Content Manager
saves the draft and publishes it as two separate operations.

A save that is rolled back records nothing.

<img src="https://raw.githubusercontent.com/qkix/strapi-plugins/main/packages/strapi-plugin-rewind/docs/panel.png" alt="History entries labelled Replaced by restore, Draft discarded and Edited" width="320" />

The badge says what happened to the document. **Replaced by restore** marks the
state a restore was about to overwrite - the undo point for that restore.

## Restoring

<img src="https://raw.githubusercontent.com/qkix/strapi-plugins/main/packages/strapi-plugin-rewind/docs/restore.png" alt="The restore confirmation dialog" width="400" />

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
- **fields that are not translated per locale change in every locale at once** -
  restoring the Polish version of a document rewrites a shared field for every
  other language too. This is not a choice the plugin makes; a non-localised
  field physically has one value. The dialog names those fields and counts the
  locales before you commit.

## Seeing what changed

Every entry in the panel has a **What changed** link, comparing that version
with the one saved immediately before it.

<img src="https://raw.githubusercontent.com/qkix/strapi-plugins/main/packages/strapi-plugin-rewind/docs/changes.png" alt="A word-level diff: 'put back' struck through and replaced by 'restored in one click', and 'ten' by 'twelve'" width="760" />

Scalars are shown as a plain before and after. Prose - including rich text
stored as JSON - is compared word by word, with the unchanged stretches
collapsed, so a one-word edit in a long article reads as one word rather than
as the whole article with something green in it somewhere. Relations are
reported as linked and unlinked.

Where a field's stored value changed but its readable text did not - a mark
applied, blocks reordered - it says so, rather than showing an empty diff.

### Rendering a field type properly

Pulling the words out of a rich-text field tells an editor _that_ a paragraph
changed, and nothing about a block moving or an image being swapped. Only the
package that owns the format can show that, so the mapping is a registry:

```ts
import { registerDiffRenderer } from '@qkix/strapi-plugin-rewind/strapi-admin';

import { MyBlocksDiff } from './MyBlocksDiff'; // yours - see below

registerDiffRenderer('plugin::better-blocks.better-blocks', MyBlocksDiff);
```

Keyed by a custom field's uid, or by an attribute `type`. A uid wins over a
type, since every custom field stores itself as `json`.

> **Bring your own renderer.** Rewind ships the registry, not the renderers. No
> `@qkix` package currently exports a block-aware diff component - including
> Better Blocks - so the component above is one you write. A renderer receives
> the two values and returns the `FieldChange` shape exported alongside
> `registerDiffRenderer`; without one registered, a field falls back to the
> generic text diff. A ready-made renderer for Better Blocks documents is
> wanted, and not yet written.

## Configuration

| Option                     | Default       | Meaning                                                                                                         |
| -------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------- |
| `contentTypes`             | `[]`          | Which content types to version. Empty means none.                                                               |
| `trackApiWrites`           | `false`       | Also version writes from outside the Content Manager (REST, GraphQL, programmatic). `userId` is null for those. |
| `retention.enabled`        | `true`        | Thin old versions on a schedule. `false` keeps everything forever and leaves the table to you.                  |
| `retention.keepAllDays`    | `7`           | Keep every version this many days back.                                                                         |
| `retention.dailyUntilDays` | `30`          | Then keep one a day, up to this age.                                                                            |
| `retention.maxAgeDays`     | `365`         | Then keep one a week, and drop anything older.                                                                  |
| `retention.keepAnchors`    | `true`        | Never thin publish, unpublish, discard or restore versions, whatever their age.                                 |
| `cron`                     | `'0 3 * * *'` | When the thinning runs, in the server's timezone.                                                               |

The three windows must widen in order - `keepAllDays <= dailyUntilDays <=
maxAgeDays` - and the plugin refuses to boot rather than delete on a guess if
they do not. Pinned versions are never thinned either, independently of
`keepAnchors`.

So out of the box a year of history costs roughly: every save for a week, one a
day for a month, one a week after that, plus every publish and every pin.

## Limits

Worth knowing before you install it, not after:

- **Polymorphic relations are skipped**, and reported as unsupported in the
  restore preview rather than silently mangled.
- **Only the Document Service is visible.** Writes made through
  `strapi.db.query()` or the legacy entity service bypass the middleware
  entirely and cannot be captured at any setting.
- **Nothing pins a version from the panel yet.** The column is there and prune
  honours it, but there is no button; pin by setting `pinned` on the row.
- **Deleted relation targets lose their names.** A version stores which document
  a relation pointed at, not what it was called, so a link to something since
  deleted shows as missing rather than as "the article it used to be".
- **Media is referenced, never copied.** Delete the file and the version knows
  the file is gone; it cannot bring it back.

## Keeping your history when the plugin is off

Strapi's schema sync drops tables belonging to content types it no longer sees.
Disable this plugin for a single boot and the history would go with it - so on
boot Rewind adds its table to Strapi's `persisted_tables` list, which is the
same mechanism Strapi uses to protect its own. Nothing to configure.

## Requirements

Strapi 5, Node 20 or 22.

## License

MIT.
