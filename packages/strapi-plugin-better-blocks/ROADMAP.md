# Better Blocks roadmap

What would make Better Blocks better, in rough order of how much it would help.
Nothing here is a promise or a date. It is a public list so that anyone opening
an issue can see whether the thing they want is already understood, already
decided against, or genuinely new.

Ideas and disagreement welcome at
[qkix/strapi-plugins/issues](https://github.com/qkix/strapi-plugins/issues).

## Next

### Turn features off per field

The editor now has more than thirty blocks and toolbar controls, and a field can
configure almost none of it: colour palettes, the button defaults and the details
style, and that is the list. Every field gets everything else.

That is the wrong default for a maximalist editor. A short bio field does not
want Mermaid diagrams, LaTeX and a call-to-action button in its slash menu, and
an editor handed all of it uses less of it. Letting the Content-Type Builder
choose which blocks a field offers is the most valuable single change left here,
and it costs nothing at runtime.

### A second look at the toolbar

The toolbar wraps to multiple rows so every button stays reachable, which solves
the width problem by making the editor taller. With this many controls the real
answer is grouping and overflow rather than wrapping, and the feature toggles
above would shrink the problem before it is solved.

### Keyboard and screen reader pass

Slash commands, the block picker and find-and-replace are all keyboard driven
already. What has not been done is a deliberate audit: focus order through the
popovers and modals, what a screen reader announces when a block is inserted, and
whether every hover-only control has a keyboard route. Worth doing once,
properly, rather than a fix at a time.

## Later

### Say what a document needs before it renders

A document can contain KaTeX, Mermaid and platform embeds, each of which needs
something of the frontend: a stylesheet, a `frame-src` entry, a renderer. Today
you find out by looking. The document could report its own requirements, so a
build can check them.

### Paste from more places

Markdown paste already covers CommonMark and GitHub Flavored Markdown, which is
what most tools emit. Google Docs and Word paste as HTML with their own quirks
and are the usual next complaint.

### A smaller editor bundle

KaTeX, Mermaid and the rest are heavy, and a field that never uses them still
pays for them being available. Loading a block's implementation the first time it
is inserted would pair naturally with the per-field toggles.

## Considered, and not planned

### Real-time collaborative editing

Two people in one document at once needs a server that arbitrates, presence, and
conflict resolution in the document model. That is not a plugin, it is
infrastructure, and Strapi does not currently offer a place to put it.

### Comments and suggestions on a document

Reasonable to want and a different product. Review lives in
[Greenlight](../strapi-plugin-greenlight), and a comment thread belongs beside a
document rather than inside its content.

### A Markdown storage format

Better Blocks stores the Strapi Blocks JSON shape, which is what makes it a
drop-in replacement for the native field and what the renderers consume.
Storing Markdown instead would break both, and lose everything Markdown has no
syntax for.
