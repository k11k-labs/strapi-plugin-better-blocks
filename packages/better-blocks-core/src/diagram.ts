/**
 * Theming for `diagram` (Mermaid) blocks rendered by mermaid.js.
 *
 * mermaid.js is configured globally (`mermaid.initialize`), which is no use to
 * a renderer: every diagram on a page shares that one config, so the last
 * `diagramTheme` to initialize would win. The one supported way to theme a
 * single diagram is the `%%{init: …}%%` directive at the top of its source, so
 * that is what this module builds.
 *
 * The named palettes below are the ones `beautiful-mermaid` shipped. They are
 * inlined here rather than imported so the documented `diagramTheme` values
 * keep working in renderers that no longer depend on that engine.
 */

/** Built-in palette name accepted by `diagramTheme`. */
export type DiagramThemeName =
  | 'zinc-light'
  | 'zinc-dark'
  | 'tokyo-night'
  | 'tokyo-night-storm'
  | 'tokyo-night-light'
  | 'catppuccin-mocha'
  | 'catppuccin-latte'
  | 'nord'
  | 'nord-light'
  | 'dracula'
  | 'github-light'
  | 'github-dark'
  | 'solarized-light'
  | 'solarized-dark'
  | 'one-dark';

/**
 * Custom Mermaid palette. `bg`/`fg` alone produce a clean monochrome diagram;
 * `line`/`accent`/`muted`/`surface`/`border` bring in richer color (mermaid
 * derives whatever is left out from the ones that are set).
 */
export type DiagramColors = {
  bg?: string;
  fg?: string;
  line?: string;
  accent?: string;
  muted?: string;
  surface?: string;
  border?: string;
  font?: string;
  transparent?: boolean;
};

/**
 * Theme for `diagram` blocks - a built-in palette name or a custom color
 * object. A bare `string` is accepted so a name added later still type-checks.
 */
export type DiagramTheme = DiagramThemeName | (string & {}) | DiagramColors;

/** The built-in palettes, keyed by the name `diagramTheme` accepts. */
export const DIAGRAM_THEMES: Record<DiagramThemeName, DiagramColors> = {
  'zinc-light': { bg: '#FFFFFF', fg: '#27272A' },
  'zinc-dark': { bg: '#18181B', fg: '#FAFAFA' },
  'tokyo-night': {
    bg: '#1a1b26',
    fg: '#a9b1d6',
    line: '#3d59a1',
    accent: '#7aa2f7',
    muted: '#565f89',
  },
  'tokyo-night-storm': {
    bg: '#24283b',
    fg: '#a9b1d6',
    line: '#3d59a1',
    accent: '#7aa2f7',
    muted: '#565f89',
  },
  'tokyo-night-light': {
    bg: '#d5d6db',
    fg: '#343b58',
    line: '#34548a',
    accent: '#34548a',
    muted: '#9699a3',
  },
  'catppuccin-mocha': {
    bg: '#1e1e2e',
    fg: '#cdd6f4',
    line: '#585b70',
    accent: '#cba6f7',
    muted: '#6c7086',
  },
  'catppuccin-latte': {
    bg: '#eff1f5',
    fg: '#4c4f69',
    line: '#9ca0b0',
    accent: '#8839ef',
    muted: '#9ca0b0',
  },
  nord: { bg: '#2e3440', fg: '#d8dee9', line: '#4c566a', accent: '#88c0d0', muted: '#616e88' },
  'nord-light': {
    bg: '#eceff4',
    fg: '#2e3440',
    line: '#aab1c0',
    accent: '#5e81ac',
    muted: '#7b88a1',
  },
  dracula: { bg: '#282a36', fg: '#f8f8f2', line: '#6272a4', accent: '#bd93f9', muted: '#6272a4' },
  'github-light': {
    bg: '#ffffff',
    fg: '#1f2328',
    line: '#d1d9e0',
    accent: '#0969da',
    muted: '#59636e',
  },
  'github-dark': {
    bg: '#0d1117',
    fg: '#e6edf3',
    line: '#3d444d',
    accent: '#4493f8',
    muted: '#9198a1',
  },
  'solarized-light': {
    bg: '#fdf6e3',
    fg: '#657b83',
    line: '#93a1a1',
    accent: '#268bd2',
    muted: '#93a1a1',
  },
  'solarized-dark': {
    bg: '#002b36',
    fg: '#839496',
    line: '#586e75',
    accent: '#268bd2',
    muted: '#586e75',
  },
  'one-dark': {
    bg: '#282c34',
    fg: '#abb2bf',
    line: '#4b5263',
    accent: '#c678dd',
    muted: '#5c6370',
  },
};

/** Resolves either form of `diagramTheme` to a palette, or `null` if unknown. */
export function resolveDiagramColors(theme: DiagramTheme | undefined | null): DiagramColors | null {
  if (theme == null) return null;
  if (typeof theme === 'object') return theme;
  return DIAGRAM_THEMES[theme as DiagramThemeName] ?? null;
}

/**
 * Maps a palette onto mermaid's `themeVariables`. Only the keys a palette
 * actually sets are emitted - mermaid derives the rest of its (large) variable
 * set from those, which is what keeps a two-color palette looking coherent.
 */
export function toMermaidThemeVariables(colors: DiagramColors): Record<string, string> {
  const vars: Record<string, string> = {};
  const set = (key: string, value: string | undefined) => {
    if (value) vars[key] = value;
  };

  // `transparent` wins over `bg`: it exists so a diagram can sit on whatever
  // the page background is.
  set('background', colors.transparent ? 'transparent' : colors.bg);
  // Node fill/border: `surface`/`border` when given, else the base pair, which
  // is how the palettes that only carry bg/fg/accent stay legible.
  set('primaryColor', colors.surface ?? colors.bg);
  set('primaryBorderColor', colors.border ?? colors.accent);
  set('primaryTextColor', colors.fg);
  set('textColor', colors.fg);
  set('lineColor', colors.line ?? colors.accent);
  set('secondaryColor', colors.accent);
  set('tertiaryColor', colors.muted);
  set('fontFamily', colors.font);

  return vars;
}

/**
 * Prepends mermaid's `%%{init}%%` directive to a diagram's source so it renders
 * with `theme`.
 *
 * Returns the source untouched when there is no theme to apply, or when the
 * author wrote their own directive - theirs is the more specific intent, and
 * two `init` directives on one diagram is not something mermaid defines.
 */
export function applyDiagramTheme(source: string, theme?: DiagramTheme | null): string {
  const colors = resolveDiagramColors(theme);
  if (!colors) return source;
  if (/^\s*%%\{\s*init\s*:/i.test(source)) return source;

  const themeVariables = toMermaidThemeVariables(colors);
  if (Object.keys(themeVariables).length === 0) return source;

  return `%%{init: ${JSON.stringify({ theme: 'base', themeVariables })}}%%\n${source}`;
}
