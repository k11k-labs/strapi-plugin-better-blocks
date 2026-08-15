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
  min-width: 32px;
  text-align: right;
`;

const NavBtn = styled.button`
  background: ${({ theme }) => theme.colors.neutral100};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.neutral600};
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primary100};
    color: ${({ theme }) => theme.colors.primary600};
    border-color: ${({ theme }) => theme.colors.primary200};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

/* ---------------------------------------------------------------------------
 * Search context — shared with BlocksContent for highlight decorations
 * -------------------------------------------------------------------------*/

/**
 * Get the current search text stored on the editor.
 * Used by BlocksContent decorate function to highlight matches.
 */
const getSearchText = (editor: any): string => editor.__findReplaceSearch || '';

/**
 * Decorate function for highlighting search matches.
 * Call this from BlocksContent's decorate prop.
 */
const decorateSearchMatches = (editor: any) => {
  const search = getSearchText(editor);
  if (!search) return () => [] as Range[];

  const searchLower = search.toLowerCase();
  const activeIndex: number = (editor as any).__findReplaceActiveIndex ?? 0;

  // Count matches globally to know which one is "active"
  let globalMatchCounter = 0;

  return ([node, path]: [any, number[]]): Range[] => {
    if (!Text.isText(node)) return [];
    const ranges: Range[] = [];
    const textLower = node.text.toLowerCase();
    let offset = 0;
    while (true) {
      const index = textLower.indexOf(searchLower, offset);
      if (index === -1) break;
      const isActive = globalMatchCounter === activeIndex;
      ranges.push({
        anchor: { path, offset: index },
        focus: { path, offset: index + search.length },
        searchHighlight: true,
        searchHighlightActive: isActive,
      } as any);
      globalMatchCounter++;
      offset = index + 1;
    }
    return ranges;
  };
};

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

  // Store search text + active index on editor and force Slate to re-decorate
  React.useEffect(() => {
    (editor as any).__findReplaceSearch = open ? searchText : '';
    (editor as any).__findReplaceActiveIndex = currentMatch;
    editor.onChange();
  }, [editor, searchText, open, currentMatch]);

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
        <Flex direction="column" gap={3} padding={4} style={{ width: '360px' }}>
          {/* Header */}
          <Box
            style={{ fontWeight: 600, fontSize: '14px', textAlign: 'center' }}
          >
            {formatMessage({
              id: 'components.Blocks.findReplace.title',
              defaultMessage: 'Find and replace',
            })}
          </Box>

          {/* Find row */}
          <Flex gap={2} alignItems="center">
            <Field.Root style={{ flex: 1 }}>
              <Field.Input
                ref={searchInputRef}
                name="find"
                placeholder={formatMessage({
                  id: 'components.Blocks.find.placeholder',
                  defaultMessage: 'Find in text...',
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
            <NavBtn
              title="Previous"
              disabled={matchCount === 0}
              onMouseDown={(e: React.MouseEvent) => {
                e.preventDefault();
                handlePrev();
              }}
            >
              &#9650;
            </NavBtn>
            <NavBtn
              title="Next"
              disabled={matchCount === 0}
              onMouseDown={(e: React.MouseEvent) => {
                e.preventDefault();
                handleNext();
              }}
            >
              &#9660;
            </NavBtn>
            <CountBadge>
              {searchText
                ? `${matchCount > 0 ? currentMatch + 1 : 0}/${matchCount}`
                : ''}
            </CountBadge>
          </Flex>

          {/* Replace row */}
          <Field.Root width="100%">
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

          {/* Actions row */}
          <Flex justifyContent="flex-end" gap={2}>
            <Button
              variant="tertiary"
              size="S"
              onClick={handleReplaceAll}
              disabled={matchCount === 0}
            >
              Replace all
            </Button>
            <Button
              variant="tertiary"
              size="S"
              onClick={handleReplace}
              disabled={matchCount === 0}
            >
              Replace
            </Button>
            <Button size="S" onClick={handleNext} disabled={matchCount === 0}>
              Find
            </Button>
          </Flex>
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );
};

export { FindReplace, decorateSearchMatches };
