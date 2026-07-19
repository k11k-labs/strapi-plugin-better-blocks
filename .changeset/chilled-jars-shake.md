---
'@k11k/strapi-plugin-better-blocks': minor
---

feat: merge & split table cells (closes #79)

Cells can now be merged into a rectangle and split back apart, completing the
table work started in #36.

**Merging.** Select a range of cells — drag across them, or click one and
Shift+click another — and use **Merge cells** in the table's contextual toolbar.
The two endpoints act as opposite corners, so selecting from `r2c1` to `r3c2`
merges a 2×2 block rather than everything between them in document order. If the
picked rectangle would slice through an existing merged cell, it grows until it
contains that cell whole, so the result always tiles the grid. Text from the
absorbed cells is appended to the anchor rather than discarded.

**Splitting.** **Split cell** resets the cell to 1×1 and refills every slot it
vacates with an empty cell. Content stays where it was.

**The grid model underneath.** Once cells can span, a cell's index within its row
is no longer its visual column: a row of three cells can cover four columns, and
a `rowSpan` cell occupies a slot in the row below without having a node there.
Every structural operation was rewritten against a proper grid model:

- Inserting a column **widens** a cell that straddles the boundary instead of
  giving it a neighbour, and places new cells at the child index that lands them
  in the right grid column.
- Deleting a column **shrinks** spanning cells rather than deleting them.
- Inserting a row **stretches** cells whose `rowSpan` crosses the boundary, and
  the new row only gets cells for the columns those stretched cells don't cover.
- Deleting a row **re-homes** cells that start in it but continue below, one row
  shorter, so the merge survives.

Without this, the previous index-based operations would have silently corrupted
any table containing a merge.

**JSON shape.** `colSpan` / `rowSpan` on `table-cell` and `table-header-cell`,
**absent meaning 1** — the same convention as `align`, so unmerged cells store
neither key and existing tables need no migration. The full table contract is now
documented in the README for renderer authors. A normalizer clamps spans that
reach past the table's bounds, guarding against hand-edited or imported JSON.

Renderers need `colSpan` / `rowSpan` support to match — tracked in
k11k-labs/better-blocks-react-renderer#50 and
k11k-labs/better-blocks-astro-renderer#41.
