import * as React from 'react';

import { Box, Flex, Typography } from '@strapi/design-system';
import { Play } from '@strapi/icons';
import { type Path, Editor, Transforms } from 'slate';
import { type RenderElementProps, ReactEditor, useSelected } from 'slate-react';
import { styled } from 'styled-components';

import { type BlocksStore, useBlocksEditorContext } from '../BlocksEditor';
import { baseHandleConvert } from '../utils/conversions';
import {
  type CustomElement,
  type MediaAlignment,
  type VideoElement,
  isVideoNode,
} from '../utils/types';

import { toCssAspectRatio } from './embedProviders';
import {
  type VideoDraft,
  DEFAULT_VIDEO_PLAYER,
  VideoEditorModal,
  formatBytes,
} from './VideoEditorModal';
import { VIDEO_PROVIDER_LABELS, isStreamingUrl } from './videoProviders';

/* ---------------------------------------------------------------------------
 * Insert helper
 * -------------------------------------------------------------------------*/

const makeVideoNode = (): VideoElement => ({
  type: 'video',
  provider: 'local',
  url: '',
  player: { ...DEFAULT_VIDEO_PLAYER },
  alignment: 'center',
  aspectRatio: '16:9',
  children: [{ type: 'text', text: '' }],
});

const insertVideo = (editor: Editor) => {
  // Re-insert a clean node (mirrors Audio/Social) so no stale text lingers in
  // the void's children. The empty `url` makes the block open its editor on
  // mount.
  const path = baseHandleConvert<VideoElement>(editor, makeVideoNode());
  if (path) {
    Transforms.removeNodes(editor, { at: path });
    Transforms.insertNodes(
      editor,
      makeVideoNode() as unknown as CustomElement,
      {
        at: path,
        select: true,
      }
    );
  }
};

/* ---------------------------------------------------------------------------
 * Styled in-editor preview
 * -------------------------------------------------------------------------*/

const AlignWrapper = styled.div<{ $align: MediaAlignment }>`
  margin: ${({ theme }) => theme.spaces[2]} 0;
  display: flex;
  justify-content: ${({ $align }) =>
    $align === 'left'
      ? 'flex-start'
      : $align === 'right'
        ? 'flex-end'
        : $align === 'none'
          ? 'stretch'
          : 'center'};
`;

const Card = styled.div<{ $selected: boolean; $full: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spaces[2]};
  width: ${({ $full }) => ($full ? '100%' : 'min(100%, 640px)')};
  cursor: pointer;
  user-select: none;
  border-radius: ${({ theme }) => theme.borderRadius};
  box-shadow: ${({ theme, $selected }) =>
    $selected ? `0 0 0 3px ${theme.colors.primary600}` : 'none'};
`;

const Frame = styled.div<{ $ratio: string }>`
  position: relative;
  width: 100%;
  aspect-ratio: ${({ $ratio }) => $ratio};
  border-radius: ${({ theme }) => theme.borderRadius};
  overflow: hidden;
  background: ${({ theme }) => theme.colors.neutral800};

  video,
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
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
  pointer-events: none;
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

const NoPoster = styled(Flex)`
  width: 100%;
  height: 100%;
  color: ${({ theme }) => theme.colors.neutral200};
  font-size: 14px;
`;

const EmptyState = styled(Flex)`
  width: min(100%, 640px);
  padding: ${({ theme }) => theme.spaces[4]};
  border: 1px dashed ${({ theme }) => theme.colors.neutral300};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral100};
  color: ${({ theme }) => theme.colors.neutral600};
`;

/* ---------------------------------------------------------------------------
 * Element component
 * -------------------------------------------------------------------------*/

const VIDEO_KEYS = [
  'provider',
  'assetId',
  'playbackId',
  'url',
  'file',
  'poster',
  'title',
  'caption',
  'transcript',
  'player',
  'alignment',
  'aspectRatio',
  'customAspectRatio',
];

/** Optional keys dropped from the node when the author leaves them empty. */
const OPTIONAL_KEYS = [
  'assetId',
  'playbackId',
  'file',
  'poster',
  'title',
  'caption',
  'transcript',
  'customAspectRatio',
] as const;

const VideoElementComponent = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const el = element as unknown as VideoElement;
  const { editor, disabled } = useBlocksEditorContext('Video');
  const selected = useSelected();

  const hasSource = (el.url ?? '').trim() !== '';
  const [open, setOpen] = React.useState(!hasSource && !disabled);

  const align = el.alignment ?? 'center';
  const cssRatio =
    el.aspectRatio === 'custom'
      ? el.customAspectRatio || '16 / 9'
      : toCssAspectRatio(el.aspectRatio);
  // HLS/DASH can't play in a bare <video>, so those show the poster instead.
  const streaming = hasSource && isStreamingUrl(el.url);

  const getPath = (): Path | null => {
    try {
      return ReactEditor.findPath(editor as ReactEditor, el);
    } catch {
      return null;
    }
  };

  const removeNode = () => {
    const path = getPath();
    if (!path) return;
    if (editor.children.length === 1) {
      Transforms.setNodes(
        editor,
        { type: 'paragraph' } as Partial<CustomElement>,
        { at: path }
      );
      Transforms.unsetNodes(editor, VIDEO_KEYS, { at: path });
    } else {
      Transforms.removeNodes(editor, { at: path });
    }
  };

  const handleSave = (draft: VideoDraft) => {
    const path = getPath();
    if (path) {
      Transforms.setNodes(editor, draft as unknown as Partial<CustomElement>, {
        at: path,
      });
      // Keep the stored JSON clean for renderers: no empty-string keys.
      const unset = OPTIONAL_KEYS.filter(
        (k) => draft[k] === undefined || draft[k] === ''
      );
      if (unset.length)
        Transforms.unsetNodes(editor, unset as unknown as string[], {
          at: path,
        });
    }
    setOpen(false);
    ReactEditor.focus(editor as ReactEditor);
  };

  const handleRemove = () => {
    removeNode();
    setOpen(false);
    ReactEditor.focus(editor as ReactEditor);
  };

  const handleClose = () => {
    // Discard a block the author never gave a source.
    if (!hasSource) removeNode();
    setOpen(false);
  };

  return (
    <Box {...attributes}>
      {children}
      <AlignWrapper $align={align} contentEditable={false}>
        {hasSource ? (
          <Card
            $selected={selected}
            $full={align === 'none'}
            onMouseDown={(e) => {
              // Let clicks on the native player reach it; open the editor only
              // when the card chrome (not the <video>) is clicked.
              if ((e.target as HTMLElement).closest('video')) return;
              e.preventDefault();
              if (!disabled) setOpen(true);
            }}
          >
            <Frame $ratio={cssRatio}>
              {streaming ? (
                <>
                  {el.poster ? (
                    <img src={el.poster} alt={el.title || 'Video poster'} />
                  ) : (
                    <NoPoster alignItems="center" justifyContent="center">
                      {VIDEO_PROVIDER_LABELS[el.provider] ?? 'Video'}
                    </NoPoster>
                  )}
                  <PlayOverlay>
                    <PlayCircle />
                  </PlayOverlay>
                </>
              ) : (
                <video
                  key={el.url}
                  src={el.url}
                  poster={el.poster}
                  controls={el.player?.controls ?? true}
                  loop={el.player?.loop ?? false}
                  muted={el.player?.muted ?? false}
                  preload="metadata"
                />
              )}
              <ProviderBadge>
                {VIDEO_PROVIDER_LABELS[el.provider] ?? 'Video'}
              </ProviderBadge>
            </Frame>

            {el.file?.size ? (
              <Typography variant="pi" textColor="neutral500">
                {formatBytes(el.file.size)}
                {el.file.mime ? ` · ${el.file.mime}` : ''}
              </Typography>
            ) : null}

            {el.caption ? (
              <Typography
                variant="pi"
                textColor="neutral600"
                fontWeight="semiBold"
              >
                {el.caption}
              </Typography>
            ) : null}
          </Card>
        ) : (
          <EmptyState alignItems="center" gap={2}>
            <Play />
            <Typography variant="pi">
              Video — click to choose a file, paste a URL, or add a Mux playback
              ID.
            </Typography>
          </EmptyState>
        )}
      </AlignWrapper>

      {open && !disabled ? (
        <VideoEditorModal
          open
          element={el}
          onSave={handleSave}
          onRemove={handleRemove}
          onClose={handleClose}
        />
      ) : null}
    </Box>
  );
};

/* ---------------------------------------------------------------------------
 * Plugin: video nodes are void blocks
 * -------------------------------------------------------------------------*/

const withVideo = (editor: Editor): Editor => {
  const { isVoid } = editor;
  editor.isVoid = (element) =>
    isVideoNode(element as CustomElement) ? true : isVoid(element);
  return editor;
};

/* ---------------------------------------------------------------------------
 * Block definition
 * -------------------------------------------------------------------------*/

const videoBlocks: Pick<BlocksStore, 'video'> = {
  video: {
    renderElement: (props) => <VideoElementComponent {...props} />,
    icon: Play,
    label: {
      id: 'components.Blocks.blocks.video',
      defaultMessage: 'Video',
    },
    matchNode: (node) => (node as { type?: string }).type === 'video',
    isInBlocksSelector: true,
    handleConvert(editor) {
      insertVideo(editor);
    },
    handleBackspaceKey(editor) {
      if (editor.children.length === 1) {
        Transforms.setNodes(editor, {
          type: 'paragraph',
        } as Partial<CustomElement>);
      } else {
        Transforms.removeNodes(editor);
      }
    },
    handleEnterKey(editor) {
      Transforms.insertNodes(editor, {
        type: 'paragraph',
        children: [{ type: 'text', text: '' }],
      } as unknown as CustomElement);
    },
  },
};

export { videoBlocks, withVideo, insertVideo };
