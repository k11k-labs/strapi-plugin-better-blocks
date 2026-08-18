# Blueprint roadmap

What would make Blueprint better, in rough order of how much it would help.
Nothing here is a promise or a date. It is a public list so that anyone opening
an issue can see whether the thing they want is already understood, already
decided against, or genuinely new.

Ideas and disagreement welcome at
[qkix/strapi-plugins/issues](https://github.com/qkix/strapi-plugins/issues).

## Next

### Move a box and have it stay there

Layout is automatic and cannot be nudged. On a schema of any size the algorithm
puts two related types at opposite ends often enough to be irritating, and there
is no way to say otherwise.

This is a real, repeated request on both of the plugins Blueprint replaces, so
it is the first thing worth building. It needs somewhere to keep the positions
that survives a reload and a schema change, and a sensible answer for what
happens to a pinned box when the type it was pinned next to is deleted.

### Draw polymorphic relations somehow

A `morphToMany` has no single target, so there is no honest line to draw and
today none is drawn. The field is still listed on its box, which is better than
lying, but a schema built on dynamic zones plus polymorphic relations comes out
looking sparser than it is.

A dashed line to a small cluster of possible targets would say "this points at
one of these" without claiming more than the schema does.

### Let a box show all its fields

Boxes stop at twelve fields and count the rest as `+n more`, because one box
four times the height of its neighbours turns a diagram into a wall. That is the
right default and a poor absolute: clicking `+n more` to expand that one box
would cost nothing and answer the question without a trip to the Content-Type
Builder.

## Later

### Focus on one type and its neighbours

A whole-schema picture is the wrong altitude when the question is "what touches
Article". Picking a type and drawing only what it reaches, one or two hops out,
is a different and often more useful drawing from the same graph.

### Emit the diagram as text

`GET /blueprint/graph` already returns the graph as JSON. Emitting Mermaid or
DBML from the same data would let the schema live in a docs site as text that
renders itself, rather than as an image that has to be regenerated and
committed.

### PNG as well as SVG

SVG is the right format and the one worth defending: it scales, it diffs, and it
works in a README. But some tools still want a raster, and rendering one from
the SVG the server already produces is cheap.

## Considered, and not planned

### Editing the schema from the diagram

Dragging a line between two boxes to create a relation is an appealing demo and
a bad idea here. The Content-Type Builder owns schema changes, handles the
migrations and the validation, and is one click away from every box already.

### A React graph library in the admin panel

Panning, zooming and clicking are about a hundred lines over an SVG. The plugins
Blueprint replaces all reached for a canvas library, and their issue trackers are
what happened next: styled-components version conflicts, engine warnings, a Node
20 incompatibility. A layout algorithm on the server has no opinion about your
front end, and that is worth keeping.
