# Greenlight roadmap

What would make Greenlight better, in rough order of how much it would help.
Nothing here is a promise or a date. It is a public list so that anyone opening
an issue can see whether the thing they want is already understood, already
decided against, or genuinely new.

Ideas and disagreement welcome at
[qkix/strapi-plugins/issues](https://github.com/qkix/strapi-plugins/issues).

## Next

### Tell people a bulk publish will fail, before it fails

Selecting twenty entries and pressing Publish rolls the whole batch back if any
one of them is unapproved, and Strapi reports the first refusal only. The
per-row Publish action is already disabled for unapproved entries, which is the
closest warning available today.

The right place for a real warning is the Content Manager's
`publishModalAdditionalInfos` injection zone, which Strapi declares and, as of
5.52, never renders. So this is blocked upstream rather than unbuilt. Worth
re-checking on each Strapi minor, and worth an issue on Strapi itself.

### Sort by stage

The stage filter works by answering the stage question first and handing the
Content Manager a `documentId` filter, because the Content Manager validates
every filter against your schema and a stage is not in your schema. That gets
filtering, and it cannot get sorting: the order is applied by the database to a
column that is not there.

Sorting a review queue by how far along things are is a reasonable thing to
want, and it needs a different mechanism than the filter uses.

### Say something happened

A stage change is currently visible only to somebody looking at the panel. A
webhook, or mail through Strapi's own provider, would let a review actually
reach the reviewer. This is the most common thing missing from a review tool
that otherwise works.

## Later

### A record of who decided what

The current stage is stored; the path it took to get there is not. For anything
resembling compliance, the question is not "where is this" but "who approved it
and when".

### Publish on a schedule once approved

Approval and publication are different moments, and today they are the same one.
Note that `strapi-plugin-publisher` covers scheduling well and is actively
maintained, so this is only worth building if the gate and the schedule genuinely
need to know about each other.

### Raise or remove the 5,000 document limit on the filter

The filter resolves stages into a `documentId` list, so it is bounded by how
large that list can reasonably be. Fine for a review queue, not fine for
filtering a very large content type. A different mechanism, likely the same one
that makes sorting possible, would lift both limits at once.

## Considered, and not planned

### Becoming a drop-in replacement for Strapi's Review Workflows

Greenlight is written against the public documentation and shares no code with
Strapi's Enterprise feature. Matching its API surface would mean tracking a
paid product's internals, and the thing that makes Greenlight worth using is a
different design decision: a stage that governs a document rather than labels it.

### Per-field or per-block approval

Approving a paragraph rather than a document sounds appealing and unravels
quickly: what publishes when half a document is approved. The document is the
unit Strapi publishes, so it is the unit worth gating.
