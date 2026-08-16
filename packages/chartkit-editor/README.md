# @qkix/chartkit-editor

The chart editor for the Strapi admin: a preview, a data grid, and paste from a
spreadsheet.

```tsx
import { ChartEditor } from '@qkix/chartkit-editor';

<ChartEditor spec={spec} onChange={setSpec} locale="en-US" />;
```

## Why it is its own package

Chartkit appears in two places — as a standalone Strapi custom field, and as a
block inside Better Blocks. Both need the same editing surface. If it lived in
either plugin, the other would have to depend on a whole editor plugin to reuse
it, which is precisely the coupling the block registration API exists to avoid.

## The preview is the real renderer

It calls `renderChart` from `@qkix/chartkit-core` — the same function the React
and Astro renderers call. The editor and the published page draw from one code
path, so a chart cannot look right in one and wrong in the other.

A spec that will not render shows its **validation issues** instead of an empty
frame. The author is the only person who can fix it, and this is the one moment
they are looking at it.

## Pasting from a spreadsheet

The path most charts will actually be created by: the numbers already exist in
Sheets or Excel, and retyping them is the worst part of every charting tool.

Deliberately generous about the input, because none of this is the author's
mistake:

| Input                             | Read as                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- |
| tab, comma or semicolon separated | detected per paste; tab first, since that is what a spreadsheet copy produces |
| `1.234,5` and `1,234.5`           | 1234.5 either way                                                             |
| `€1 234,50`                       | 1234.5 — currency, spaces and thousands marks stripped                        |
| `"North, inland"`                 | one cell; a quoted delimiter survives                                         |
| `n/a`, `—`, empty                 | a **gap**, never a zero                                                       |

Semicolons are preferred over commas because a semicolon-separated file usually
comes from a locale that also writes decimals with a comma — splitting on those
commas would shred every number.

It shows **what it parsed before replacing anything**. The parser has to guess
whether the first row is a header, and a wrong guess that silently overwrites an
author's data is far worse than one they can see and cancel.

## Edits are pure functions

Every grid operation — `setCell`, `addRow`, `removeSeries`, `setType` — takes a
spec and returns a new one, and they are exported. A host that wants its own
controls can drive a spec with these rather than reimplementing array surgery
that has to preserve nulls.

They are pure for two reasons. Strapi decides a document is dirty by comparing
references, so an in-place edit would show changes the save button does not know
about. And editing a chart is mostly array surgery — keep every series the same
length as the labels, never lose a `null` that means "no reading" — which is
miserable to test through a rendered table and trivial to test directly.

`normalizeShape` runs on every change, so a spec can never leave the editor
ragged: a series shorter than its labels makes every later edit ambiguous.

## Two behaviours worth knowing

**Cells commit on blur, not per keystroke.** Parsing every keystroke means `1.`
collapses to `1` and the cursor jumps behind the dot the moment anyone types
`1.5`, and a cleared cell flickers through `0`.

**Switching to pie or donut asks first.** Those types show one series as shares
of a whole and the core refuses more, so the switch discards data. Doing it
silently would be a deletion disguised as a conversion.

## Not yet

Reading data from a file in the **Media Library** — the third input path — is
still to come.

## License

MIT
