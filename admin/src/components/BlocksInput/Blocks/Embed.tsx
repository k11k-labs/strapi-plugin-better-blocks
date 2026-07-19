import * as React from 'react';

import { Box, Flex, Typography } from '@strapi/design-system';
import { Code as CodeIcon } from '@strapi/icons';
import { type Path, Editor, Transforms } from 'slate';
import { type RenderElementProps, ReactEditor, useSelected } from 'slate-react';
import { styled } from 'styled-components';

import { type BlocksStore, useBlocksEditorContext } from '../BlocksEditor';
import { baseHandleConvert } from '../utils/conversions';
import {
  type CustomElement,
  type EmbedElement,
  type MediaAlignment,
  isEmbedNode,
} from '../utils/types';

import { type EmbedDraft, EmbedEditorModal } from './EmbedEditorModal';
import {
  buildUrlEmbed,
  detectProvider,
  getProviderLabel,
  getThumbnail,
  isEmbeddableUrl,
  toCssAspectRatio,
} from './embedProviders';

/* ---------------------------------------------------------------------------
 * Insert helper
 * -------------------------------------------------------------------------*/

const makeEmbedNode = (): EmbedElement => ({
  type: 'embed',
  source: 'url',
  aspectRatio: '16:9',
  alignment: 'center',
  children: [{ type: 'text', text: '' }],
});

/**
 * Insert a blank embed. With no `embedHtml` the block opens its editor on
 * mount, so the author lands straight in the URL field.
 */
const insertEmbed = (editor: Editor, initial?: Partial<EmbedElement>) => {
  const node = { ...makeEmbedNode(), ...initial };
  const path = baseHandleConvert<EmbedElement>(editor, node);
  if (path) {
    Transforms.removeNodes(editor, { at: path });
    Transforms.insertNodes(editor, node as unknown as CustomElement, {
      at: path,
      select: true,
    });
  }
};

/**
 * Insert a ready-to-render embed straight from a share URL — used by the
 * toolbar's media button, which takes the URL up front and so can skip the
 * modal entirely. Returns false when the URL isn't one we can embed.
 *
 * Unlike `insertEmbed`, this *appends* a node instead of converting the block
 * at the selection: the toolbar button can be pressed with any block selected,
 * and converting would silently destroy it.
 */
const insertEmbedFromUrl = (editor: Editor, url: string): boolean => {
  const trimmed = url.trim();
  const built = buildUrlEmbed(trimmed);
  if (!built) return false;

  const node: EmbedElement = {
    ...makeEmbedNode(),
    url: trimmed,
    embedHtml: built.html,
    embedSrc: built.src,
    provider: detectProvider(trimmed),
    ...(getThumbnail(trimmed) ? { thumbnail: getThumbnail(trimmed)! } : {}),
  };
  // Trailing paragraph so there's always somewhere to type after the void.
  const paragraph = {
    type: 'paragraph',
    children: [{ type: 'text', text: '' }],
  };

  Transforms.insertNodes(editor, [
    node as unknown as CustomElement,
    paragraph as unknown as CustomElement,
  ]);
  return true;
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

/** Positioning context for the badge and click shield. */
const FrameOuter = styled.div`
  position: relative;
  width: 100%;
`;

const FrameWrapper = styled.div<{ $ratio: string }>`
  width: 100%;
  aspect-ratio: ${({ $ratio }) => $ratio};
  border-radius: ${({ theme }) => theme.borderRadius};
  overflow: hidden;
  background: ${({ theme }) => theme.colors.neutral800};

  iframe {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
  }
`;

/**
 * Click shield over the live iframe. Without it the embed swallows the click
 * and the author can never re-open the editor or select the block.
 */
const ClickShield = styled.div`
  position: absolute;
  inset: 0;
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

const EMBED_KEYS = [
  'source',
  'url',
  'iframe',
  'embedHtml',
  'embedSrc',
  'provider',
  'thumbnail',
  'aspectRatio',
  'customAspectRatio',
  'alignment',
  'caption',
  'title',
];

/** Optional keys dropped from the node when the author leaves them empty. */
const OPTIONAL_KEYS = [
  'url',
  'iframe',
  'thumbnail',
  'customAspectRatio',
  'caption',
  'title',
] as const;

const EmbedElementComponent = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const el = element as unknown as EmbedElement;
  const { editor, disabled } = useBlocksEditorContext('Embed');
  const selected = useSelected();

  const hasSource = (el.embedHtml ?? '').trim() !== '';
  const [open, setOpen] = React.useState(!hasSource && !disabled);

  const align = el.alignment ?? 'center';
  const cssRatio =
    el.aspectRatio === 'custom'
      ? el.customAspectRatio || '16 / 9'
      : toCssAspectRatio(el.aspectRatio);

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
      Transforms.unsetNodes(editor, EMBED_KEYS, { at: path });
    } else {
      Transforms.removeNodes(editor, { at: path });
    }
  };

  const handleSave = (draft: EmbedDraft) => {
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
              e.preventDefault();
              if (!disabled) setOpen(true);
            }}
          >
            <FrameOuter>
              <FrameWrapper
                $ratio={cssRatio}
                // Safe: embedHtml is rebuilt from an attribute allowlist in
                // embedProviders.sanitizeIframe / buildUrlEmbed, never raw input.
                dangerouslySetInnerHTML={{ __html: el.embedHtml as string }}
              />
              <ProviderBadge>{getProviderLabel(el.provider)}</ProviderBadge>
              <ClickShield />
            </FrameOuter>
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
            <CodeIcon />
            <Typography variant="pi">
              Embed — click to add a URL or embed code.
            </Typography>
          </EmptyState>
        )}
      </AlignWrapper>

      {open && !disabled ? (
        <EmbedEditorModal
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
 * Plugin: embed nodes are void blocks
 * -------------------------------------------------------------------------*/

const withEmbed = (editor: Editor): Editor => {
  const { isVoid } = editor;
  editor.isVoid = (element) =>
    isEmbedNode(element as CustomElement) ? true : isVoid(element);
  return editor;
};

/* ---------------------------------------------------------------------------
 * Block definition
 * -------------------------------------------------------------------------*/

const embedBlocks: Pick<BlocksStore, 'embed'> = {
  embed: {
    renderElement: (props) => <EmbedElementComponent {...props} />,
    icon: CodeIcon,
    label: {
      id: 'components.Blocks.blocks.embed',
      defaultMessage: 'Embed',
    },
    matchNode: (node) => (node as { type?: string }).type === 'embed',
    isInBlocksSelector: true,
    handleConvert(editor) {
      insertEmbed(editor);
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

export {
  embedBlocks,
  withEmbed,
  insertEmbed,
  insertEmbedFromUrl,
  isEmbeddableUrl,
};
