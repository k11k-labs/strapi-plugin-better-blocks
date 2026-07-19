import * as React from 'react';
import { Typography, TypographyComponent } from '@strapi/design-system';
import {
  HeadingFive,
  HeadingFour,
  HeadingOne,
  HeadingSix,
  HeadingThree,
  HeadingTwo,
} from '@strapi/icons';
import { Editor } from 'slate';
import { styled } from 'styled-components';
import { type RenderElementProps } from 'slate-react';

import { type BlocksStore } from '../BlocksEditor';
import { baseHandleConvert } from '../utils/conversions';
import { type Block, CustomElement } from '../utils/types';

// Helper to get style from element
const getElementStyle = (props: RenderElementProps): React.CSSProperties => {
  const element = props.element as CustomElement;
  const style: React.CSSProperties = {};
  if (element.fontColor) {
    style.color = element.fontColor;
  }
  if (element.textAlign) {
    style.textAlign = element.textAlign as React.CSSProperties['textAlign'];
  }
  if ((element as any).indent) {
    style.marginLeft = `${(element as any).indent * 2}rem`;
  }
  if ((element as any).lineHeight) {
    style.lineHeight = (element as any).lineHeight;
  }
  return style;
};

const H1 = styled<TypographyComponent<'h1'>>(Typography).attrs({ tag: 'h1' })`
  font-size: 4.2rem;
  line-height: ${({ theme }) => theme.lineHeights[1]};
`;

const H2 = styled<TypographyComponent<'h2'>>(Typography).attrs({ tag: 'h2' })`
  font-size: 3.5rem;
  line-height: ${({ theme }) => theme.lineHeights[1]};
`;

const H3 = styled<TypographyComponent<'h3'>>(Typography).attrs({ tag: 'h3' })`
  font-size: 2.9rem;
  line-height: ${({ theme }) => theme.lineHeights[1]};
`;

const H4 = styled<TypographyComponent<'h4'>>(Typography).attrs({ tag: 'h4' })`
  font-size: 2.4rem;
  line-height: ${({ theme }) => theme.lineHeights[1]};
`;

const H5 = styled<TypographyComponent<'h5'>>(Typography).attrs({ tag: 'h5' })`
  font-size: 2rem;
  line-height: ${({ theme }) => theme.lineHeights[1]};
`;

const H6 = styled<TypographyComponent<'h6'>>(Typography).attrs({ tag: 'h6' })`
  font-size: 1.6rem;
  line-height: ${({ theme }) => theme.lineHeights[1]};
`;

/**
 * Type scale used to preview each block type inside the block-type dropdown.
 *
 * Deliberately a compressed version of the editor sizes above (4.2rem down to
 * 1.6rem): the point is to convey the hierarchy at a glance, and a literal 4.2rem
 * H1 would turn the menu into a scroll container.
 */
const BLOCK_PREVIEW_TYPOGRAPHY: Record<
  string,
  { fontSize: string; fontWeight: number }
> = {
  paragraph: { fontSize: '1.4rem', fontWeight: 400 },
  'heading-one': { fontSize: '2.2rem', fontWeight: 700 },
  'heading-two': { fontSize: '1.95rem', fontWeight: 700 },
  'heading-three': { fontSize: '1.75rem', fontWeight: 600 },
  'heading-four': { fontSize: '1.6rem', fontWeight: 600 },
  'heading-five': { fontSize: '1.45rem', fontWeight: 600 },
  'heading-six': { fontSize: '1.35rem', fontWeight: 600 },
};

/**
 * Common handler for converting a node to a heading
 */
const handleConvertToHeading = (
  editor: Editor,
  level: Block<'heading'>['level']
) => {
  baseHandleConvert<Block<'heading'>>(editor, {
    type: 'heading',
    level,
  } as never);
};

const headingBlocks: Pick<
  BlocksStore,
  | 'heading-one'
  | 'heading-two'
  | 'heading-three'
  | 'heading-four'
  | 'heading-five'
  | 'heading-six'
> = {
  'heading-one': {
    renderElement: (props) => (
      <H1 {...props.attributes} style={getElementStyle(props)}>
        {props.children}
      </H1>
    ),
    icon: HeadingOne,
    label: {
      id: 'components.Blocks.blocks.heading1',
      defaultMessage: 'Heading 1',
    },
    handleConvert: (editor) => handleConvertToHeading(editor, 1 as never),
    matchNode: (node) => node.type === 'heading' && node.level === 1,
    isInBlocksSelector: true,
    snippets: ['#'],
    dragHandleTopMargin: '14px',
  },
  'heading-two': {
    renderElement: (props) => (
      <H2 {...props.attributes} style={getElementStyle(props)}>
        {props.children}
      </H2>
    ),
    icon: HeadingTwo,
    label: {
      id: 'components.Blocks.blocks.heading2',
      defaultMessage: 'Heading 2',
    },
    handleConvert: (editor) => handleConvertToHeading(editor, 2 as never),
    matchNode: (node) => node.type === 'heading' && node.level === 2,
    isInBlocksSelector: true,
    snippets: ['##'],
    dragHandleTopMargin: '10px',
  },
  'heading-three': {
    renderElement: (props) => (
      <H3 {...props.attributes} style={getElementStyle(props)}>
        {props.children}
      </H3>
    ),
    icon: HeadingThree,
    label: {
      id: 'components.Blocks.blocks.heading3',
      defaultMessage: 'Heading 3',
    },
    handleConvert: (editor) => handleConvertToHeading(editor, 3 as never),
    matchNode: (node) => node.type === 'heading' && node.level === 3,
    isInBlocksSelector: true,
    snippets: ['###'],
    dragHandleTopMargin: '7px',
  },
  'heading-four': {
    renderElement: (props) => (
      <H4 {...props.attributes} style={getElementStyle(props)}>
        {props.children}
      </H4>
    ),
    icon: HeadingFour,
    label: {
      id: 'components.Blocks.blocks.heading4',
      defaultMessage: 'Heading 4',
    },
    handleConvert: (editor) => handleConvertToHeading(editor, 4 as never),
    matchNode: (node) => node.type === 'heading' && node.level === 4,
    isInBlocksSelector: true,
    snippets: ['####'],
    dragHandleTopMargin: '4px',
  },
  'heading-five': {
    renderElement: (props) => (
      <H5 {...props.attributes} style={getElementStyle(props)}>
        {props.children}
      </H5>
    ),
    icon: HeadingFive,
    label: {
      id: 'components.Blocks.blocks.heading5',
      defaultMessage: 'Heading 5',
    },
    handleConvert: (editor) => handleConvertToHeading(editor, 5 as never),
    matchNode: (node) => node.type === 'heading' && node.level === 5,
    isInBlocksSelector: true,
    snippets: ['#####'],
  },
  'heading-six': {
    renderElement: (props) => (
      <H6 {...props.attributes} style={getElementStyle(props)}>
        {props.children}
      </H6>
    ),
    icon: HeadingSix,
    label: {
      id: 'components.Blocks.blocks.heading6',
      defaultMessage: 'Heading 6',
    },
    handleConvert: (editor) => handleConvertToHeading(editor, 6 as never),
    matchNode: (node) => node.type === 'heading' && node.level === 6,
    isInBlocksSelector: true,
    snippets: ['######'],
    dragHandleTopMargin: '-2px',
  },
};

export { headingBlocks, BLOCK_PREVIEW_TYPOGRAPHY };
