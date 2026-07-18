import * as React from 'react';

import { Box, Flex, Typography } from '@strapi/design-system';
import { MusicNotes } from '@strapi/icons';
import { type Path, Editor, Transforms } from 'slate';
import { type RenderElementProps, ReactEditor, useSelected } from 'slate-react';
import { styled } from 'styled-components';

import { type BlocksStore, useBlocksEditorContext } from '../BlocksEditor';
import { baseHandleConvert } from '../utils/conversions';
import {
  type AudioAlignment,
  type AudioElement,
  type CustomElement,
  isAudioNode,
} from '../utils/types';

import {
  type AudioDraft,
  AudioEditorModal,
  DEFAULT_PLAYER,
  formatBytes,
} from './AudioEditorModal';

/* ---------------------------------------------------------------------------
 * Insert helper
 * -------------------------------------------------------------------------*/

const makeAudioNode = (): AudioElement => ({
  type: 'audio',
  file: { url: '' },
  player: { ...DEFAULT_PLAYER },
  alignment: 'center',
  children: [{ type: 'text', text: '' }],
});

const insertAudio = (editor: Editor) => {
  // Re-insert a clean node (mirrors Social/Button) so no stale text lingers in
  // the void's children. The empty `file.url` makes the block open its editor
  // on mount.
  const path = baseHandleConvert<AudioElement>(editor, makeAudioNode());
  if (path) {
    Transforms.removeNodes(editor, { at: path });
    Transforms.insertNodes(
      editor,
      makeAudioNode() as unknown as CustomElement,
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

const AlignWrapper = styled.div<{ $align: AudioAlignment }>`
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

const Card = styled.div<{ $selected: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spaces[2]};
  width: min(100%, 520px);
  cursor: pointer;
  user-select: none;
  padding: ${({ theme }) => theme.spaces[3]};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-left: 4px solid ${({ theme }) => theme.colors.primary600};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral0};
  box-shadow: ${({ theme, $selected }) =>
    $selected ? `0 0 0 3px ${theme.colors.primary600}` : 'none'};
`;

const Header = styled(Flex)`
  gap: ${({ theme }) => theme.spaces[2]};
`;

const IconBadge = styled.span`
  display: inline-flex;
  color: ${({ theme }) => theme.colors.primary600};

  svg {
    width: 18px;
    height: 18px;
  }
`;

// Native player inside the void card — pointer-events kept live so the author
// can test playback without leaving the editor.
const PreviewAudio = styled.audio`
  width: 100%;
`;

const Placeholder = styled(Typography)`
  color: ${({ theme }) => theme.colors.neutral500};
`;

/* ---------------------------------------------------------------------------
 * Element component
 * -------------------------------------------------------------------------*/

const AUDIO_KEYS = ['file', 'title', 'caption', 'player', 'alignment'];

const AudioElementComponent = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const el = element as unknown as AudioElement;
  const { editor, disabled } = useBlocksEditorContext('Audio');
  const selected = useSelected();

  // A freshly inserted block (no source) opens its editor immediately.
  const [open, setOpen] = React.useState(
    (el.file?.url ?? '').trim() === '' && !disabled
  );

  const align = el.alignment ?? 'center';
  const hasSource = (el.file?.url ?? '').trim() !== '';

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
      Transforms.unsetNodes(editor, AUDIO_KEYS, { at: path });
    } else {
      Transforms.removeNodes(editor, { at: path });
    }
  };

  const handleSave = (draft: AudioDraft) => {
    const path = getPath();
    if (path) {
      Transforms.setNodes(editor, draft as unknown as Partial<CustomElement>, {
        at: path,
      });
      // Keep JSON clean: drop optional keys the author left empty.
      const unset = (['title', 'caption'] as const).filter(
        (k) => draft[k] === undefined || draft[k] === ''
      );
      if (unset.length)
        Transforms.unsetNodes(editor, unset as string[], { at: path });
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
    // Discard a block that never got a source.
    if (!hasSource) removeNode();
    setOpen(false);
  };

  return (
    <Box {...attributes}>
      {children}
      <AlignWrapper $align={align} contentEditable={false}>
        <Card
          $selected={selected}
          onMouseDown={(e) => {
            // Let clicks on the native player reach it; open the editor only
            // when the card chrome (not the <audio>) is clicked.
            if ((e.target as HTMLElement).closest('audio')) return;
            e.preventDefault();
            if (!disabled) setOpen(true);
          }}
        >
          <Header alignItems="center">
            <IconBadge>
              <MusicNotes />
            </IconBadge>
            <Typography fontWeight="bold">
              {el.title ||
                el.file?.name ||
                (hasSource ? 'Audio' : 'Audio — click to add a file')}
            </Typography>
          </Header>

          {hasSource ? (
            <PreviewAudio
              key={el.file.url}
              src={el.file.url}
              controls={el.player?.controls ?? true}
              loop={el.player?.loop ?? false}
              preload={el.player?.preload ?? 'metadata'}
            />
          ) : (
            <Placeholder variant="pi">
              No audio selected — click to choose from the Media Library or
              paste a URL.
            </Placeholder>
          )}

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
      </AlignWrapper>

      {open && !disabled ? (
        <AudioEditorModal
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
 * Plugin: audio nodes are void blocks
 * -------------------------------------------------------------------------*/

const withAudio = (editor: Editor): Editor => {
  const { isVoid } = editor;
  editor.isVoid = (element) =>
    isAudioNode(element as CustomElement) ? true : isVoid(element);
  return editor;
};

/* ---------------------------------------------------------------------------
 * Block definition
 * -------------------------------------------------------------------------*/

const audioBlocks: Pick<BlocksStore, 'audio'> = {
  audio: {
    renderElement: (props) => <AudioElementComponent {...props} />,
    icon: MusicNotes,
    label: {
      id: 'components.Blocks.blocks.audio',
      defaultMessage: 'Audio',
    },
    matchNode: (node) => (node as { type?: string }).type === 'audio',
    isInBlocksSelector: true,
    handleConvert(editor) {
      insertAudio(editor);
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
    snippets: ['[audio]'],
  },
};

export { audioBlocks, withAudio, insertAudio };
