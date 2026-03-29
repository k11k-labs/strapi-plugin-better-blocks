import * as React from 'react';
import {
  Box,
  Flex,
  Popover,
  SingleSelect,
  SingleSelectOption,
} from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { styled } from 'styled-components';

import { useBlocksEditorContext } from './BlocksEditor';
import { SpecialCharIcon } from './FontModifiersIcons';

const CATEGORIES: Record<string, string[]> = {
  Currency: ['$', '€', '£', '¥', '₹', '₿', '¢', '₽', '₩', '₺'],
  Math: [
    '±',
    '×',
    '÷',
    '≠',
    '≈',
    '≤',
    '≥',
    '∞',
    '√',
    '∑',
    'π',
    'µ',
    '∆',
    '∫',
    '∂',
    '≡',
    '∈',
    '∉',
    '⊂',
    '⊃',
  ],
  Arrows: [
    '←',
    '→',
    '↑',
    '↓',
    '↔',
    '↕',
    '⇐',
    '⇒',
    '⇑',
    '⇓',
    '⇔',
    '↩',
    '↪',
    '➜',
    '➤',
    '➔',
  ],
  Legal: ['©', '®', '™', '§', '¶', '†', '‡', '•', '°', '‰'],
  Punctuation: [
    '–',
    '—',
    '…',
    '«',
    '»',
    '‹',
    '›',
    '\u201C',
    '\u201D',
    '\u2018',
    '\u2019',
    '¡',
    '¿',
    '‽',
    '※',
  ],
  Greek: [
    'α',
    'β',
    'γ',
    'δ',
    'ε',
    'ζ',
    'η',
    'θ',
    'λ',
    'μ',
    'ξ',
    'σ',
    'τ',
    'φ',
    'ψ',
    'ω',
    'Ω',
    'Σ',
    'Δ',
    'Π',
  ],
  Fractions: ['½', '⅓', '⅔', '¼', '¾', '⅕', '⅙', '⅛'],
  Misc: [
    '♠',
    '♣',
    '♥',
    '♦',
    '★',
    '☆',
    '♩',
    '♪',
    '♫',
    '✓',
    '✗',
    '✠',
    '☺',
    '☹',
    '⚡',
    '☎',
  ],
};

const CharGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
  overflow-x: hidden;
`;

const CharBtn = styled.button`
  background: ${({ theme }) => theme.colors.neutral100};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  font-size: 15px;
  cursor: pointer;
  border-radius: ${({ theme }) => theme.borderRadius};
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;

  &:hover {
    background: ${({ theme }) => theme.colors.primary100};
    border-color: ${({ theme }) => theme.colors.primary600};
    color: ${({ theme }) => theme.colors.primary600};
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const SpecialCharPicker = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('SpecialCharPicker');
  const { formatMessage } = useIntl();
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState('Currency');

  const insertChar = (char: string) => {
    Transforms.insertText(editor, char);
    ReactEditor.focus(editor as ReactEditor);
  };

  const label = formatMessage({
    id: 'components.Blocks.specialChars',
    defaultMessage: 'Special characters',
  });

  return (
    <Popover.Root open={open}>
      <Popover.Trigger>
        <Box
          tag="button"
          aria-label={label}
          title={label}
          aria-disabled={disabled}
          hasRadius
          style={{
            background: 'none',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
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
          <SpecialCharIcon fill={disabled ? 'neutral300' : 'neutral600'} />
        </Box>
      </Popover.Trigger>
      <Popover.Content onPointerDownOutside={() => setOpen(false)}>
        <Flex direction="column" gap={2} padding={3} style={{ width: '290px' }}>
          <Box width="100%">
            <SingleSelect
              value={category}
              onChange={(val: unknown) => setCategory(val as string)}
            >
              {Object.keys(CATEGORIES).map((cat) => (
                <SingleSelectOption key={cat} value={cat}>
                  {cat}
                </SingleSelectOption>
              ))}
            </SingleSelect>
          </Box>
          <CharGrid>
            {(CATEGORIES[category] || []).map((char, i) => (
              <CharBtn
                key={`${char}-${i}`}
                title={char}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertChar(char);
                }}
              >
                {char}
              </CharBtn>
            ))}
          </CharGrid>
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );
};

export { SpecialCharPicker };
