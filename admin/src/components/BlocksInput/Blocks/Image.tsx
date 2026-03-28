import * as React from 'react';
import { useStrapiApp } from '@strapi/admin/strapi-admin';
import { Flex, Box, Typography } from '@strapi/design-system';
import { Image as ImageIcon } from '@strapi/icons';
import { Transforms, Editor, type Element as SlateElement } from 'slate';
import {
  type RenderElementProps,
  useFocused,
  useSelected,
  useSlateStatic,
  ReactEditor,
} from 'slate-react';
import { css, styled } from 'styled-components';

import { type BlocksStore, useBlocksEditorContext } from '../BlocksEditor';
import { type ImageElement } from '../utils/types';

type ImageAlign = 'center' | 'left' | 'right';

const ImageFigure = styled.figure<{ $align: ImageAlign }>`
  margin: ${({ theme }) => theme.spaces[2]} 0;
  text-align: ${({ $align }) => $align};
  display: flex;
  flex-direction: column;
  align-items: ${({ $align }) =>
    $align === 'left'
      ? 'flex-start'
      : $align === 'right'
        ? 'flex-end'
        : 'center'};
`;

const ImageWrapper = styled<typeof Flex>(Flex)<{ $isFocused: boolean }>`
  transition-property: box-shadow;
  transition-duration: 0.2s;
  ${(props) =>
    props.$isFocused &&
    css`
      box-shadow: ${props.theme.colors.primary600} 0px 0px 0px 3px;
    `}

  & > img {
    height: auto;
    max-height: calc(512px - 56px);
    max-width: 100%;
    object-fit: contain;
  }
`;

const CaptionInput = styled.figcaption`
  margin-top: ${({ theme }) => theme.spaces[2]};
  font-size: ${({ theme }) => theme.fontSizes[1]};
  color: ${({ theme }) => theme.colors.neutral600};
  text-align: center;
  width: 100%;
  border: none;
  outline: none;
  padding: ${({ theme }) => theme.spaces[1]} ${({ theme }) => theme.spaces[2]};

  &:empty::before {
    content: 'Add a caption...';
    color: ${({ theme }) => theme.colors.neutral400};
  }
`;

const AlignBar = styled(Flex)`
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  opacity: 0;
  transition: opacity 0.2s;
`;

const AlignBtn = styled.button<{ $active: boolean }>`
  background: ${({ theme, $active }) =>
    $active ? theme.colors.primary600 : 'rgba(0,0,0,0.6)'};
  border: none;
  color: white;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 11px;
  border-radius: 3px;

  &:hover {
    background: ${({ theme }) => theme.colors.primary600};
  }
`;

const ImageContainer = styled.div`
  position: relative;

  &:hover ${AlignBar} {
    opacity: 1;
  }
`;

const IMAGE_SCHEMA_FIELDS = [
  'name',
  'alternativeText',
  'url',
  'caption',
  'width',
  'height',
  'formats',
  'hash',
  'ext',
  'mime',
  'size',
  'previewUrl',
  'provider',
  'provider_metadata',
  'createdAt',
  'updatedAt',
] as const;

const pick = (
  object: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> => {
  const entries = keys.map((key) => [key, object[key]]);
  return Object.fromEntries(entries);
};

const prefixFileUrlWithBackendUrl = (fileURL?: string): string | undefined => {
  return !!fileURL && fileURL.startsWith('/')
    ? `${window.strapi.backendURL}${fileURL}`
    : fileURL;
};

const isImageElement = (element: SlateElement): element is ImageElement => {
  return (
    'type' in element &&
    (element as unknown as { type: string }).type === 'image'
  );
};

const ImageBlock = ({ attributes, children, element }: RenderElementProps) => {
  const editorIsFocused = useFocused();
  const imageIsSelected = useSelected();
  const editor = useSlateStatic();

  if (!isImageElement(element)) {
    return null;
  }

  const { url, alternativeText, width, height } = element.image;
  const caption = (element as any).caption || '';
  const align: ImageAlign = (element as any).imageAlign || 'center';

  const setAlign = (newAlign: ImageAlign) => {
    const path = ReactEditor.findPath(editor as ReactEditor, element);
    Transforms.setNodes(editor, { imageAlign: newAlign } as any, { at: path });
  };

  const setCaption = (newCaption: string) => {
    const path = ReactEditor.findPath(editor as ReactEditor, element);
    Transforms.setNodes(editor, { caption: newCaption } as any, { at: path });
  };

  return (
    <Box {...attributes}>
      {children}
      <ImageFigure contentEditable={false} $align={align}>
        <ImageContainer>
          <AlignBar gap={1} contentEditable={false}>
            {(['left', 'center', 'right'] as ImageAlign[]).map((a) => (
              <AlignBtn
                key={a}
                $active={align === a}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setAlign(a);
                }}
              >
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </AlignBtn>
            ))}
          </AlignBar>
          <ImageWrapper
            background="neutral100"
            justifyContent="center"
            $isFocused={editorIsFocused && imageIsSelected}
            hasRadius
          >
            <img
              src={url}
              alt={alternativeText}
              width={width}
              height={height}
            />
          </ImageWrapper>
        </ImageContainer>
        <CaptionInput
          contentEditable
          suppressContentEditableWarning
          onBlur={(e: React.FocusEvent<HTMLElement>) =>
            setCaption(e.currentTarget.textContent || '')
          }
        >
          {caption}
        </CaptionInput>
      </ImageFigure>
    </Box>
  );
};

const ImageDialog = () => {
  const [isOpen, setIsOpen] = React.useState(true);
  const { editor } = useBlocksEditorContext('ImageDialog');
  const components = useStrapiApp('ImageDialog', (state) => state.components);

  if (!components || !isOpen) return null;

  const MediaLibraryDialog = components[
    'media-library'
  ] as React.ComponentType<{
    allowedTypes: string[];
    onClose: () => void;
    onSelectAssets: (assets: Record<string, unknown>[]) => void;
  }>;

  const insertImages = (images: Record<string, unknown>[]) => {
    Transforms.unwrapNodes(editor, {
      match: (node) =>
        !Editor.isEditor(node) &&
        'type' in node &&
        (node as unknown as { type: string }).type === 'list',
      split: true,
    });

    const nodeEntryBeingReplaced = Editor.above(editor, {
      match(node) {
        if (Editor.isEditor(node)) return false;
        const isInlineNode = ['text', 'link'].includes(
          (node as unknown as { type: string }).type
        );
        return !isInlineNode;
      },
    });

    if (!nodeEntryBeingReplaced) return;

    const [, pathToInsert] = nodeEntryBeingReplaced;

    Transforms.removeNodes(editor);

    const nodesToInsert = images.map((image) => ({
      type: 'image' as const,
      image,
      children: [{ type: 'text' as const, text: '' }],
    }));

    Transforms.insertNodes(editor, nodesToInsert as any, { at: pathToInsert });
    Transforms.select(editor, pathToInsert);
  };

  const handleSelectAssets = (images: Record<string, unknown>[]) => {
    const formattedImages = images.map((image) => {
      const expectedImage = pick(
        image,
        IMAGE_SCHEMA_FIELDS as unknown as string[]
      );
      return {
        ...expectedImage,
        alternativeText:
          (expectedImage.alternativeText as string) ||
          (expectedImage.name as string),
        url: prefixFileUrlWithBackendUrl(image.url as string),
      };
    });

    insertImages(formattedImages);
    setIsOpen(false);
  };

  return (
    <MediaLibraryDialog
      allowedTypes={['images']}
      onClose={() => setIsOpen(false)}
      onSelectAssets={handleSelectAssets}
    />
  );
};

const withImages = (editor: Editor): Editor => {
  const { isVoid } = editor;
  editor.isVoid = (element) => {
    return (element as unknown as { type: string }).type === 'image'
      ? true
      : isVoid(element);
  };
  return editor;
};

const imageBlocks: Pick<BlocksStore, 'image'> = {
  image: {
    renderElement: (props) => <ImageBlock {...props} />,
    icon: ImageIcon,
    label: {
      id: 'components.Blocks.blocks.image',
      defaultMessage: 'Image',
    },
    matchNode: (node) => node.type === 'image',
    isInBlocksSelector: true,
    handleBackspaceKey(editor) {
      if (editor.children.length === 1) {
        Transforms.setNodes(editor, {
          type: 'paragraph',
          image: null,
        } as any);
      } else {
        Transforms.removeNodes(editor);
      }
    },
    handleEnterKey(editor) {
      Transforms.insertNodes(editor, {
        type: 'paragraph',
        children: [{ type: 'text', text: '' }],
      } as any);
    },
    handleConvert: () => {
      return () => <ImageDialog />;
    },
    snippets: ['!['],
  },
};

export { imageBlocks, withImages };
