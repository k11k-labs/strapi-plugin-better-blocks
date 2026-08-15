import * as React from 'react';
import { Box, Flex, Popover, Field } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { styled } from 'styled-components';

import { useBlocksEditorContext } from './BlocksEditor';

const EMOJI_LIST: { emoji: string; keywords: string }[] = [
  // Smileys
  { emoji: '😀', keywords: 'grinning happy smile face' },
  { emoji: '😃', keywords: 'smile happy joy face' },
  { emoji: '😄', keywords: 'smile happy joy face eyes' },
  { emoji: '😁', keywords: 'beaming grin happy face' },
  { emoji: '😆', keywords: 'laugh happy face' },
  { emoji: '😅', keywords: 'sweat laugh relief face' },
  { emoji: '🤣', keywords: 'rofl laugh rolling floor' },
  { emoji: '😂', keywords: 'joy tears laugh cry' },
  { emoji: '🙂', keywords: 'slight smile face' },
  { emoji: '😉', keywords: 'wink face' },
  { emoji: '😊', keywords: 'blush smile happy face' },
  { emoji: '😇', keywords: 'halo angel innocent face' },
  { emoji: '🥰', keywords: 'love hearts smile face' },
  { emoji: '😍', keywords: 'love heart eyes face' },
  { emoji: '🤩', keywords: 'star struck excited face' },
  { emoji: '😘', keywords: 'kiss face love' },
  { emoji: '😗', keywords: 'kiss face' },
  { emoji: '😚', keywords: 'kiss closed eyes face' },
  { emoji: '😋', keywords: 'yum tongue tasty face' },
  { emoji: '😛', keywords: 'tongue face' },
  { emoji: '😜', keywords: 'wink tongue face' },
  { emoji: '🤪', keywords: 'zany crazy face' },
  { emoji: '😝', keywords: 'tongue squinting face' },
  { emoji: '🤑', keywords: 'money dollar face rich' },
  { emoji: '🤗', keywords: 'hug hands face' },
  { emoji: '🤭', keywords: 'oops hand mouth face' },
  { emoji: '🤫', keywords: 'shush quiet silence face' },
  { emoji: '🤔', keywords: 'thinking think face' },
  { emoji: '🤐', keywords: 'zipper mouth silence face' },
  { emoji: '🤨', keywords: 'raised eyebrow suspicious face' },
  { emoji: '😐', keywords: 'neutral face' },
  { emoji: '😑', keywords: 'expressionless face' },
  { emoji: '😶', keywords: 'no mouth face speechless' },
  { emoji: '😏', keywords: 'smirk face' },
  { emoji: '😒', keywords: 'unamused face' },
  { emoji: '🙄', keywords: 'eye roll face' },
  { emoji: '😬', keywords: 'grimace face' },
  { emoji: '😮', keywords: 'open mouth face surprise' },
  { emoji: '😯', keywords: 'hushed face surprise' },
  { emoji: '😲', keywords: 'astonished face surprise' },
  { emoji: '😳', keywords: 'flushed blush face' },
  { emoji: '🥺', keywords: 'pleading puppy eyes face' },
  { emoji: '😢', keywords: 'cry tear face sad' },
  { emoji: '😭', keywords: 'sob cry loud face sad' },
  { emoji: '😤', keywords: 'triumph huff face angry' },
  { emoji: '😠', keywords: 'angry mad face' },
  { emoji: '😡', keywords: 'rage angry mad face pouting' },
  { emoji: '🤬', keywords: 'swear curse face angry' },
  { emoji: '😈', keywords: 'devil imp face evil' },
  { emoji: '👿', keywords: 'angry devil face evil' },
  // Gestures
  { emoji: '👍', keywords: 'thumbs up yes good ok' },
  { emoji: '👎', keywords: 'thumbs down no bad' },
  { emoji: '👌', keywords: 'ok hand perfect' },
  { emoji: '✌️', keywords: 'peace victory' },
  { emoji: '🤞', keywords: 'crossed fingers luck' },
  { emoji: '🤟', keywords: 'love you hand' },
  { emoji: '🤘', keywords: 'rock horns metal' },
  { emoji: '👊', keywords: 'fist punch bump' },
  { emoji: '✊', keywords: 'raised fist power' },
  { emoji: '🤛', keywords: 'left fist punch bump' },
  { emoji: '👏', keywords: 'clap hands applause' },
  { emoji: '🙌', keywords: 'raising hands celebrate' },
  { emoji: '👐', keywords: 'open hands' },
  { emoji: '🤲', keywords: 'palms up hands' },
  { emoji: '🤝', keywords: 'handshake agreement deal' },
  { emoji: '🙏', keywords: 'pray thanks please hands' },
  { emoji: '💪', keywords: 'muscle strong flex' },
  { emoji: '🦾', keywords: 'mechanical arm muscle' },
  { emoji: '🖐️', keywords: 'hand fingers splayed' },
  { emoji: '✋', keywords: 'hand stop raised' },
  // Hearts & symbols
  { emoji: '❤️', keywords: 'red heart love' },
  { emoji: '🧡', keywords: 'orange heart love' },
  { emoji: '💛', keywords: 'yellow heart love' },
  { emoji: '💚', keywords: 'green heart love' },
  { emoji: '💙', keywords: 'blue heart love' },
  { emoji: '💜', keywords: 'purple heart love' },
  { emoji: '🖤', keywords: 'black heart love' },
  { emoji: '🤍', keywords: 'white heart love' },
  { emoji: '💔', keywords: 'broken heart sad' },
  { emoji: '💕', keywords: 'two hearts love' },
  { emoji: '⭐', keywords: 'star' },
  { emoji: '🌟', keywords: 'glowing star sparkle' },
  { emoji: '✨', keywords: 'sparkles stars' },
  { emoji: '⚡', keywords: 'lightning zap electric' },
  { emoji: '🔥', keywords: 'fire flame hot' },
  { emoji: '💯', keywords: '100 hundred perfect' },
  { emoji: '✅', keywords: 'check mark done yes' },
  { emoji: '❌', keywords: 'cross x no wrong' },
  { emoji: '⚠️', keywords: 'warning alert caution' },
  { emoji: '💡', keywords: 'idea bulb light' },
  { emoji: '🎉', keywords: 'party popper celebrate' },
  { emoji: '🎊', keywords: 'confetti celebrate' },
  { emoji: '🏆', keywords: 'trophy win award' },
  { emoji: '🥇', keywords: 'gold medal first win' },
  { emoji: '🎯', keywords: 'target bullseye dart' },
  { emoji: '📌', keywords: 'pin pushpin' },
  { emoji: '📎', keywords: 'paperclip attachment' },
  { emoji: '🔗', keywords: 'link chain' },
  { emoji: '📝', keywords: 'note memo write' },
  { emoji: '📅', keywords: 'calendar date' },
  // Nature
  { emoji: '🌈', keywords: 'rainbow colors' },
  { emoji: '☀️', keywords: 'sun sunny bright' },
  { emoji: '🌙', keywords: 'moon night' },
  { emoji: '⛅', keywords: 'sun cloud weather' },
  { emoji: '🌧️', keywords: 'rain cloud weather' },
  { emoji: '❄️', keywords: 'snowflake snow cold winter' },
  { emoji: '🌸', keywords: 'cherry blossom flower' },
  { emoji: '🌺', keywords: 'hibiscus flower' },
  { emoji: '🌻', keywords: 'sunflower flower' },
  { emoji: '🍀', keywords: 'clover luck four leaf' },
  // Food
  { emoji: '☕', keywords: 'coffee hot drink' },
  { emoji: '🍕', keywords: 'pizza food' },
  { emoji: '🍔', keywords: 'burger hamburger food' },
  { emoji: '🍟', keywords: 'fries french food' },
  { emoji: '🍰', keywords: 'cake slice dessert' },
  { emoji: '🎂', keywords: 'birthday cake' },
  { emoji: '🍺', keywords: 'beer drink' },
  { emoji: '🥂', keywords: 'clink toast champagne' },
  { emoji: '🍷', keywords: 'wine glass drink' },
  { emoji: '🧃', keywords: 'juice box drink' },
  // Arrows
  { emoji: '⬆️', keywords: 'up arrow' },
  { emoji: '⬇️', keywords: 'down arrow' },
  { emoji: '⬅️', keywords: 'left arrow' },
  { emoji: '➡️', keywords: 'right arrow' },
  { emoji: '↗️', keywords: 'up right arrow' },
  { emoji: '↘️', keywords: 'down right arrow' },
  { emoji: '↙️', keywords: 'down left arrow' },
  { emoji: '↖️', keywords: 'up left arrow' },
  { emoji: '↕️', keywords: 'up down arrow' },
  { emoji: '↔️', keywords: 'left right arrow' },
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

  const query = search.trim().toLowerCase();
  const filteredEmojis = query
    ? EMOJI_LIST.filter((e) => e.keywords.includes(query))
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
            {filteredEmojis.map(({ emoji }, i) => (
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
