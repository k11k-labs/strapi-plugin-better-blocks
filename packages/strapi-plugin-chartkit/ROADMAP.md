# Chartkit roadmap

What would make Chartkit better, in rough order of how much it would help.
Nothing here is a promise or a date. It is a public list so that anyone opening
an issue can see whether the thing they want is already understood, already
decided against, or genuinely new.

Ideas and disagreement welcome at
[qkix/strapi-plugins/issues](https://github.com/qkix/strapi-plugins/issues).

## Next

### A time axis

There is no time axis, so a series of dates is currently a series of labels:
evenly spaced whatever the gaps between them, and sorted as text unless you
sorted them yourself. Any chart of something over time is therefore slightly
wrong in a way that is easy to miss.

This is the largest single gap, because "a number over time" is the most common
chart there is.

### Colours per chart, not only per site

Palettes are set in your site's CSS, which is the right default: it keeps every
chart on brand without anyone picking hex codes in a CMS. It also means a single
chart that needs one series highlighted has no way to say so. A per-chart
override, falling back to the CSS palette when unset, would cover that without
losing the default.

## Later

### Numbers from a collection rather than stored with the chart

Data lives with the chart, so a chart of something that changes is a chart
somebody has to remember to update. Pointing a chart at a content type and a
field would make it current by construction.

The reason this is not next is that it moves Chartkit from rendering into
querying, which is a much larger surface: filters, aggregation, permissions on
the underlying data, and what a chart does when the query returns nothing.

### Optional tooltips

There is no interactivity, which is what makes a chart cost zero client-side
JavaScript. That premise is worth keeping as the default. An opt-in layer that
hydrates only the charts that asked for it would let a dashboard have hover
values without imposing a runtime on a blog post that just wanted a bar chart.

### More chart types

Driven by what people actually ask for rather than by completeness. Filling out
a matrix of chart types nobody requested is how a charting library becomes large
and hard to change.

## Considered, and not planned

### Shipping a client-side charting library

The entire point is that a page gets a chart without a byte of client-side
JavaScript, and server-rendered SVG is what makes that true. Adding a runtime
renderer would make Chartkit a worse version of the libraries that already exist.

### An editor for arbitrary SVG or custom D3

Chartkit stores a spec and renders it. Accepting drawing code instead would mean
executing whatever an editor typed, on the server, at render time.
