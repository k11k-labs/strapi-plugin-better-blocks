import * as React from 'react';
import { Box, Flex, Popover, Field } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { styled } from 'styled-components';

import { useBlocksEditorContext } from './BlocksEditor';

const EMOJI_LIST = [
  // Smileys
  '😀',
  '😃',
  '😄',
  '😁',
  '😆',
  '😅',
  '🤣',
  '😂',
  '🙂',
  '😉',
  '😊',
  '😇',
  '🥰',
  '😍',
  '🤩',
  '😘',
  '😗',
  '😚',
  '😋',
  '😛',
  '😜',
  '🤪',
  '😝',
  '🤑',
  '🤗',
  '🤭',
  '🤫',
  '🤔',
  '🤐',
  '🤨',
  '😐',
  '😑',
  '😶',
  '😏',
  '😒',
  '🙄',
  '😬',
  '😮',
  '😯',
  '😲',
  '😳',
  '🥺',
  '😢',
  '😭',
  '😤',
  '😠',
  '😡',
  '🤬',
  '😈',
  '👿',
  // Gestures
  '👍',
  '👎',
  '👌',
  '✌️',
  '🤞',
  '🤟',
  '🤘',
  '👊',
  '✊',
  '🤛',
  '👏',
  '🙌',
  '👐',
  '🤲',
  '🤝',
  '🙏',
  '💪',
  '🦾',
  '🖐️',
  '✋',
  // Hearts & symbols
  '❤️',
  '🧡',
  '💛',
  '💚',
  '💙',
  '💜',
  '🖤',
  '🤍',
  '💔',
  '💕',
  '⭐',
  '🌟',
  '✨',
  '⚡',
  '🔥',
  '💯',
  '✅',
  '❌',
  '⚠️',
  '💡',
  '🎉',
  '🎊',
  '🏆',
  '🥇',
  '🎯',
  '📌',
  '📎',
  '🔗',
  '📝',
  '📅',
  // Nature
  '🌈',
  '☀️',
  '🌙',
  '⛅',
  '🌧️',
  '❄️',
  '🌸',
  '🌺',
  '🌻',
  '🍀',
  // Food
  '☕',
  '🍕',
  '🍔',
  '🍟',
  '🍰',
  '🎂',
  '🍺',
  '🥂',
  '🍷',
  '🧃',
  // Arrows
  '⬆️',
  '⬇️',
  '⬅️',
  '➡️',
  '↗️',
  '↘️',
  '↙️',
  '↖️',
  '↕️',
  '↔️',
];

const EmojiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  max-height: 220px;
  overflow-y: auto;
  overflow-x: hidden;
`;

const EmojiBtn = styled.button`
  background: none;
  border: none;
  font-size: 18px;
  padding: 4px;
  cursor: pointer;
  border-radius: 4px;
  line-height: 1;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${({ theme }) => theme.colors.primary100};
  }
`;

const EmojiPicker = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('EmojiPicker');
  const { formatMessage } = useIntl();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const filteredEmojis = search
    ? EMOJI_LIST.filter(() => {
        // Simple search: just filter by position to keep it lightweight
        // In a production app you'd map emoji to keywords
        return true;
      })
    : EMOJI_LIST;

  const insertEmoji = (emoji: string) => {
    Transforms.insertText(editor, emoji);
    setOpen(false);
    setSearch('');
    ReactEditor.focus(editor as ReactEditor);
  };

  const label = formatMessage({
    id: 'components.Blocks.emoji',
    defaultMessage: 'Emoji',
  });

  return (
    <Popover.Root open={open}>
      <Popover.Trigger>
        <Box
          tag="button"
          aria-label={label}
          title={label}
          aria-disabled={disabled}
          padding={1}
          hasRadius
          style={{
            background: 'none',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '18px',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            opacity: disabled ? 0.5 : 1,
          }}
          onMouseDown={(e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) setOpen((v) => !v);
          }}
        >
          😀
        </Box>
      </Popover.Trigger>
      <Popover.Content onPointerDownOutside={() => setOpen(false)}>
        <Flex direction="column" gap={2} padding={2} style={{ width: '290px' }}>
          <Field.Root>
            <Field.Input
              name="emojiSearch"
              placeholder={formatMessage({
                id: 'components.Blocks.emoji.search',
                defaultMessage: 'Search emoji...',
              })}
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearch(e.target.value)
              }
            />
          </Field.Root>
          <EmojiGrid>
            {filteredEmojis.map((emoji, i) => (
              <EmojiBtn
                key={`${emoji}-${i}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertEmoji(emoji);
                }}
              >
                {emoji}
              </EmojiBtn>
            ))}
          </EmojiGrid>
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );
};

export { EmojiPicker };
