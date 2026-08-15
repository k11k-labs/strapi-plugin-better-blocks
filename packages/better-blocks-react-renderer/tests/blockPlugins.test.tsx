import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { BlocksRenderer } from '../src';
import type { BlockPlugin, ExtendedBlocksContent } from '../src';

const placeholder = [{ type: 'text' as const, text: '' }];

/** A stand-in for what Chartkit will register: a void block with its own spec. */
const chart: BlockPlugin = {
  type: 'chart',
  content: 'void',
  component: ({ node }) => {
    const spec = node.spec as { title?: string };
    return <figure data-testid="chart">{spec?.title}</figure>;
  },
};

describe('registered block types', () => {
  it('renders a block this package does not ship', () => {
    const content = [
      { type: 'chart', spec: { title: 'Revenue' }, children: placeholder },
    ] as ExtendedBlocksContent;

    render(<BlocksRenderer content={content} blockPlugins={[chart]} />);

    expect(screen.getByTestId('chart')).toHaveTextContent('Revenue');
  });

  it('renders nothing for that block when no plugin is passed', () => {
    const content = [
      { type: 'chart', spec: { title: 'Revenue' }, children: placeholder },
    ] as ExtendedBlocksContent;

    const { container } = render(<BlocksRenderer content={content} />);

    expect(container.textContent).toBe('');
  });

  it('leaves the built-in blocks around it alone', () => {
    const content = [
      { type: 'paragraph', children: [{ type: 'text', text: 'before' }] },
      { type: 'chart', spec: { title: 'Revenue' }, children: placeholder },
      { type: 'paragraph', children: [{ type: 'text', text: 'after' }] },
    ] as ExtendedBlocksContent;

    render(<BlocksRenderer content={content} blockPlugins={[chart]} />);

    expect(screen.getByText('before')).toBeInTheDocument();
    expect(screen.getByTestId('chart')).toBeInTheDocument();
    expect(screen.getByText('after')).toBeInTheDocument();
  });

  it('renders a registered block nested inside a callout', () => {
    const content = [
      {
        type: 'callout',
        variant: 'info',
        children: [{ type: 'chart', spec: { title: 'Nested' }, children: placeholder }],
      },
    ] as ExtendedBlocksContent;

    render(<BlocksRenderer content={content} blockPlugins={[chart]} />);

    expect(screen.getByTestId('chart')).toHaveTextContent('Nested');
  });

  it('hands an "inline" block its rendered text, marks and all', () => {
    const banner: BlockPlugin = {
      type: 'banner',
      content: 'inline',
      component: ({ children }) => <div data-testid="banner">{children}</div>,
    };

    const content = [
      {
        type: 'banner',
        children: [
          { type: 'text', text: 'plain ' },
          { type: 'text', text: 'bold', bold: true },
        ],
      },
    ] as ExtendedBlocksContent;

    render(<BlocksRenderer content={content} blockPlugins={[banner]} />);

    const banner_ = screen.getByTestId('banner');
    expect(banner_).toHaveTextContent('plain bold');
    expect(banner_.querySelector('strong')).toHaveTextContent('bold');
  });

  it('hands a "blocks" block its rendered children', () => {
    const panel: BlockPlugin = {
      type: 'panel',
      content: 'blocks',
      component: ({ children }) => <section data-testid="panel">{children}</section>,
    };

    const content = [
      {
        type: 'panel',
        children: [
          { type: 'paragraph', children: [{ type: 'text', text: 'inside' }] },
          { type: 'chart', spec: { title: 'Deep' }, children: placeholder },
        ],
      },
    ] as ExtendedBlocksContent;

    render(<BlocksRenderer content={content} blockPlugins={[panel, chart]} />);

    const panel_ = screen.getByTestId('panel');
    expect(panel_).toHaveTextContent('inside');
    // The nesting block threads the registry down, so a registered block works
    // at any depth.
    expect(screen.getByTestId('chart')).toHaveTextContent('Deep');
  });

  it('passes the whole node through, attributes included', () => {
    const probe: BlockPlugin = {
      type: 'probe',
      component: ({ node }) => <pre data-testid="probe">{JSON.stringify(node)}</pre>,
    };

    const content = [
      { type: 'probe', anything: { nested: [1, 2] }, children: placeholder },
    ] as ExtendedBlocksContent;

    render(<BlocksRenderer content={content} blockPlugins={[probe]} />);

    expect(JSON.parse(screen.getByTestId('probe').textContent!)).toEqual({
      type: 'probe',
      anything: { nested: [1, 2] },
      children: placeholder,
    });
  });
});
