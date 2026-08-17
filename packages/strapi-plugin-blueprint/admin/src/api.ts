import { PLUGIN_ID } from './pluginId';

export interface DiagramOptions {
  /** Strapi's and other plugins' content types. */
  foreign: boolean;
  /** Components and dynamic zones. */
  components: boolean;
  /** `createdAt` and the rest of Strapi's bookkeeping. */
  defaultFields: boolean;
  /** Top-to-bottom, or left-to-right. */
  direction: 'TB' | 'LR';
  exclude: string[];
}

export const DEFAULT_OPTIONS: DiagramOptions = {
  foreign: false,
  components: true,
  defaultFields: false,
  direction: 'TB',
  exclude: [],
};

export interface DiagramResponse {
  svg: string;
  width: number;
  height: number;
  counts: { nodes: number; edges: number; components: number };
}

export interface CatalogueEntry {
  uid: string;
  label: string;
  kind: string;
}

export const routes = {
  diagram: `/${PLUGIN_ID}/diagram`,
  contentTypes: `/${PLUGIN_ID}/content-types`,
};

/** The options as the server's query string expects them. */
export const toParams = (options: DiagramOptions): Record<string, string> => ({
  foreign: String(options.foreign),
  components: String(options.components),
  defaultFields: String(options.defaultFields),
  direction: options.direction,
  ...(options.exclude.length > 0 ? { exclude: options.exclude.join(',') } : {}),
});

const STORAGE_KEY = 'blueprint:options';

/**
 * The toolbar state, kept across visits.
 *
 * "Persist arrangement" is one of the open requests on both of the abandoned
 * plugins this replaces. Re-picking the same four toggles on every visit is the
 * kind of small friction that stops people using a tool they otherwise like.
 */
export const loadOptions = (): DiagramOptions => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw
      ? { ...DEFAULT_OPTIONS, ...(JSON.parse(raw) as Partial<DiagramOptions>) }
      : DEFAULT_OPTIONS;
  } catch {
    return DEFAULT_OPTIONS;
  }
};

export const saveOptions = (options: DiagramOptions): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    /* Private mode. The diagram still works, it just forgets. */
  }
};

/**
 * Hands the browser the SVG already on screen.
 *
 * Deliberately not a link to the server's download route: an admin route needs
 * the session's Authorization header, which a plain navigation cannot send. The
 * string is already here, and it is the same string the server would return.
 */
export const downloadSvg = (svg: string, filename = 'blueprint.svg'): void => {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
