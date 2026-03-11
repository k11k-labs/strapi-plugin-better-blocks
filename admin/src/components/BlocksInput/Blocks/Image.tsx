import * as React from 'react';
import { useStrapiApp } from '@strapi/admin/strapi-admin';
import { Flex, Box } from '@strapi/design-system';
import { Image as ImageIcon } from '@strapi/icons';
import { Transforms, Editor, type Element as SlateElement } from 'slate';
import { type RenderElementProps, useFocused, useSelected } from 'slate-react';
import { css, styled } from 'styled-components';

import { type BlocksStore, useBlocksEditorContext } from '../BlocksEditor';
import { type ImageElement } from '../utils/types';

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

  if (!isImageElement(element)) {
    return null;
  }

  const { url, alternativeText, width, height } = element.image;

  return (
    <Box {...attributes}>
      {children}
      <ImageWrapper
        background="neutral100"
        contentEditable={false}
        justifyContent="center"
        $isFocused={editorIsFocused && imageIsSelected}
        hasRadius
      >
        <img src={url} alt={alternativeText} width={width} height={height} />
      </ImageWrapper>
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
