import * as React from 'react';
import { Box, Button, Field, Flex, Popover } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { Editor, Transforms } from 'slate';
import {
  type RenderElementProps,
  ReactEditor,
  useSlateStatic,
} from 'slate-react';
import { styled } from 'styled-components';

import { type BlocksStore } from '../BlocksEditor';

/* ---------------------------------------------------------------------------
 * URL parsing helpers
 * -------------------------------------------------------------------------*/

const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const VIMEO_REGEX = /(?:vimeo\.com\/)(\d+)/;

const getEmbedUrl = (url: string): string | null => {
  const ytMatch = url.match(YOUTUBE_REGEX);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  const vimeoMatch = url.match(VIMEO_REGEX);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return null;
};

const isMediaUrl = (url: string): boolean => {
  return YOUTUBE_REGEX.test(url) || VIMEO_REGEX.test(url);
};

/* ---------------------------------------------------------------------------
 * Insert helper
 * -------------------------------------------------------------------------*/

const insertMediaEmbed = (editor: Editor, url: string) => {
  const embedUrl = getEmbedUrl(url);
  if (!embedUrl) return;

  const media = {
    type: 'media-embed',
    url: embedUrl,
    originalUrl: url,
    children: [{ type: 'text', text: '' }],
  };
  const paragraph = {
    type: 'paragraph',
    children: [{ type: 'text', text: '' }],
  };

  Transforms.insertNodes(editor, [media as any, paragraph as any]);
};

/* ---------------------------------------------------------------------------
 * Styled components
 * -------------------------------------------------------------------------*/

const EmbedWrapper = styled(Box)`
  position: relative;
  width: 100%;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
  margin: ${({ theme }) => theme.spaces[2]} 0;

  iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius};
  }
`;

const EmptyEmbed = styled(Flex)`
  border: 2px dashed ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: ${({ theme }) => theme.spaces[6]};
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary600};
    background: ${({ theme }) => theme.colors.primary100};
  }
`;

/* ---------------------------------------------------------------------------
 * Components
 * -------------------------------------------------------------------------*/

const MediaEmbedElement = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const embedUrl = (element as any).url;

  return (
    <div {...attributes} contentEditable={false}>
      {embedUrl ? (
        <EmbedWrapper>
          <iframe
            src={embedUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Embedded media"
          />
        </EmbedWrapper>
      ) : (
        <EmptyEmbed justifyContent="center" alignItems="center">
          No media URL
        </EmptyEmbed>
      )}
      <span style={{ display: 'none' }}>{children}</span>
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Plugin: make media-embed void
 * -------------------------------------------------------------------------*/

const withMediaEmbed = (editor: Editor): Editor => {
  const { isVoid } = editor;
  editor.isVoid = (element) => {
    return (element as any).type === 'media-embed' ? true : isVoid(element);
  };
  return editor;
};

/* ---------------------------------------------------------------------------
 * Block definitions
 * -------------------------------------------------------------------------*/

const mediaEmbedBlocks: Pick<BlocksStore, 'media-embed'> = {
  'media-embed': {
    renderElement: (props) => <MediaEmbedElement {...props} />,
    matchNode: (node) => (node as any).type === 'media-embed',
    isInBlocksSelector: false,
  },
};

export { mediaEmbedBlocks, withMediaEmbed, insertMediaEmbed, isMediaUrl };
