import { Editor, Range, Transforms } from 'slate';

/**
 * Auto text transformation rules.
 * When the user types the trigger followed by a space,
 * the trigger text is replaced with the replacement.
 */
const TRANSFORMS: [string, string][] = [
  // Legal / symbols
  ['(c)', '©'],
  ['(r)', '®'],
  ['(tm)', '™'],
  ['(p)', '§'],
  // Fractions
  ['1/2', '½'],
  ['1/3', '⅓'],
  ['2/3', '⅔'],
  ['1/4', '¼'],
  ['3/4', '¾'],
  ['1/8', '⅛'],
  // Dashes
  ['--', '—'],
  // Arrows
  ['->', '→'],
  ['<-', '←'],
  ['=>', '⇒'],
  ['<=>', '⇔'],
  // Ellipsis
  ['...', '…'],
  // Math
  ['!=', '≠'],
  ['>=', '≥'],
  ['<=', '≤'],
  ['+-', '±'],
  ['~=', '≈'],
];

const withAutoTransform = (editor: Editor): Editor => {
  const { insertText } = editor;

  editor.insertText = (text) => {
    // Only check on space
    if (
      text === ' ' &&
      editor.selection &&
      Range.isCollapsed(editor.selection)
    ) {
      const { anchor } = editor.selection;

      // Get text before cursor (up to 6 chars back, longest trigger)
      const blockEntry = Editor.above(editor, {
        match: (n) => !Editor.isEditor(n) && 'type' in n && n.type !== 'text',
      });

      if (blockEntry) {
        const [, blockPath] = blockEntry;
        const start = Editor.start(editor, blockPath);
        const range = { anchor, focus: start };
        const beforeText = Editor.string(editor, range);

        for (const [trigger, replacement] of TRANSFORMS) {
          if (beforeText.endsWith(trigger)) {
            // Delete the trigger text and insert replacement
            const triggerStart = {
              ...anchor,
              offset: anchor.offset - trigger.length,
            };
            Transforms.select(editor, {
              anchor: triggerStart,
              focus: anchor,
            });
            Transforms.insertText(editor, replacement);
            // Insert the space after replacement
            insertText(' ');
            return;
          }
        }
      }
    }

    insertText(text);
  };

  return editor;
};

export { withAutoTransform };
