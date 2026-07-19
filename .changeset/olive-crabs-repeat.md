---
'@k11k/better-blocks-react-renderer': minor
---

Render the new table cell properties and semantic header rows

`table-cell` and `table-header-cell` now honor `align` (applied as `text-align`) and `colSpan` / `rowSpan` (mapped onto the HTML attributes of the same name). Each is omitted by the editor at its default — absent `align` means left, absent spans mean 1 — so existing documents render exactly as before.

Leading rows whose cells are all `table-header-cell` are treated as the table's header: they render inside `<thead>` with each cell as `<th scope="col">`, and the remaining rows in `<tbody>`. Several such rows are supported, so a merged header (a `rowSpan` label above a split sub-header) lands in `<thead>` intact. A `table-header-cell` inside a body row is a row header and gets `scope="row"`.

Custom `table-cell` / `table-header-cell` renderers receive `align`, `colSpan`, `rowSpan`, and a ready-made `style` alongside `children`.
