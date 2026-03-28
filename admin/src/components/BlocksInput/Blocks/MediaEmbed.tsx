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

const getThumbnailUrl = (url: string): string | null => {
  const ytMatch = url.match(YOUTUBE_REGEX);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;

  // Vimeo thumbnails require an API call, use a placeholder instead
  const vimeoMatch = url.match(VIMEO_REGEX);
  if (vimeoMatch) return null;

  return null;
};

const getVideoProvider = (url: string): string => {
  if (YOUTUBE_REGEX.test(url)) return 'YouTube';
  if (VIMEO_REGEX.test(url)) return 'Vimeo';
  return 'Video';
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

const PreviewWrapper = styled(Box)`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  margin: ${({ theme }) => theme.spaces[2]} 0;
  border-radius: ${({ theme }) => theme.borderRadius};
  overflow: hidden;
  background: ${({ theme }) => theme.colors.neutral900};
  cursor: default;
`;

const ThumbnailImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.85;
`;

const PlayOverlay = styled(Flex)`
  position: absolute;
  inset: 0;
  align-items: center;
  justify-content: center;
  pointer-events: none;
`;

const PlayCircle = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;

  &::after {
    content: '';
    display: block;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 12px 0 12px 22px;
    border-color: transparent transparent transparent white;
    margin-left: 4px;
  }
`;

const ProviderBadge = styled.div`
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
`;

const UrlLabel = styled.div`
  position: absolute;
  bottom: 8px;
  left: 8px;
  right: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const NoThumbnailPlaceholder = styled(Flex)`
  width: 100%;
  height: 100%;
  background: ${({ theme }) => theme.colors.neutral200};
  color: ${({ theme }) => theme.colors.neutral600};
  font-size: 14px;
`;

/* ---------------------------------------------------------------------------
 * Components
 * -------------------------------------------------------------------------*/

const MediaEmbedElement = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const originalUrl = (element as any).originalUrl || '';
  const thumbnailUrl = getThumbnailUrl(originalUrl);
  const provider = getVideoProvider(originalUrl);

  return (
    <div {...attributes} contentEditable={false}>
      <PreviewWrapper>
        {thumbnailUrl ? (
          <ThumbnailImg src={thumbnailUrl} alt={`${provider} video`} />
        ) : (
          <NoThumbnailPlaceholder alignItems="center" justifyContent="center">
            {provider} Video
          </NoThumbnailPlaceholder>
        )}
        <PlayOverlay>
          <PlayCircle />
        </PlayOverlay>
        <ProviderBadge>{provider}</ProviderBadge>
        {originalUrl && <UrlLabel>{originalUrl}</UrlLabel>}
      </PreviewWrapper>
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
