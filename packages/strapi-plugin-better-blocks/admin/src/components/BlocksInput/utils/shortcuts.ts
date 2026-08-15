/**
 * Keyboard shortcuts for block-type conversion.
 *
 * These are matched on `event.code` rather than `event.key`: on macOS, holding
 * Option rewrites `key` ("1" becomes "¡"), while `code` stays "Digit1".
 */

/** Block keys that can be reached with a shortcut, mapped to their key code. */
const BLOCK_SHORTCUTS: Record<string, string> = {
  paragraph: 'Digit0',
  'heading-one': 'Digit1',
  'heading-two': 'Digit2',
  'heading-three': 'Digit3',
  'heading-four': 'Digit4',
  'heading-five': 'Digit5',
  'heading-six': 'Digit6',
  quote: 'KeyQ',
};

const isMac = (): boolean =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Human-readable form of a code, e.g. "Digit2" -> "2", "KeyQ" -> "Q". */
const codeToLabel = (code: string): string =>
  code.replace(/^Digit/, '').replace(/^Key/, '');

/**
 * Renders a shortcut for display next to a menu item, e.g. "⌘⌥2" on macOS and
 * "Ctrl+Alt+2" elsewhere.
 */
const getShortcutLabel = (blockKey: string): string | null => {
  const code = BLOCK_SHORTCUTS[blockKey];
  if (!code) return null;

  return isMac() ? `⌘⌥${codeToLabel(code)}` : `Ctrl+Alt+${codeToLabel(code)}`;
};

/**
 * Resolves a keydown event to the block key it should convert to, or null when
 * the event isn't a block shortcut. Callers still own preventDefault.
 */
const matchBlockShortcut = (event: {
  code: string;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}): string | null => {
  if (!event.altKey || !(event.metaKey || event.ctrlKey) || event.shiftKey) {
    return null;
  }

  const entry = Object.entries(BLOCK_SHORTCUTS).find(
    ([, code]) => code === event.code
  );

  return entry ? entry[0] : null;
};

export { BLOCK_SHORTCUTS, getShortcutLabel, matchBlockShortcut };
