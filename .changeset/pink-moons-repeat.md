---
'@k11k/strapi-plugin-better-blocks': minor
---

feat: editor UX overhaul — toolbar grouping, visual table controls, floating selection menu (closes #36)

**Toolbar re-organization.** Controls are now grouped by what they do — history,
block type, type/colour, marks, paragraph formatting, insertion — and each group
wraps as a whole instead of splitting across rows. The 1px separators are gone;
spacing carries the grouping, which survives wrapping at any editor width.
Blockquote is a direct toggle next to the lists rather than an entry buried in
the block-type dropdown.

**Block dropdown.** Each option renders at its own type scale, so the difference
between H2 and H4 is visible before you pick one, and every option shows its
keyboard shortcut. Those shortcuts are new and actually work:
`Cmd/Ctrl+Alt+1..6` for headings, `+0` for paragraph, `+Q` for quote. The
trigger label is now derived from the document on every render, so it stays in
sync with conversions that don't move the caret.

**Fullscreen** moved from the bottom-right corner of the editor body to the
right edge of the toolbar, where maximize controls are normally found, and the
same button collapses again while expanded.

**Table overhaul.**

- Inserting a table opens a 10×10 hover grid with a live "4 × 6" readout and a
  custom-size fallback, instead of dropping a fixed 3×3.
- A contextual toolbar floats above the table whenever the caret is inside it,
  with **directional** operations — insert row above/below, insert column
  left/right, delete row/column — all anchored on the focused cell rather than
  appending at the end. It also carries cell alignment, a header-row toggle and
  delete-table.
- Cell alignment is stored as `align` on `table-cell` / `table-header-cell`.
  Left is stored as _absent_, so existing tables need no migration.
- Header cells render as `<th scope="col">` for screen readers, and the header
  row can be toggled on or off. Deleting the header row promotes its successor
  rather than silently leaving the table header-less.
- Borders went from a 1px hairline to 2px against a mid-grey, and the row and
  column holding the caret are tinted for orientation in large tables.
- Wide tables scroll horizontally instead of overflowing the editor.
- Cells keep full inline rich-text parity (marks, links, colours, inline math) —
  the structure guard only blocks operations that would break the table's shape.

**Floating selection toolbar.** Selecting text pops a mini toolbar above it with
bold, italic, underline, strikethrough, inline code, link, colour and clear
formatting — no trip to the main toolbar. It hides inside code and void media
blocks, where marks don't apply.

Renderers need to follow up on the table changes: see
k11k-labs/better-blocks-react-renderer#50 and
k11k-labs/better-blocks-astro-renderer#41. Merge/split cells is tracked
separately in #79 — it needs a cell-range selection model and a span-aware grid,
which the rest of this work deliberately doesn't assume.
