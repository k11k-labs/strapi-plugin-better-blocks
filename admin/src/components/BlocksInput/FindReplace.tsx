import * as React from 'react';
import { Box, Button, Field, Flex, Popover } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { Editor, Node, Range, Transforms, Text } from 'slate';
import { ReactEditor } from 'slate-react';
import { styled } from 'styled-components';

import { useBlocksEditorContext } from './BlocksEditor';

const SearchIcon = ({
  fill,
  ...props
}: React.SVGProps<SVGSVGElement> & { fill?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" {...props} fill="none">
    <circle cx="11" cy="11" r="6" stroke={fill || '#666687'} strokeWidth="2" />
    <path
      d="M15.5 15.5L20 20"
      stroke={fill || '#666687'}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const CountBadge = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.neutral600};
  white-space: nowrap;
`;

const FindReplace = ({ disabled }: { disabled: boolean }) => {
  const { editor } = useBlocksEditorContext('FindReplace');
  const { formatMessage } = useIntl();
  const [open, setOpen] = React.useState(false);
  const [searchText, setSearchText] = React.useState('');
  const [replaceText, setReplaceText] = React.useState('');
  const [matchCount, setMatchCount] = React.useState(0);
  const [currentMatch, setCurrentMatch] = React.useState(0);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const findMatches = React.useCallback((): Array<{
    path: number[];
    offset: number;
  }> => {
    if (!searchText) return [];
    const matches: Array<{ path: number[]; offset: number }> = [];
    const searchLower = searchText.toLowerCase();

    for (const [node, path] of Node.texts(editor)) {
      const textLower = node.text.toLowerCase();
      let offset = 0;
      while (true) {
        const index = textLower.indexOf(searchLower, offset);
        if (index === -1) break;
        matches.push({ path: path as number[], offset: index });
        offset = index + 1;
      }
    }
    return matches;
  }, [editor, searchText]);

  React.useEffect(() => {
    const matches = findMatches();
    setMatchCount(matches.length);
    if (matches.length > 0 && currentMatch >= matches.length) {
      setCurrentMatch(0);
    }
  }, [searchText, findMatches, currentMatch]);

  React.useEffect(() => {
    if (open) searchInputRef.current?.focus();
  }, [open]);

  const goToMatch = (index: number) => {
    const matches = findMatches();
    if (matches.length === 0) return;
    const match = matches[index % matches.length];
    const anchor = { path: match.path, offset: match.offset };
    const focus = {
      path: match.path,
      offset: match.offset + searchText.length,
    };
    Transforms.select(editor, { anchor, focus });
    setCurrentMatch(index % matches.length);
  };

  const handleNext = () => goToMatch(currentMatch + 1);
  const handlePrev = () =>
    goToMatch(currentMatch - 1 < 0 ? matchCount - 1 : currentMatch - 1);

  const handleReplace = () => {
    const matches = findMatches();
    if (matches.length === 0) return;
    const match = matches[currentMatch % matches.length];
    const anchor = { path: match.path, offset: match.offset };
    const focus = {
      path: match.path,
      offset: match.offset + searchText.length,
    };
    Transforms.select(editor, { anchor, focus });
    Transforms.insertText(editor, replaceText);
  };

  const handleReplaceAll = () => {
    const matches = findMatches();
    if (matches.length === 0) return;
    // Replace in reverse order to keep paths stable
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const anchor = { path: match.path, offset: match.offset };
      const focus = {
        path: match.path,
        offset: match.offset + searchText.length,
      };
      Transforms.select(editor, { anchor, focus });
      Transforms.insertText(editor, replaceText);
    }
  };

  const label = formatMessage({
    id: 'components.Blocks.findReplace',
    defaultMessage: 'Find and replace',
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
          <SearchIcon fill={disabled ? '#a5a5ba' : '#666687'} />
        </Box>
      </Popover.Trigger>
      <Popover.Content onPointerDownOutside={() => setOpen(false)}>
        <Flex direction="column" gap={2} padding={3} style={{ width: '320px' }}>
          <Flex gap={2} alignItems="center">
            <Field.Root style={{ flex: 1 }}>
              <Field.Input
                ref={searchInputRef}
                name="find"
                placeholder={formatMessage({
                  id: 'components.Blocks.find.placeholder',
                  defaultMessage: 'Find...',
                })}
                value={searchText}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSearchText(e.target.value);
                  setCurrentMatch(0);
                }}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.shiftKey ? handlePrev() : handleNext();
                  }
                }}
              />
            </Field.Root>
            <CountBadge>
              {searchText
                ? `${matchCount > 0 ? currentMatch + 1 : 0}/${matchCount}`
                : ''}
            </CountBadge>
          </Flex>
          <Flex gap={1}>
            <Button
              variant="tertiary"
              size="S"
              onClick={handlePrev}
              disabled={matchCount === 0}
            >
              Prev
            </Button>
            <Button
              variant="tertiary"
              size="S"
              onClick={handleNext}
              disabled={matchCount === 0}
            >
              Next
            </Button>
          </Flex>
          <Field.Root>
            <Field.Input
              name="replace"
              placeholder={formatMessage({
                id: 'components.Blocks.replace.placeholder',
                defaultMessage: 'Replace with...',
              })}
              value={replaceText}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setReplaceText(e.target.value)
              }
            />
          </Field.Root>
          <Flex gap={1}>
            <Button
              variant="tertiary"
              size="S"
              onClick={handleReplace}
              disabled={matchCount === 0}
            >
              Replace
            </Button>
            <Button
              variant="tertiary"
              size="S"
              onClick={handleReplaceAll}
              disabled={matchCount === 0}
            >
              Replace all
            </Button>
          </Flex>
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );
};

export { FindReplace };
