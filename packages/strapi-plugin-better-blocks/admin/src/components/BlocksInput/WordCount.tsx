import * as React from 'react';
import { Flex, Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { Editor, Node } from 'slate';
import { useSlate } from 'slate-react';
import { styled } from 'styled-components';

const CounterBar = styled(Flex)`
  border-top: 1px solid ${({ theme }) => theme.colors.neutral200};
  background: ${({ theme }) => theme.colors.neutral100};
  flex-shrink: 0;
`;

const getEditorText = (editor: Editor): string => {
  return Array.from(Node.texts(editor))
    .map(([node]) => node.text)
    .join(' ');
};

const WordCount = () => {
  const editor = useSlate();
  const { formatMessage } = useIntl();

  const text = getEditorText(editor);
  const trimmedText = text.trim();
  const characterCount = trimmedText.length;
  const wordCount = trimmedText === '' ? 0 : trimmedText.split(/\s+/).length;

  return (
    <CounterBar
      padding={2}
      paddingLeft={4}
      paddingRight={4}
      justifyContent="flex-end"
      gap={4}
      width="100%"
    >
      <Typography variant="pi" textColor="neutral600">
        {formatMessage(
          {
            id: 'components.Blocks.wordCount',
            defaultMessage: '{count} {count, plural, one {word} other {words}}',
          },
          { count: wordCount }
        )}
      </Typography>
      <Typography variant="pi" textColor="neutral600">
        {formatMessage(
          {
            id: 'components.Blocks.characterCount',
            defaultMessage:
              '{count} {count, plural, one {character} other {characters}}',
          },
          { count: characterCount }
        )}
      </Typography>
    </CounterBar>
  );
};

export { WordCount };
