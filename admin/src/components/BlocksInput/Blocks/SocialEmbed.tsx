import * as React from 'react';

import { Box, Flex, Typography } from '@strapi/design-system';
import { type Path, Editor, Transforms } from 'slate';
import { type RenderElementProps, ReactEditor, useSelected } from 'slate-react';
import { styled } from 'styled-components';

import { type BlocksStore, useBlocksEditorContext } from '../BlocksEditor';
import { baseHandleConvert } from '../utils/conversions';
import {
  type CustomElement,
  type SocialEmbedElement,
  type SocialPlatform,
  isSocialEmbedNode,
} from '../utils/types';

import {
  ALL_PLATFORMS,
  PLATFORM_META,
  type SocialEmbedDraft,
  SocialEmbedEditorModal,
} from './SocialEmbedEditorModal';

/* ---------------------------------------------------------------------------
 * Icon
 * -------------------------------------------------------------------------*/

const SocialIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={16}
    height={16}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.6" y1="10.7" x2="15.4" y2="6.3" />
    <line x1="8.6" y1="13.3" x2="15.4" y2="17.7" />
  </svg>
);

/* ---------------------------------------------------------------------------
 * Insert helper
 * -------------------------------------------------------------------------*/

const makeSocialNode = (
  platform: SocialPlatform = 'twitter'
): SocialEmbedElement => ({
  type: 'social-embed',
  platform,
  url: '',
  alignment: 'center',
  children: [{ type: 'text', text: '' }],
});

const insertSocialEmbed = (editor: Editor) => {
  // Re-insert a clean node (mirrors Button/Math) so no stale text lingers in the
  // void's children. The empty `url` makes the element open its editor on mount.
  const path = baseHandleConvert<SocialEmbedElement>(editor, makeSocialNode());
  if (path) {
    Transforms.removeNodes(editor, { at: path });
    Transforms.insertNodes(
      editor,
      makeSocialNode() as unknown as CustomElement,
      { at: path, select: true }
    );
  }
};

/* ---------------------------------------------------------------------------
 * Styled in-editor preview
 * -------------------------------------------------------------------------*/

const AlignWrapper = styled.div`
  margin: ${({ theme }) => theme.spaces[2]} 0;
`;

const Card = styled.div<{ $selected: boolean; $accent: string }>`
  display: inline-flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spaces[2]};
  width: min(100%, 460px);
  text-align: left;
  cursor: pointer;
  user-select: none;
  padding: ${({ theme }) => theme.spaces[3]};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-left: 4px solid ${({ $accent }) => $accent};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral0};
  box-shadow: ${({ theme, $selected }) =>
    $selected ? `0 0 0 3px ${theme.colors.primary600}` : 'none'};
`;

const Header = styled(Flex)`
  gap: ${({ theme }) => theme.spaces[2]};
`;

const PlatformBadge = styled.span<{ $color: string }>`
  font-size: 18px;
  line-height: 1;
`;

const Thumb = styled.img`
  width: 100%;
  max-height: 220px;
  object-fit: cover;
  border-radius: ${({ theme }) => theme.borderRadius};
`;

const UrlText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.neutral500};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/* ---------------------------------------------------------------------------
 * Element component
 * -------------------------------------------------------------------------*/

const SOCIAL_KEYS = [
  'platform',
  'url',
  'embedCode',
  'oembed',
  'alignment',
  'caption',
];

const getEnabledPlatforms = (editor: Editor): SocialPlatform[] => {
  const options = (
    editor as unknown as { pluginOptions?: Record<string, unknown> }
  ).pluginOptions;
  const list = options?.socialPlatforms;
  if (Array.isArray(list) && list.length > 0) {
    return list.filter((p): p is SocialPlatform =>
      (ALL_PLATFORMS as string[]).includes(p as string)
    );
  }
  return ALL_PLATFORMS;
};

const SocialEmbedElementComponent = ({
  attributes,
  children,
  element,
}: RenderElementProps) => {
  const el = element as unknown as SocialEmbedElement;
  const { editor, disabled } = useBlocksEditorContext('SocialEmbed');
  const selected = useSelected();

  // A freshly inserted embed (no URL) opens its editor immediately.
  const [open, setOpen] = React.useState(
    (el.url ?? '').trim() === '' && !disabled
  );

  const meta = PLATFORM_META[el.platform] ?? PLATFORM_META.twitter;
  const align = el.alignment ?? 'center';
  const justify =
    align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';

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
      Transforms.unsetNodes(editor, SOCIAL_KEYS, { at: path });
    } else {
      Transforms.removeNodes(editor, { at: path });
    }
  };

  const handleSave = (patch: SocialEmbedDraft) => {
    const path = getPath();
    if (path) {
      Transforms.setNodes(editor, patch as unknown as Partial<CustomElement>, {
        at: path,
      });
      // Keep JSON clean: drop keys the author left empty.
      const unset = (['embedCode', 'caption', 'oembed'] as const).filter(
        (k) => patch[k] === undefined || patch[k] === ''
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
    // Discard an embed that was never given a URL.
    if ((el.url ?? '').trim() === '') removeNode();
    setOpen(false);
  };

  return (
    <Box {...attributes}>
      {children}
      <AlignWrapper
        style={{ display: 'flex', justifyContent: justify }}
        contentEditable={false}
      >
        <Card
          $selected={selected}
          $accent={meta.color}
          onMouseDown={(e) => {
            e.preventDefault();
            if (!disabled) setOpen(true);
          }}
        >
          <Header alignItems="center">
            <PlatformBadge $color={meta.color}>{meta.icon}</PlatformBadge>
            <Typography fontWeight="bold">
              {el.oembed?.author || el.oembed?.providerName || meta.label}
            </Typography>
          </Header>
          {el.oembed?.thumbnailUrl ? (
            <Thumb src={el.oembed.thumbnailUrl} alt="" />
          ) : null}
          {el.oembed?.title ? (
            <Typography variant="pi" textColor="neutral700">
              {el.oembed.title}
            </Typography>
          ) : null}
          {el.url ? <UrlText>{el.url}</UrlText> : null}
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
        <SocialEmbedEditorModal
          open
          element={el}
          enabledPlatforms={getEnabledPlatforms(editor)}
          onSave={handleSave}
          onRemove={handleRemove}
          onClose={handleClose}
        />
      ) : null}
    </Box>
  );
};

/* ---------------------------------------------------------------------------
 * Plugin: social-embed nodes are void blocks
 * -------------------------------------------------------------------------*/

const withSocialEmbed = (editor: Editor): Editor => {
  const { isVoid } = editor;
  editor.isVoid = (element) =>
    isSocialEmbedNode(element as CustomElement) ? true : isVoid(element);
  return editor;
};

/* ---------------------------------------------------------------------------
 * Block definition
 * -------------------------------------------------------------------------*/

const socialEmbedBlocks: Pick<BlocksStore, 'social-embed'> = {
  'social-embed': {
    renderElement: (props) => <SocialEmbedElementComponent {...props} />,
    icon: SocialIcon,
    label: {
      id: 'components.Blocks.blocks.social',
      defaultMessage: 'Social embed',
    },
    matchNode: (node) => (node as { type?: string }).type === 'social-embed',
    isInBlocksSelector: true,
    handleConvert(editor) {
      insertSocialEmbed(editor);
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
    snippets: ['[social]'],
  },
};

export { socialEmbedBlocks, withSocialEmbed, insertSocialEmbed, SocialIcon };
