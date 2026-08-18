# Ferry roadmap

What would make Ferry better, in rough order of how much it would help. Nothing
here is a promise or a date. It is a public list so that anyone opening an issue
can see whether the thing they want is already understood, already decided
against, or genuinely new.

Ideas and disagreement welcome at
[qkix/strapi-plugins/issues](https://github.com/qkix/strapi-plugins/issues).

## Next

### Export from the Content Manager list view

Select rows, or narrow the list with filters, and export exactly those. The
server side already exists: `/ferry/export` takes `documentIds` and `filters`
and the tests cover both. What is missing is the button in the list view, which
is the injection zone work Greenlight already does for its stage column.

Without it, taking a copy of "the twelve articles I just fixed" means exporting
all of them and deleting the rest by hand.

### More than one content type in a file

Today a file holds one content type, so moving articles and their authors is two
exports, two imports, and remembering to do the authors first. A bundle would
make a migration one file, and would let the two-pass import resolve relations
_across_ types in one go, rather than depending on the order a person picked.

This is the single change that would most reduce the number of steps in the job
Ferry exists for.

### Every locale in one file

`locale` currently selects one. A localised site is then one file per locale per
content type, which multiplies quickly. The document service can return all
locales at once, and the import already writes per locale, so this is mostly a
question of how the file should represent them.

## Later

### Seed on first boot

Point the plugin at a file and have it import when the environment is empty.
Provisioning a review app or a fresh developer machine with real demo content is
a recurring need that currently means somebody remembering to click Import.

### A command rather than an HTTP call

The endpoints are usable from CI today, but they need an admin session. A CLI
that runs inside the app, the way `strapi export` does, would suit a deploy
pipeline better than a token would.

### Media as bytes, optionally

Ferry matches uploads by hash and reconnects them when they already exist. It
cannot help when the target has never seen the file. An optional archive
carrying the binaries alongside the JSON would close that, at the cost of files
that are no longer diffable, so it has to stay opt-in.

### Import straight from a URL

Handy for seeding from a gist or a build artefact. Small, and it needs care:
fetching a URL the server chooses is one thing, fetching one a request names is
another.

### XLSX

CSV opens in the same places and round-trips honestly. XLSX is worth doing only
if people are actually pasting into Excel and losing something, which is not yet
established.

## Considered, and not planned

### Reading or writing through the database directly

Faster, and it skips lifecycles, validation and every other plugin. An import
that bypasses Rewind's history and Greenlight's publish gate is not a feature.

### Exporting admin users, roles or permissions

That is infrastructure, not content. Moving it between environments breaks the
environment it lands in, and it is exactly the sort of thing that looks like it
worked until someone cannot log in.

### Two-way sync with conflict resolution

Deciding which side wins when both changed is a different product, and a much
larger one. Ferry moves content in a direction you chose.
