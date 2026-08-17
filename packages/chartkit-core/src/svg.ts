/**
 * Building SVG as a string.
 *
 * There is no DOM here and there will not be one: the whole point of this
 * package is that a chart can be produced on a server, or at build time, and
 * arrive at the browser as finished markup.
 *
 * Everything author-controlled - titles, axis labels, series names - is escaped
 * on the way in. A chart is rendered from content someone typed into a CMS, and
 * that content reaches a page as markup, so an unescaped `</text><script>` is a
 * stored XSS. The escaping lives in one place so it cannot be forgotten at a
 * call site.
 */

/**
 * Escapes text appearing between tags.
 *
 * `&` first, or the ampersands introduced by the later replacements get escaped
 * a second time.
 */
export function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Escapes a value going inside a double-quoted attribute. */
export function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}

/**
 * An attribute value. `number` is accepted because nearly every SVG attribute
 * this package writes is a coordinate.
 */
export type AttributeValue = string | number | undefined | null | false;

export type Attributes = Record<string, AttributeValue>;

/**
 * Serializes attributes, dropping the ones that are not set.
 *
 * `undefined`, `null` and `false` all mean "omit this attribute", which lets
 * callers write `{ stroke: someCondition && 'red' }` without building the
 * object conditionally.
 */
export function attrs(attributes: Attributes): string {
  const parts: string[] = [];

  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    parts.push(`${name}="${escapeAttribute(String(value))}"`);
  }

  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

/** A self-closing element, e.g. `<rect …/>`. */
export function tag(name: string, attributes: Attributes = {}): string {
  return `<${name}${attrs(attributes)}/>`;
}

/**
 * An element with children.
 *
 * `children` is raw markup and is **not** escaped - it is the output of other
 * builders in this file. Text content goes through {@link text}, which escapes.
 */
export function element(name: string, attributes: Attributes, children: string): string {
  return `<${name}${attrs(attributes)}>${children}</${name}>`;
}

/** A `<text>` element. Its content is escaped. */
export function text(content: string, attributes: Attributes = {}): string {
  return element('text', attributes, escapeText(content));
}

/**
 * Rounds a coordinate before it goes into markup.
 *
 * Floating point noise from scale arithmetic produces things like
 * `x="43.00000000000001"`, which makes the output larger and, worse, makes
 * snapshot diffs unreadable - a one-pixel layout change should not rewrite
 * every number in the file. Two decimals is far below what any renderer
 * resolves.
 *
 * `+value.toFixed(2)` rather than `Math.round(value * 100) / 100` so `-0`
 * normalizes to `0`; `-0` and `0` are the same point but different strings.
 */
export function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return +value.toFixed(2) + 0;
}
