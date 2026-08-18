# Rewind roadmap

What would make Rewind better, in rough order of how much it would help. Nothing
here is a promise or a date. It is a public list so that anyone opening an issue
can see whether the thing they want is already understood, already decided
against, or genuinely new.

Ideas and disagreement welcome at
[qkix/strapi-plugins/issues](https://github.com/qkix/strapi-plugins/issues).

## Next

### A pin button

Pinning already works and prune already honours it. There is simply no button:
you pin a version by setting `pinned` on the row in the database, which is not a
thing you can ask an editor to do. The smallest gap between "implemented" and
"usable" anywhere in this plugin.

### Compare any two versions

Every entry has a **What changed** link, and it compares that version with the
one saved immediately before it. That answers "what did this save do" and not
"what has changed since Friday", which is the question people usually have when
they open a history panel.

The diff itself already handles scalars, prose and relations, so this is a
question of choosing two versions rather than of comparing them.

### Remember what a relation pointed at

A version stores which document a relation pointed at, not what it was called,
so a link to something since deleted shows as missing rather than as "the
article it used to be". Storing a display name alongside the id at snapshot time
would make a restore preview readable after the target is gone, which is exactly
when the history matters.

## Later

### Restore one field rather than the whole document

Putting a whole document back is the blunt version of what people often want,
which is to undo one paragraph while keeping everything edited since. The diff
already knows which fields differ.

### A history across documents

The panel is per document. "What changed in this content type this week" is a
different and useful view of the same rows, and is close to what an audit log
would be.

### Hand a version to Ferry

A version is a snapshot of a document, and Ferry writes snapshots of documents to
files. Exporting a specific version, rather than the current one, is a small
piece of glue between two plugins that already exist.

## Considered, and not planned

### Capturing writes that bypass the Document Service

Only the Document Service is visible to the middleware. Writes made through
`strapi.db.query()` or the legacy entity service bypass it entirely and cannot be
captured at any setting. This is a property of where Strapi lets a plugin stand,
not a gap that more code would close, and pretending otherwise would produce a
history with silent holes in it.

### Polymorphic relations

A `morphToMany` has no single target to snapshot honestly. They are skipped, and
reported as unsupported in the restore preview rather than silently mangled.
Guessing would be worse than saying so.

### Copying media into the version

Media is referenced, never copied. Delete the file and the version knows the file
is gone but cannot bring it back. Duplicating every image on every save to change
that would cost far more than it returns.
