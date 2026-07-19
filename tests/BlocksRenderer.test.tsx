import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BlocksRenderer } from '../src';
import type { BlocksContent } from '../src';

// Mermaid needs a real browser DOM, so stub it with a renderer that echoes the
// source into a marker SVG. This keeps the diagram tests fast and deterministic.
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (_id: string, code: string) => ({
      svg: `<svg class="mock-mermaid"><text>${code}</text></svg>`,
    })),
  },
}));

describe('BlocksRenderer', () => {
  it('returns null for empty content', () => {
    const { container } = render(<BlocksRenderer content={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null for undefined-ish content', () => {
    const { container } = render(<BlocksRenderer content={null as unknown as BlocksContent} />);
    expect(container.innerHTML).toBe('');
  });

  // ── Paragraphs ───────────────────────────────────────────────────

  it('renders a paragraph with plain text', () => {
    const content: BlocksContent = [
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello world' }] },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('Hello world').tagName).toBe('P');
  });

  // ── Headings ─────────────────────────────────────────────────────

  it('renders headings h1-h6', () => {
    const content: BlocksContent = [
      { type: 'heading', level: 1, children: [{ type: 'text', text: 'H1' }] },
      { type: 'heading', level: 2, children: [{ type: 'text', text: 'H2' }] },
      { type: 'heading', level: 3, children: [{ type: 'text', text: 'H3' }] },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('H1').tagName).toBe('H1');
    expect(screen.getByText('H2').tagName).toBe('H2');
    expect(screen.getByText('H3').tagName).toBe('H3');
  });

  // ── Standard Marks ───────────────────────────────────────────────

  it('renders bold text', () => {
    const content: BlocksContent = [
      { type: 'paragraph', children: [{ type: 'text', text: 'Bold', bold: true }] },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Bold').tagName).toBe('STRONG');
  });

  it('renders italic text', () => {
    const content: BlocksContent = [
      { type: 'paragraph', children: [{ type: 'text', text: 'Italic', italic: true }] },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Italic').tagName).toBe('EM');
  });

  it('renders underline text', () => {
    const content: BlocksContent = [
      { type: 'paragraph', children: [{ type: 'text', text: 'Under', underline: true }] },
    ];
    render(<BlocksRenderer content={content} />);
    const el = screen.getByText('Under');
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveStyle({ textDecoration: 'underline' });
  });

  it('renders strikethrough text', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Strike', strikethrough: true }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Strike').tagName).toBe('DEL');
  });

  it('renders inline code', () => {
    const content: BlocksContent = [
      { type: 'paragraph', children: [{ type: 'text', text: 'Code', code: true }] },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Code').tagName).toBe('CODE');
  });

  // ── Color & Background Marks ─────────────────────────────────────

  it('renders text with color', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Red', color: '#E53E3E' }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    const el = screen.getByText('Red');
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveStyle({ color: '#E53E3E' });
  });

  it('renders text with backgroundColor', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Highlighted', backgroundColor: '#FED7D7' }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    const el = screen.getByText('Highlighted');
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveStyle({ backgroundColor: '#FED7D7' });
  });

  it('renders text with both color and backgroundColor', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [
          {
            type: 'text',
            text: 'Both',
            color: '#E53E3E',
            backgroundColor: '#FED7D7',
          },
        ],
      },
    ];
    render(<BlocksRenderer content={content} />);
    const bgEl = screen.getByText('Both').closest('span[style*="background-color"]');
    expect(bgEl).toBeInTheDocument();
    const colorEl = screen.getByText('Both').closest('span[style*="color"]');
    expect(colorEl).toBeInTheDocument();
  });

  it('renders bold + color combined', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'BoldRed', bold: true, color: '#E53E3E' }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    const strong = screen.getByText('BoldRed');
    expect(strong.tagName).toBe('STRONG');
    const colorSpan = strong.closest('span[style*="color"]');
    expect(colorSpan).toBeInTheDocument();
  });

  // ── Links ────────────────────────────────────────────────────────

  it('renders links', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: 'https://example.com',
            children: [{ type: 'text', text: 'Click me' }],
          },
        ],
      },
    ];
    render(<BlocksRenderer content={content} />);
    const link = screen.getByText('Click me');
    expect(link.closest('a')).toHaveAttribute('href', 'https://example.com');
  });

  it('renders links with target="_blank" and rel', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: 'https://example.com',
            target: '_blank',
            rel: 'noopener noreferrer',
            children: [{ type: 'text', text: 'External' }],
          },
        ],
      },
    ];
    render(<BlocksRenderer content={content} />);
    const a = screen.getByText('External').closest('a');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not set target when not provided', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: 'https://example.com',
            children: [{ type: 'text', text: 'Normal' }],
          },
        ],
      },
    ];
    render(<BlocksRenderer content={content} />);
    const a = screen.getByText('Normal').closest('a');
    expect(a).not.toHaveAttribute('target');
  });

  // ── Lists ────────────────────────────────────────────────────────

  it('renders unordered lists', () => {
    const content: BlocksContent = [
      {
        type: 'list',
        format: 'unordered',
        children: [
          { type: 'list-item', children: [{ type: 'text', text: 'Item 1' }] },
          { type: 'list-item', children: [{ type: 'text', text: 'Item 2' }] },
        ],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Item 1').closest('ul')).toBeInTheDocument();
    expect(screen.getByText('Item 1').closest('li')).toBeInTheDocument();
  });

  it('renders ordered lists', () => {
    const content: BlocksContent = [
      {
        type: 'list',
        format: 'ordered',
        children: [{ type: 'list-item', children: [{ type: 'text', text: 'First' }] }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('First').closest('ol')).toBeInTheDocument();
  });

  it('renders nested lists', () => {
    const content: BlocksContent = [
      {
        type: 'list',
        format: 'unordered',
        children: [
          { type: 'list-item', children: [{ type: 'text', text: 'Parent' }] },
          {
            type: 'list',
            format: 'unordered',
            children: [{ type: 'list-item', children: [{ type: 'text', text: 'Child' }] }],
          },
        ],
      },
    ];
    render(<BlocksRenderer content={content} />);
    const childLi = screen.getByText('Child').closest('li');
    const nestedUl = childLi?.closest('ul');
    const outerUl = nestedUl?.parentElement?.closest('ul');
    expect(outerUl).toBeInTheDocument();
  });

  it('applies cycling list-style-type for unordered lists based on indentLevel', () => {
    const content: BlocksContent = [
      {
        type: 'list',
        format: 'unordered',
        indentLevel: 0,
        children: [
          { type: 'list-item', children: [{ type: 'text', text: 'Level 0' }] },
          {
            type: 'list',
            format: 'unordered',
            indentLevel: 1,
            children: [
              { type: 'list-item', children: [{ type: 'text', text: 'Level 1' }] },
              {
                type: 'list',
                format: 'unordered',
                indentLevel: 2,
                children: [{ type: 'list-item', children: [{ type: 'text', text: 'Level 2' }] }],
              },
            ],
          },
        ],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const uls = container.querySelectorAll('ul');
    expect(uls[0]).toHaveStyle({ listStyleType: 'disc' });
    expect(uls[1]).toHaveStyle({ listStyleType: 'circle' });
    expect(uls[2]).toHaveStyle({ listStyleType: 'square' });
  });

  it('applies cycling list-style-type for ordered lists based on indentLevel', () => {
    const content: BlocksContent = [
      {
        type: 'list',
        format: 'ordered',
        indentLevel: 0,
        children: [
          { type: 'list-item', children: [{ type: 'text', text: 'Level 0' }] },
          {
            type: 'list',
            format: 'ordered',
            indentLevel: 1,
            children: [
              { type: 'list-item', children: [{ type: 'text', text: 'Level 1' }] },
              {
                type: 'list',
                format: 'ordered',
                indentLevel: 2,
                children: [{ type: 'list-item', children: [{ type: 'text', text: 'Level 2' }] }],
              },
            ],
          },
        ],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const ols = container.querySelectorAll('ol');
    expect(ols[0]).toHaveStyle({ listStyleType: 'decimal' });
    expect(ols[1]).toHaveStyle({ listStyleType: 'lower-alpha' });
    expect(ols[2]).toHaveStyle({ listStyleType: 'upper-roman' });
  });

  it('cycles list-style-type back to start after exhausting styles', () => {
    const content: BlocksContent = [
      {
        type: 'list',
        format: 'unordered',
        indentLevel: 3,
        children: [{ type: 'list-item', children: [{ type: 'text', text: 'Level 3' }] }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('ul')).toHaveStyle({ listStyleType: 'disc' });
  });

  it('defaults to indentLevel 0 when not provided', () => {
    const content: BlocksContent = [
      {
        type: 'list',
        format: 'unordered',
        children: [{ type: 'list-item', children: [{ type: 'text', text: 'No indent' }] }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('ul')).toHaveStyle({ listStyleType: 'disc' });
  });

  it('supports mixed ordered/unordered nested lists with indentLevel', () => {
    const content: BlocksContent = [
      {
        type: 'list',
        format: 'unordered',
        indentLevel: 0,
        children: [
          { type: 'list-item', children: [{ type: 'text', text: 'Bullet' }] },
          {
            type: 'list',
            format: 'ordered',
            indentLevel: 1,
            children: [{ type: 'list-item', children: [{ type: 'text', text: 'Numbered' }] }],
          },
        ],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('ul')).toHaveStyle({ listStyleType: 'disc' });
    expect(container.querySelector('ol')).toHaveStyle({ listStyleType: 'lower-alpha' });
  });

  // ── To-do Lists ──────────────────────────────────────────────────

  it('renders to-do list with checkboxes', () => {
    const content: BlocksContent = [
      {
        type: 'list',
        format: 'todo',
        children: [
          { type: 'list-item', checked: false, children: [{ type: 'text', text: 'Unchecked' }] },
          { type: 'list-item', checked: true, children: [{ type: 'text', text: 'Checked' }] },
        ],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).toBeChecked();
  });

  it('applies strikethrough and opacity to checked to-do items', () => {
    const content: BlocksContent = [
      {
        type: 'list',
        format: 'todo',
        children: [
          { type: 'list-item', checked: true, children: [{ type: 'text', text: 'Done' }] },
        ],
      },
    ];
    render(<BlocksRenderer content={content} />);
    const span = screen.getByText('Done');
    expect(span).toHaveStyle({ textDecoration: 'line-through', opacity: 0.6 });
  });

  it('renders to-do list without bullet markers', () => {
    const content: BlocksContent = [
      {
        type: 'list',
        format: 'todo',
        children: [
          { type: 'list-item', checked: false, children: [{ type: 'text', text: 'Task' }] },
        ],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const ul = container.querySelector('ul');
    expect(ul).toHaveStyle({ listStyle: 'none' });
  });

  // ── Quote ────────────────────────────────────────────────────────

  it('renders blockquote', () => {
    const content: BlocksContent = [
      { type: 'quote', children: [{ type: 'text', text: 'Wise words' }] },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Wise words').closest('blockquote')).toBeInTheDocument();
  });

  // ── Code Block ───────────────────────────────────────────────────

  it('renders code block', () => {
    const content: BlocksContent = [
      { type: 'code', children: [{ type: 'text', text: 'const x = 1;' }] },
    ];
    render(<BlocksRenderer content={content} />);
    const code = screen.getByText('const x = 1;');
    expect(code.tagName).toBe('CODE');
    expect(code.closest('pre')).toBeInTheDocument();
  });

  // ── Image ────────────────────────────────────────────────────────

  it('renders images', () => {
    const content: BlocksContent = [
      {
        type: 'image',
        image: {
          url: 'https://example.com/img.png',
          alternativeText: 'An image',
          width: 200,
          height: 100,
        },
        children: [{ type: 'text', text: '' }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    const img = screen.getByAltText('An image');
    expect(img).toHaveAttribute('src', 'https://example.com/img.png');
    expect(img).toHaveAttribute('width', '200');
    expect(img).toHaveAttribute('height', '100');
  });

  it('renders image with caption', () => {
    const content: BlocksContent = [
      {
        type: 'image',
        image: { url: 'https://example.com/img.png', alternativeText: 'Photo' },
        caption: 'A beautiful photo',
        children: [{ type: 'text', text: '' }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('A beautiful photo').tagName).toBe('FIGCAPTION');
  });

  it('does not render figcaption when caption is empty', () => {
    const content: BlocksContent = [
      {
        type: 'image',
        image: { url: 'https://example.com/img.png', alternativeText: 'Photo' },
        children: [{ type: 'text', text: '' }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('renders image inside a figure element', () => {
    const content: BlocksContent = [
      {
        type: 'image',
        image: { url: 'https://example.com/img.png', alternativeText: 'Photo' },
        children: [{ type: 'text', text: '' }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('figure')).toBeInTheDocument();
  });

  it('renders image with alignment', () => {
    const content: BlocksContent = [
      {
        type: 'image',
        image: { url: 'https://example.com/img.png', alternativeText: 'Photo' },
        imageAlign: 'left',
        children: [{ type: 'text', text: '' }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('figure')).toHaveStyle({ textAlign: 'left' });
  });

  it('defaults image alignment to center', () => {
    const content: BlocksContent = [
      {
        type: 'image',
        image: { url: 'https://example.com/img.png', alternativeText: 'Photo' },
        children: [{ type: 'text', text: '' }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('figure')).toHaveStyle({ textAlign: 'center' });
  });

  // ── Horizontal Line ──────────────────────────────────────────────

  it('renders horizontal line', () => {
    const content: BlocksContent = [
      { type: 'horizontal-line', children: [{ type: 'text', text: '' }] },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('hr')).toBeInTheDocument();
  });

  // ── Text Alignment ───────────────────────────────────────────────

  it('renders paragraph with text alignment', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        textAlign: 'center',
        children: [{ type: 'text', text: 'Centered' }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Centered').closest('p')).toHaveStyle({ textAlign: 'center' });
  });

  it('renders heading with text alignment', () => {
    const content: BlocksContent = [
      {
        type: 'heading',
        level: 2,
        textAlign: 'right',
        children: [{ type: 'text', text: 'Right H2' }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Right H2')).toHaveStyle({ textAlign: 'right' });
  });

  it('renders blockquote with text alignment', () => {
    const content: BlocksContent = [
      {
        type: 'quote',
        textAlign: 'center',
        children: [{ type: 'text', text: 'Centered quote' }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Centered quote').closest('blockquote')).toHaveStyle({
      textAlign: 'center',
    });
  });

  it('does not apply textAlign style when not set', () => {
    const content: BlocksContent = [
      { type: 'paragraph', children: [{ type: 'text', text: 'Default' }] },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('p')?.getAttribute('style')).toBeNull();
  });

  // ── Tables ───────────────────────────────────────────────────────

  it('renders a table with header and data cells', () => {
    const content: BlocksContent = [
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [
              { type: 'table-header-cell', children: [{ type: 'text', text: 'Name' }] },
              { type: 'table-header-cell', children: [{ type: 'text', text: 'Age' }] },
            ],
          },
          {
            type: 'table-row',
            children: [
              { type: 'table-cell', children: [{ type: 'text', text: 'Alice' }] },
              { type: 'table-cell', children: [{ type: 'text', text: '30' }] },
            ],
          },
        ],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('table')).toBeInTheDocument();
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('td')).toHaveLength(2);
    expect(screen.getByText('Name').tagName).toBe('TH');
    expect(screen.getByText('Alice').tagName).toBe('TD');
  });

  it('renders table within tbody', () => {
    const content: BlocksContent = [
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [{ type: 'table-cell', children: [{ type: 'text', text: 'Cell' }] }],
          },
        ],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('tbody')).toBeInTheDocument();
  });

  it('wraps a leading all-header row in thead and the rest in tbody', () => {
    const content: BlocksContent = [
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [{ type: 'table-header-cell', children: [{ type: 'text', text: 'Name' }] }],
          },
          {
            type: 'table-row',
            children: [{ type: 'table-cell', children: [{ type: 'text', text: 'Alice' }] }],
          },
        ],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelectorAll('thead tr')).toHaveLength(1);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(screen.getByText('Name')).toHaveAttribute('scope', 'col');
  });

  it('wraps every leading header row in thead (merged multi-row header)', () => {
    const content: BlocksContent = [
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [
              {
                type: 'table-header-cell',
                rowSpan: 2,
                children: [{ type: 'text', text: 'Region' }],
              },
              { type: 'table-header-cell', colSpan: 2, children: [{ type: 'text', text: '2026' }] },
            ],
          },
          {
            type: 'table-row',
            children: [
              { type: 'table-header-cell', children: [{ type: 'text', text: 'H1' }] },
              { type: 'table-header-cell', children: [{ type: 'text', text: 'H2' }] },
            ],
          },
          {
            type: 'table-row',
            children: [
              { type: 'table-header-cell', children: [{ type: 'text', text: 'EMEA' }] },
              { type: 'table-cell', children: [{ type: 'text', text: '12' }] },
              { type: 'table-cell', children: [{ type: 'text', text: '18' }] },
            ],
          },
        ],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelectorAll('thead tr')).toHaveLength(2);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(screen.getByText('Region')).toHaveAttribute('rowspan', '2');
    expect(screen.getByText('2026')).toHaveAttribute('colspan', '2');
    // Column headers in the <thead>, row header in the body.
    expect(screen.getByText('H1')).toHaveAttribute('scope', 'col');
    expect(screen.getByText('EMEA')).toHaveAttribute('scope', 'row');
  });

  it('keeps a mixed first row in tbody', () => {
    const content: BlocksContent = [
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [
              { type: 'table-header-cell', children: [{ type: 'text', text: 'Name' }] },
              { type: 'table-cell', children: [{ type: 'text', text: 'Alice' }] },
            ],
          },
        ],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('thead')).not.toBeInTheDocument();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('omits tbody when the table is only a header row', () => {
    const content: BlocksContent = [
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [{ type: 'table-header-cell', children: [{ type: 'text', text: 'Only' }] }],
          },
        ],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('thead')).toBeInTheDocument();
    expect(container.querySelector('tbody')).not.toBeInTheDocument();
  });

  it('applies cell alignment, defaulting to none when absent', () => {
    const content: BlocksContent = [
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [
              { type: 'table-cell', align: 'center', children: [{ type: 'text', text: 'Mid' }] },
              { type: 'table-cell', align: 'right', children: [{ type: 'text', text: 'End' }] },
              { type: 'table-cell', children: [{ type: 'text', text: 'Start' }] },
            ],
          },
        ],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Mid')).toHaveStyle({ textAlign: 'center' });
    expect(screen.getByText('End')).toHaveStyle({ textAlign: 'right' });
    expect(screen.getByText('Start').getAttribute('style')).toBeNull();
  });

  it('maps colSpan and rowSpan onto the cell attributes', () => {
    const content: BlocksContent = [
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [
              {
                type: 'table-header-cell',
                colSpan: 2,
                rowSpan: 2,
                children: [{ type: 'text', text: 'Merged' }],
              },
            ],
          },
          {
            type: 'table-row',
            children: [{ type: 'table-cell', children: [{ type: 'text', text: 'Plain' }] }],
          },
        ],
      },
    ];
    render(<BlocksRenderer content={content} />);
    const merged = screen.getByText('Merged');
    expect(merged).toHaveAttribute('colspan', '2');
    expect(merged).toHaveAttribute('rowspan', '2');
    const plain = screen.getByText('Plain');
    expect(plain).not.toHaveAttribute('colspan');
    expect(plain).not.toHaveAttribute('rowspan');
  });

  it('renders marks and links inside table cells', () => {
    const content: BlocksContent = [
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [
              {
                type: 'table-cell',
                children: [
                  { type: 'text', text: 'Bold', bold: true },
                  {
                    type: 'link',
                    url: 'https://example.com',
                    children: [{ type: 'text', text: 'Link' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Bold').tagName).toBe('STRONG');
    expect(screen.getByText('Link').closest('a')).toHaveAttribute('href', 'https://example.com');
  });

  // ── Media Embed ──────────────────────────────────────────────────

  it('renders media embed as responsive iframe', () => {
    const content: BlocksContent = [
      {
        type: 'media-embed',
        url: 'https://www.youtube.com/embed/abc123',
        originalUrl: 'https://www.youtube.com/watch?v=abc123',
        children: [{ type: 'text', text: '' }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://www.youtube.com/embed/abc123');
    expect(iframe).toHaveAttribute('allowfullscreen', '');
  });

  it('renders media embed wrapper with 16:9 aspect ratio', () => {
    const content: BlocksContent = [
      {
        type: 'media-embed',
        url: 'https://player.vimeo.com/video/12345',
        children: [{ type: 'text', text: '' }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const wrapper = container.querySelector('div');
    expect(wrapper).toHaveStyle({ position: 'relative', paddingBottom: '56.25%', height: '0' });
  });

  // ── Math (KaTeX) ─────────────────────────────────────────────────

  it('renders block math as a div.katex-block', () => {
    const content: BlocksContent = [
      {
        type: 'math',
        format: 'block',
        value: 'E = mc^2',
        children: [{ type: 'text', text: '' }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const block = container.querySelector('div.katex-block');
    expect(block).toBeInTheDocument();
    // KaTeX emits a .katex element with the source in an annotation
    expect(block?.querySelector('.katex')).toBeInTheDocument();
    expect(block?.textContent).toContain('E = mc^2');
  });

  it('renders inline math as a span.katex-inline within a paragraph', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Equation ' },
          {
            type: 'math',
            format: 'inline',
            value: 'a^2 + b^2 = c^2',
            children: [{ type: 'text', text: '' }],
          },
        ],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const span = container.querySelector('span.katex-inline');
    expect(span).toBeInTheDocument();
    expect(span?.closest('p')).toBeInTheDocument();
    expect(span?.querySelector('.katex')).toBeInTheDocument();
  });

  it('renders inline math in non-display mode (no .katex-display wrapper)', () => {
    const content: BlocksContent = [
      {
        type: 'math',
        format: 'inline',
        value: 'x + y',
        children: [{ type: 'text', text: '' }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('span.katex-inline')).toBeInTheDocument();
    expect(container.querySelector('.katex-display')).toBeNull();
  });

  it('renders block math in display mode (.katex-display wrapper)', () => {
    const content: BlocksContent = [
      {
        type: 'math',
        format: 'block',
        value: '\\frac{1}{2}',
        children: [{ type: 'text', text: '' }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('.katex-display')).toBeInTheDocument();
  });

  it('uses custom math renderer with formula and inline props', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [
          {
            type: 'math',
            format: 'inline',
            value: '\\pi',
            children: [{ type: 'text', text: '' }],
          },
        ],
      },
      {
        type: 'math',
        format: 'block',
        value: '\\sum x',
        children: [{ type: 'text', text: '' }],
      },
    ];
    render(
      <BlocksRenderer
        content={content}
        blocks={{
          math: ({ formula, inline }) => (
            <span data-testid="custom-math" data-formula={formula} data-inline={String(inline)} />
          ),
        }}
      />
    );
    const els = screen.getAllByTestId('custom-math');
    expect(els).toHaveLength(2);
    expect(els[0]).toHaveAttribute('data-formula', '\\pi');
    expect(els[0]).toHaveAttribute('data-inline', 'true');
    expect(els[1]).toHaveAttribute('data-formula', '\\sum x');
    expect(els[1]).toHaveAttribute('data-inline', 'false');
  });

  // ── Text Modifiers: uppercase, superscript, subscript ────────────

  it('renders uppercase text', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'upper', uppercase: true }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('upper')).toHaveStyle({ textTransform: 'uppercase' });
  });

  it('renders superscript text', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: '2', superscript: true }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('2').tagName).toBe('SUP');
  });

  it('renders subscript text', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'n', subscript: true }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('n').tagName).toBe('SUB');
  });

  // ── Text Marks: fontFamily, fontSize ─────────────────────────────

  it('renders text with fontFamily', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Serif', fontFamily: 'Georgia, serif' }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Serif')).toHaveStyle({ fontFamily: 'Georgia, serif' });
  });

  it('renders text with fontSize', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Big', fontSize: '24px' }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Big')).toHaveStyle({ fontSize: '24px' });
  });

  // ── Block Properties: lineHeight, indent ─────────────────────────

  it('renders paragraph with lineHeight', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        lineHeight: '1.8',
        children: [{ type: 'text', text: 'Spaced' }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Spaced').closest('p')).toHaveStyle({ lineHeight: '1.8' });
  });

  it('renders heading with lineHeight', () => {
    const content: BlocksContent = [
      {
        type: 'heading',
        level: 2,
        lineHeight: '2.0',
        children: [{ type: 'text', text: 'Spaced H2' }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Spaced H2')).toHaveStyle({ lineHeight: '2.0' });
  });

  it('renders paragraph with indent', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        indent: 2,
        children: [{ type: 'text', text: 'Indented' }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    expect(screen.getByText('Indented').closest('p')).toHaveStyle({ marginLeft: '4rem' });
  });

  it('renders block with combined textAlign, lineHeight, and indent', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        textAlign: 'center',
        lineHeight: '1.5',
        indent: 1,
        children: [{ type: 'text', text: 'Combined' }],
      },
    ];
    render(<BlocksRenderer content={content} />);
    const p = screen.getByText('Combined').closest('p');
    expect(p).toHaveStyle({ textAlign: 'center', lineHeight: '1.5', marginLeft: '2rem' });
  });

  it('does not apply lineHeight or indent when not set', () => {
    const content: BlocksContent = [
      { type: 'paragraph', children: [{ type: 'text', text: 'Plain' }] },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('p')?.getAttribute('style')).toBeNull();
  });

  // ── Custom Block Renderers ───────────────────────────────────────

  it('uses custom paragraph renderer', () => {
    const content: BlocksContent = [
      { type: 'paragraph', children: [{ type: 'text', text: 'Custom' }] },
    ];
    render(
      <BlocksRenderer
        content={content}
        blocks={{
          paragraph: ({ children }) => <div data-testid="custom-p">{children}</div>,
        }}
      />
    );
    expect(screen.getByTestId('custom-p')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('uses custom heading renderer', () => {
    const content: BlocksContent = [
      { type: 'heading', level: 2, children: [{ type: 'text', text: 'Title' }] },
    ];
    render(
      <BlocksRenderer
        content={content}
        blocks={{
          heading: ({ children, level }) => <div data-testid={`heading-${level}`}>{children}</div>,
        }}
      />
    );
    expect(screen.getByTestId('heading-2')).toBeInTheDocument();
  });

  it('uses custom link renderer', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: 'https://example.com',
            children: [{ type: 'text', text: 'Link' }],
          },
        ],
      },
    ];
    render(
      <BlocksRenderer
        content={content}
        blocks={{
          link: ({ children, url }) => (
            <a data-testid="custom-link" href={url}>
              {children}
            </a>
          ),
        }}
      />
    );
    expect(screen.getByTestId('custom-link')).toHaveAttribute('href', 'https://example.com');
  });

  it('uses custom horizontal-line renderer', () => {
    const content: BlocksContent = [
      { type: 'horizontal-line', children: [{ type: 'text', text: '' }] },
    ];
    render(
      <BlocksRenderer
        content={content}
        blocks={{
          'horizontal-line': () => <div data-testid="custom-hr" />,
        }}
      />
    );
    expect(screen.getByTestId('custom-hr')).toBeInTheDocument();
  });

  it('uses custom media-embed renderer', () => {
    const content: BlocksContent = [
      {
        type: 'media-embed',
        url: 'https://www.youtube.com/embed/abc',
        originalUrl: 'https://www.youtube.com/watch?v=abc',
        children: [{ type: 'text', text: '' }],
      },
    ];
    render(
      <BlocksRenderer
        content={content}
        blocks={{
          'media-embed': ({ url }) => <div data-testid="custom-embed">{url}</div>,
        }}
      />
    );
    expect(screen.getByTestId('custom-embed')).toBeInTheDocument();
  });

  it('uses custom table renderers', () => {
    const content: BlocksContent = [
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [{ type: 'table-header-cell', children: [{ type: 'text', text: 'Header' }] }],
          },
          {
            type: 'table-row',
            children: [
              {
                type: 'table-cell',
                align: 'right',
                colSpan: 3,
                children: [{ type: 'text', text: 'Data' }],
              },
            ],
          },
        ],
      },
    ];
    render(
      <BlocksRenderer
        content={content}
        blocks={{
          table: ({ children }) => <div data-testid="custom-table">{children}</div>,
          'table-row': ({ children }) => <div data-testid="custom-row">{children}</div>,
          'table-header-cell': ({ children }) => <div data-testid="custom-th">{children}</div>,
          'table-cell': ({ children, align, colSpan, style }) => (
            <div data-testid="custom-td" data-align={align} data-colspan={colSpan} style={style}>
              {children}
            </div>
          ),
        }}
      />
    );
    expect(screen.getByTestId('custom-table')).toBeInTheDocument();
    expect(screen.getAllByTestId('custom-row')).toHaveLength(2);
    expect(screen.getByTestId('custom-th')).toBeInTheDocument();
    const td = screen.getByTestId('custom-td');
    expect(td).toHaveAttribute('data-align', 'right');
    expect(td).toHaveAttribute('data-colspan', '3');
    expect(td).toHaveStyle({ textAlign: 'right' });
  });

  it('uses custom image renderer with caption and alignment', () => {
    const content: BlocksContent = [
      {
        type: 'image',
        image: { url: 'https://example.com/img.png', alternativeText: 'Photo' },
        caption: 'My caption',
        imageAlign: 'right',
        children: [{ type: 'text', text: '' }],
      },
    ];
    render(
      <BlocksRenderer
        content={content}
        blocks={{
          image: ({ image, caption, imageAlign }) => (
            <div data-testid="custom-img" data-caption={caption} data-align={imageAlign}>
              <img src={image.url} alt={image.alternativeText || ''} />
            </div>
          ),
        }}
      />
    );
    const el = screen.getByTestId('custom-img');
    expect(el).toHaveAttribute('data-caption', 'My caption');
    expect(el).toHaveAttribute('data-align', 'right');
  });

  // ── Custom Modifier Renderers ────────────────────────────────────

  it('uses custom bold modifier', () => {
    const content: BlocksContent = [
      { type: 'paragraph', children: [{ type: 'text', text: 'Bold', bold: true }] },
    ];
    render(
      <BlocksRenderer
        content={content}
        modifiers={{
          bold: ({ children }) => <b data-testid="custom-bold">{children}</b>,
        }}
      />
    );
    expect(screen.getByTestId('custom-bold')).toBeInTheDocument();
  });

  it('uses custom color modifier', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Colored', color: '#FF0000' }],
      },
    ];
    render(
      <BlocksRenderer
        content={content}
        modifiers={{
          color: ({ children, color }) => (
            <span data-testid="custom-color" data-color={color}>
              {children}
            </span>
          ),
        }}
      />
    );
    const el = screen.getByTestId('custom-color');
    expect(el).toHaveAttribute('data-color', '#FF0000');
  });

  it('uses custom backgroundColor modifier', () => {
    const content: BlocksContent = [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Highlighted', backgroundColor: '#FFFF00' }],
      },
    ];
    render(
      <BlocksRenderer
        content={content}
        modifiers={{
          backgroundColor: ({ children, backgroundColor }) => (
            <mark data-testid="custom-bg" style={{ backgroundColor }}>
              {children}
            </mark>
          ),
        }}
      />
    );
    expect(screen.getByTestId('custom-bg')).toBeInTheDocument();
  });

  // ── Diagram (Mermaid) ────────────────────────────────────────────

  it('renders the raw mermaid source as a fallback before/instead of the SVG', () => {
    const content: BlocksContent = [
      {
        type: 'diagram',
        format: 'mermaid',
        value: 'graph TD\n  A-->B',
        children: [{ type: 'text', text: '' }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const pre = container.querySelector('pre.mermaid-source');
    expect(pre).toBeInTheDocument();
    expect(pre?.textContent).toContain('graph TD');
  });

  it('renders a mermaid diagram to inline SVG after mount', async () => {
    const content: BlocksContent = [
      {
        type: 'diagram',
        format: 'mermaid',
        value: 'graph TD\n  A-->B',
        children: [{ type: 'text', text: '' }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    await waitFor(() => {
      expect(container.querySelector('div.mermaid-diagram svg.mock-mermaid')).toBeInTheDocument();
    });
    expect(container.querySelector('div.mermaid-diagram')?.textContent).toContain('A-->B');
  });

  it('uses a custom diagram renderer with code and format props', () => {
    const content: BlocksContent = [
      {
        type: 'diagram',
        format: 'mermaid',
        value: 'pie title Pets',
        children: [{ type: 'text', text: '' }],
      },
    ];
    render(
      <BlocksRenderer
        content={content}
        blocks={{
          diagram: ({ code, format }) => (
            <div data-testid="custom-diagram" data-code={code} data-format={format} />
          ),
        }}
      />
    );
    const el = screen.getByTestId('custom-diagram');
    expect(el).toHaveAttribute('data-code', 'pie title Pets');
    expect(el).toHaveAttribute('data-format', 'mermaid');
  });

  it('renders a callout with the localized variant label and nested content', () => {
    const content: BlocksContent = [
      {
        type: 'callout',
        variant: 'warning',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Be careful.' }] }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const aside = container.querySelector('aside.bb-callout.bb-callout-warning');
    expect(aside).toBeInTheDocument();
    expect(aside).toHaveAttribute('role', 'note');
    // Accent border and matching tinted background (~8% opacity of the accent color)
    expect(aside).toHaveStyle({ borderLeft: '0.25rem solid #9a6700' });
    expect(aside).toHaveStyle({ backgroundColor: '#9a670014' });
    // Default title falls back to the variant label, and the icon is present
    expect(aside?.querySelector('.bb-callout-title')?.textContent).toBe('Warning');
    expect(aside?.querySelector('svg.bb-callout-icon')).toBeInTheDocument();
    // Nested block children are rendered recursively
    const body = aside?.querySelector('p:not(.bb-callout-title)');
    expect(body?.textContent).toBe('Be careful.');
    // Outer margins of the first/last child collapse so the body sits balanced
    // within the callout padding (single child is both first and last)
    expect(body).toHaveStyle({ marginTop: '0px', marginBottom: '0px' });
  });

  it('uses a custom title when provided', () => {
    const content: BlocksContent = [
      {
        type: 'callout',
        variant: 'tip',
        title: 'Pro tip',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'x' }] }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('.bb-callout-title')?.textContent).toBe('Pro tip');
  });

  it('uses a custom callout renderer with variant, title and children', () => {
    const content: BlocksContent = [
      {
        type: 'callout',
        variant: 'important',
        title: 'Heads up',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Body' }] }],
      },
    ];
    render(
      <BlocksRenderer
        content={content}
        blocks={{
          callout: ({ variant, title, children }) => (
            <section data-testid="custom-callout" data-variant={variant} data-title={title}>
              {children}
            </section>
          ),
        }}
      />
    );
    const el = screen.getByTestId('custom-callout');
    expect(el).toHaveAttribute('data-variant', 'important');
    expect(el).toHaveAttribute('data-title', 'Heads up');
    expect(el.textContent).toContain('Body');
  });

  it('renders a details block with a summary and nested content', () => {
    const content: BlocksContent = [
      {
        type: 'details',
        summary: 'Click to expand',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Hidden content.' }] }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const details = container.querySelector('details.bb-details');
    expect(details).toBeInTheDocument();
    // Closed by default when defaultOpen is omitted
    expect(details).not.toHaveAttribute('open');
    const summary = details?.querySelector('summary.bb-details-summary');
    expect(summary?.textContent).toBe('Click to expand');
    // Block children are rendered recursively inside the details
    expect(details?.querySelector('p')?.textContent).toBe('Hidden content.');
  });

  it('honors defaultOpen via the open attribute', () => {
    const content: BlocksContent = [
      {
        type: 'details',
        summary: 'Already open',
        defaultOpen: true,
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Visible.' }] }],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('details.bb-details')).toHaveAttribute('open');
  });

  it('supports arbitrarily nested details blocks', () => {
    const content: BlocksContent = [
      {
        type: 'details',
        summary: 'Outer',
        children: [
          {
            type: 'details',
            summary: 'Inner',
            children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Deep.' }] }],
          },
        ],
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const outer = container.querySelector('details.bb-details');
    const inner = outer?.querySelector('details.bb-details');
    expect(inner).toBeInTheDocument();
    expect(inner?.querySelector('summary')?.textContent).toBe('Inner');
    expect(inner?.querySelector('p')?.textContent).toBe('Deep.');
  });

  it('uses a custom details renderer with summary, defaultOpen and children', () => {
    const content: BlocksContent = [
      {
        type: 'details',
        summary: 'More info',
        defaultOpen: true,
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Body' }] }],
      },
    ];
    render(
      <BlocksRenderer
        content={content}
        blocks={{
          details: ({ summary, defaultOpen, children }) => (
            <details data-testid="custom-details" data-summary={summary} open={defaultOpen}>
              <summary>{summary}</summary>
              {children}
            </details>
          ),
        }}
      />
    );
    const el = screen.getByTestId('custom-details');
    expect(el).toHaveAttribute('data-summary', 'More info');
    expect(el).toHaveAttribute('open');
    expect(el.textContent).toContain('Body');
  });

  it('renders a link-mode button with href, target, rel, aria-label and alignment', () => {
    const content: BlocksContent = [
      {
        type: 'button',
        buttonType: 'link',
        label: 'Get started',
        alignment: 'center',
        link: {
          url: 'https://example.com',
          target: '_blank',
          rel: 'noopener noreferrer',
          ariaLabel: 'Get started now',
        },
        style: { backgroundColor: '#4945ff', textColor: '#ffffff', borderRadius: '4px' },
        cssClass: 'my-cta',
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const wrapper = container.querySelector('.bb-button-wrapper');
    expect(wrapper).toHaveStyle({ textAlign: 'center' });
    const a = container.querySelector('a.bb-button');
    expect(a).toHaveAttribute('href', 'https://example.com');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    expect(a).toHaveAttribute('aria-label', 'Get started now');
    expect(a).toHaveClass('my-cta');
    expect(a?.textContent).toBe('Get started');
    expect(a).toHaveStyle({ backgroundColor: '#4945ff', color: '#ffffff', borderRadius: '4px' });
  });

  it('renders a file-mode button with download, icon and human-readable size', () => {
    const content: BlocksContent = [
      {
        type: 'button',
        buttonType: 'file',
        label: 'Download whitepaper',
        alignment: 'left',
        file: {
          id: 123,
          url: '/uploads/whitepaper.pdf',
          name: 'Product Whitepaper.pdf',
          size: 5242880,
          ext: '.pdf',
          mime: 'application/pdf',
        },
        showFileSize: true,
        showFileIcon: true,
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const a = container.querySelector('a.bb-button');
    expect(a).toHaveAttribute('href', '/uploads/whitepaper.pdf');
    expect(a).toHaveAttribute('download', 'Product Whitepaper.pdf');
    expect(a).toHaveAttribute('aria-label', 'Download Product Whitepaper.pdf');
    expect(a?.querySelector('.bb-button-icon')?.textContent?.trim()).toBe('📄');
    expect(a?.querySelector('.bb-button-size')?.textContent).toBe(' (5 MB)');
    expect(a?.textContent).toContain('Download whitepaper');
  });

  it('omits size and icon in file mode when their flags are off', () => {
    const content: BlocksContent = [
      {
        type: 'button',
        buttonType: 'file',
        label: 'Download',
        file: { url: '/uploads/f.zip', name: 'f.zip', size: 1024, ext: '.zip' },
        showFileSize: false,
        showFileIcon: false,
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const a = container.querySelector('a.bb-button');
    expect(a?.querySelector('.bb-button-icon')).toBeNull();
    expect(a?.querySelector('.bb-button-size')).toBeNull();
  });

  it('opens the file in a new tab (no download) when filePreview is enabled', () => {
    const content: BlocksContent = [
      {
        type: 'button',
        buttonType: 'file',
        label: 'View report',
        filePreview: true,
        file: { url: 'https://cdn.example.com/report.pdf', name: 'report.pdf', ext: '.pdf' },
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const a = container.querySelector('a.bb-button');
    expect(a).toHaveAttribute('href', 'https://cdn.example.com/report.pdf');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    expect(a).not.toHaveAttribute('download');
    expect(a).toHaveAttribute('aria-label', 'Preview report.pdf');
  });

  it('force-downloads a cross-origin file via a blob fetch on click', async () => {
    const blob = new Blob(['data'], { type: 'application/pdf' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
    vi.stubGlobal('fetch', fetchMock);
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const content: BlocksContent = [
      {
        type: 'button',
        buttonType: 'file',
        label: 'Download',
        file: { url: 'https://cdn.example.com/report.pdf', name: 'report.pdf', ext: '.pdf' },
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const a = container.querySelector('a.bb-button') as HTMLAnchorElement;
    expect(a).toHaveAttribute('download', 'report.pdf');

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(a, event);
    expect(event.defaultPrevented).toBe(true);

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledWith(blob));
    expect(fetchMock).toHaveBeenCalledWith('https://cdn.example.com/report.pdf');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('does not intercept modified clicks (e.g. open in new tab)', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const content: BlocksContent = [
      {
        type: 'button',
        buttonType: 'file',
        label: 'Download',
        file: { url: 'https://cdn.example.com/report.pdf', name: 'report.pdf', ext: '.pdf' },
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const a = container.querySelector('a.bb-button') as HTMLAnchorElement;

    const event = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
    fireEvent(a, event);
    expect(event.defaultPrevented).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('exposes hover colors as CSS custom properties', () => {
    const content: BlocksContent = [
      {
        type: 'button',
        buttonType: 'link',
        label: 'Hover me',
        link: { url: '#' },
        style: { hoverBackgroundColor: '#3732c9', hoverTextColor: '#fff' },
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const a = container.querySelector('a.bb-button') as HTMLElement;
    expect(a.style.getPropertyValue('--bb-button-hover-bg')).toBe('#3732c9');
    expect(a.style.getPropertyValue('--bb-button-hover-color')).toBe('#fff');
  });

  it('mirrors base colors into custom properties for the hover fallback', () => {
    const content: BlocksContent = [
      {
        type: 'button',
        buttonType: 'link',
        label: 'Styled',
        link: { url: '#' },
        style: { backgroundColor: '#4945ff', textColor: '#fff' },
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const a = container.querySelector('a.bb-button') as HTMLElement;
    expect(a.style.getPropertyValue('--bb-button-bg')).toBe('#4945ff');
    expect(a.style.getPropertyValue('--bb-button-color')).toBe('#fff');
  });

  it('ships the default hover/focus CSS so hover works with no consumer setup', () => {
    const content: BlocksContent = [
      {
        type: 'button',
        buttonType: 'link',
        label: 'Hover me',
        link: { url: '#' },
        style: { backgroundColor: '#4945ff', hoverBackgroundColor: '#3732c9' },
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const style = container.querySelector('style');
    expect(style).not.toBeNull();
    const css = style?.textContent ?? '';
    expect(css).toContain('.bb-button:hover');
    expect(css).toContain('var(--bb-button-hover-bg,var(--bb-button-bg))');
    expect(css).toContain('!important');
    expect(css).toContain('.bb-button:focus-visible');
  });

  it('does not inject the default button CSS when there is no button', () => {
    const content: BlocksContent = [
      { type: 'paragraph', children: [{ type: 'text', text: 'No buttons here' }] },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('style')).toBeNull();
  });

  it('does not inject the default button CSS when the button block is overridden', () => {
    const content: BlocksContent = [
      { type: 'button', buttonType: 'link', label: 'Custom', link: { url: '#' } },
    ];
    const { container } = render(
      <BlocksRenderer
        content={content}
        blocks={{ button: ({ label }) => <button>{label}</button> }}
      />
    );
    expect(container.querySelector('style')).toBeNull();
  });

  it('renders inline (no wrapper) when alignment is "none"', () => {
    const content: BlocksContent = [
      {
        type: 'button',
        buttonType: 'link',
        label: 'Inline',
        alignment: 'none',
        link: { url: '#' },
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('.bb-button-wrapper')).toBeNull();
    expect(container.querySelector('a.bb-button')?.textContent).toBe('Inline');
  });

  it('uses a custom button renderer via the blocks override', () => {
    const content: BlocksContent = [
      {
        type: 'button',
        buttonType: 'link',
        label: 'Custom',
        alignment: 'right',
        link: { url: 'https://example.com' },
      },
    ];
    render(
      <BlocksRenderer
        content={content}
        blocks={{
          button: ({ label, link, alignment }) => (
            <div data-testid="custom-button" data-align={alignment}>
              <a href={link?.url}>{label}</a>
            </div>
          ),
        }}
      />
    );
    const el = screen.getByTestId('custom-button');
    expect(el).toHaveAttribute('data-align', 'right');
    expect(el.querySelector('a')).toHaveAttribute('href', 'https://example.com');
    expect(el.textContent).toBe('Custom');
  });

  // ── Social Embed ─────────────────────────────────────────────────

  it('renders oembed.html inside a figure with a11y label and alignment', () => {
    const content: BlocksContent = [
      {
        type: 'social-embed',
        platform: 'twitter',
        url: 'https://x.com/user/status/123',
        oembed: {
          html: '<blockquote class="twitter-tweet">Hello tweet</blockquote>',
          author: 'Author Name',
          providerName: 'Twitter',
        },
        alignment: 'center',
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const figure = container.querySelector('figure.bb-social-embed');
    expect(figure).toBeInTheDocument();
    expect(figure).toHaveClass('bb-social-embed-twitter', 'social-embed', 'align-center');
    expect(figure).toHaveAttribute('aria-label', 'Twitter post by Author Name');
    expect(figure?.querySelector('.twitter-tweet')?.textContent).toBe('Hello tweet');
  });

  it('prioritizes embedCode over oembed.html', () => {
    const content: BlocksContent = [
      {
        type: 'social-embed',
        platform: 'instagram',
        url: 'https://instagram.com/p/abc',
        embedCode: '<blockquote class="manual-override">Pasted</blockquote>',
        oembed: { html: '<blockquote class="from-oembed">Fetched</blockquote>' },
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('.manual-override')).toBeInTheDocument();
    expect(container.querySelector('.from-oembed')).not.toBeInTheDocument();
  });

  it('renders a caption below the embed', () => {
    const content: BlocksContent = [
      {
        type: 'social-embed',
        platform: 'tiktok',
        url: 'https://tiktok.com/@user/video/1',
        oembed: { html: '<blockquote>Clip</blockquote>' },
        caption: 'A nice clip',
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const caption = container.querySelector('figcaption.bb-social-embed-caption');
    expect(caption).toBeInTheDocument();
    expect(caption?.textContent).toBe('A nice clip');
  });

  it('defaults alignment to center when omitted', () => {
    const content: BlocksContent = [
      {
        type: 'social-embed',
        platform: 'facebook',
        url: 'https://facebook.com/post/1',
        oembed: { html: '<div>fb</div>' },
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('figure')).toHaveClass('align-center');
  });

  it('renders a fallback link card when no embedCode/oembed html is present', () => {
    const content: BlocksContent = [
      {
        type: 'social-embed',
        platform: 'twitter',
        url: 'https://x.com/user/status/999',
        oembed: {
          author: 'Jane Doe',
          providerName: 'X',
          thumbnailUrl: 'https://example.com/thumb.jpg',
        },
        alignment: 'left',
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const link = container.querySelector('a.bb-social-embed-fallback');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://x.com/user/status/999');
    const thumb = link?.querySelector('img.bb-social-embed-fallback-thumb');
    expect(thumb).toHaveAttribute('src', 'https://example.com/thumb.jpg');
    expect(thumb).toHaveAttribute('loading', 'lazy');
    expect(link?.querySelector('.bb-social-embed-fallback-title')?.textContent).toBe(
      'Post by Jane Doe'
    );
    expect(link?.querySelector('.bb-social-embed-fallback-provider')?.textContent).toBe('X');
  });

  it('omits the provider line when it would just repeat the fallback title', () => {
    const content: BlocksContent = [
      {
        type: 'social-embed',
        platform: 'twitter',
        url: 'https://x.com/user/status/999',
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const link = container.querySelector('a.bb-social-embed-fallback');
    expect(link?.querySelector('.bb-social-embed-fallback-title')?.textContent).toBe('View on X');
    expect(link?.querySelector('.bb-social-embed-fallback-provider')).not.toBeInTheDocument();
  });

  it('sets loading="lazy" on iframes shipped in the embed markup', async () => {
    const content: BlocksContent = [
      {
        type: 'social-embed',
        platform: 'linkedin',
        url: 'https://linkedin.com/posts/1',
        oembed: { html: '<iframe src="https://linkedin.com/embed/1"></iframe>' },
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    await waitFor(() => {
      expect(container.querySelector('iframe')).toHaveAttribute('loading', 'lazy');
    });
  });

  it('injects the platform widget script once, deduped by src', async () => {
    const src = 'https://platform.twitter.com/widgets.js';
    const content: BlocksContent = [
      {
        type: 'social-embed',
        platform: 'twitter',
        url: 'https://x.com/user/status/1',
        oembed: { html: '<blockquote class="twitter-tweet">One</blockquote>' },
      },
      {
        type: 'social-embed',
        platform: 'twitter',
        url: 'https://x.com/user/status/2',
        oembed: { html: '<blockquote class="twitter-tweet">Two</blockquote>' },
      },
    ];
    render(<BlocksRenderer content={content} />);
    await waitFor(() => {
      expect(document.querySelectorAll(`script[src="${src}"]`).length).toBe(1);
    });
  });

  it('strips the inline widget script shipped in the embed markup', () => {
    const content: BlocksContent = [
      {
        type: 'social-embed',
        platform: 'tiktok',
        url: 'https://tiktok.com/@user/video/1',
        oembed: {
          html: '<blockquote class="tiktok-embed">Clip</blockquote><script async src="https://www.tiktok.com/embed.js"></script>',
        },
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const embedHtml = container.querySelector('.bb-social-embed-html');
    expect(embedHtml?.querySelector('.tiktok-embed')).toBeInTheDocument();
    expect(embedHtml?.querySelector('script')).not.toBeInTheDocument();
  });

  it('injects the widget script even when the markup shipped an inert copy of it', async () => {
    const src = 'https://www.tiktok.com/embed.js';
    // An inert `<script>` already in the DOM — the shape a previously-rendered
    // embed (or another library) leaves behind. It must not defeat the loader.
    const inert = document.createElement('script');
    inert.setAttribute('src', src);
    document.body.appendChild(inert);

    const content: BlocksContent = [
      {
        type: 'social-embed',
        platform: 'tiktok',
        url: 'https://tiktok.com/@user/video/2',
        oembed: { html: '<blockquote class="tiktok-embed">Clip</blockquote>' },
      },
    ];
    render(<BlocksRenderer content={content} />);
    await waitFor(() => {
      expect(document.querySelector('script[data-bb-social-script="tiktok"]')).toBeInTheDocument();
    });
  });

  it('re-processes an embed mounted after the widget script has loaded', async () => {
    const render_ = vi.fn();
    (window as unknown as { tiktokEmbed?: unknown }).tiktokEmbed = { lib: { render: render_ } };

    const content: BlocksContent = [
      {
        type: 'social-embed',
        platform: 'tiktok',
        url: 'https://tiktok.com/@user/video/3',
        oembed: { html: '<blockquote class="tiktok-embed">Clip</blockquote>' },
      },
    ];
    const { unmount } = render(<BlocksRenderer content={content} />);
    // jsdom never fetches the injected script, so fake the load that unblocks
    // the loader promise.
    const selector = 'script[data-bb-social-script="tiktok"]';
    await waitFor(() => expect(document.querySelector(selector)).toBeInTheDocument());
    document.querySelectorAll(selector).forEach((s) => s.dispatchEvent(new Event('load')));
    await waitFor(() => expect(render_).toHaveBeenCalled());
    unmount();

    // Second mount (SPA navigation): the script is cached, so hydration depends
    // entirely on the platform processor being re-run.
    render_.mockClear();
    render(<BlocksRenderer content={content} />);
    await waitFor(() => expect(render_).toHaveBeenCalled());
    expect(render_.mock.calls[0][0]).toHaveLength(1);

    delete (window as unknown as { tiktokEmbed?: unknown }).tiktokEmbed;
  });

  it('renders the fallback card without an anchor when the embed has no url', () => {
    const content: BlocksContent = [
      {
        type: 'social-embed',
        platform: 'pinterest',
        url: '',
        oembed: { providerName: 'Pinterest' },
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const card = container.querySelector('.bb-social-embed-fallback');
    expect(card).toBeInTheDocument();
    expect(card?.tagName).toBe('DIV');
    expect(container.querySelector('a')).not.toBeInTheDocument();
  });

  it('uses a custom social-embed renderer', () => {
    const content: BlocksContent = [
      {
        type: 'social-embed',
        platform: 'pinterest',
        url: 'https://pinterest.com/pin/1',
        oembed: { html: '<div>pin</div>' },
        caption: 'Pinned',
      },
    ];
    render(
      <BlocksRenderer
        content={content}
        blocks={{
          'social-embed': ({ platform, url, caption }) => (
            <div data-testid="custom-social" data-platform={platform} data-url={url}>
              {caption}
            </div>
          ),
        }}
      />
    );
    const el = screen.getByTestId('custom-social');
    expect(el).toHaveAttribute('data-platform', 'pinterest');
    expect(el).toHaveAttribute('data-url', 'https://pinterest.com/pin/1');
    expect(el.textContent).toBe('Pinned');
  });

  // ── Audio ────────────────────────────────────────────────────────

  it('renders a native <audio> inside a figure, mapping the player flags 1:1', () => {
    const content: BlocksContent = [
      {
        type: 'audio',
        file: { id: 123, url: '/uploads/episode.mp3', name: 'episode.mp3', hash: 'episode_abc' },
        player: { autoplay: true, loop: true, controls: true, preload: 'auto' },
        alignment: 'center',
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const figure = container.querySelector('figure.bb-audio');
    expect(figure).toBeInTheDocument();
    expect(figure).toHaveClass('bb-audio', 'align-center');

    const audio = container.querySelector('audio') as HTMLAudioElement;
    expect(audio).toBeInTheDocument();
    expect(audio.getAttribute('src')).toBe('/uploads/episode.mp3');
    expect(audio.controls).toBe(true);
    expect(audio.autoplay).toBe(true);
    expect(audio.loop).toBe(true);
    expect(audio.getAttribute('preload')).toBe('auto');
    expect(audio).toHaveAttribute('aria-label', 'Audio player');
  });

  it('defaults controls to true, preload to metadata and alignment to center', () => {
    const content: BlocksContent = [
      {
        type: 'audio',
        file: { url: '/uploads/clip.mp3' },
        player: {},
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const audio = container.querySelector('audio') as HTMLAudioElement;
    expect(audio.controls).toBe(true);
    expect(audio.autoplay).toBe(false);
    expect(audio.loop).toBe(false);
    expect(audio.getAttribute('preload')).toBe('metadata');
    expect(container.querySelector('figure')).toHaveClass('align-center');
  });

  it('renders the title above the player and uses it as the aria-label', () => {
    const content: BlocksContent = [
      {
        type: 'audio',
        file: { url: '/uploads/ep1.mp3' },
        title: 'Episode 1: Introduction',
        player: { controls: true },
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const titleEl = container.querySelector('figcaption.bb-audio-title');
    expect(titleEl?.textContent).toBe('Episode 1: Introduction');
    expect(container.querySelector('audio')).toHaveAttribute(
      'aria-label',
      'Episode 1: Introduction'
    );
  });

  it('renders the caption below the player and wires aria-describedby to it', () => {
    const content: BlocksContent = [
      {
        type: 'audio',
        file: { id: 7, url: '/uploads/ep1.mp3', hash: 'ep1_abc' },
        caption: 'Our first podcast episode',
        player: { controls: true },
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const caption = container.querySelector('figcaption.bb-audio-caption');
    expect(caption).toBeInTheDocument();
    expect(caption?.textContent).toBe('Our first podcast episode');
    const capId = caption?.getAttribute('id');
    expect(capId).toBe('bb-audio-cap-7');
    expect(container.querySelector('audio')).toHaveAttribute('aria-describedby', capId as string);
  });

  it('omits aria-describedby when there is no caption', () => {
    const content: BlocksContent = [
      {
        type: 'audio',
        file: { url: '/uploads/ep1.mp3' },
        player: { controls: true },
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('figcaption')).toBeNull();
    expect(container.querySelector('audio')).not.toHaveAttribute('aria-describedby');
  });

  it('renders full-width for alignment "none"', () => {
    const content: BlocksContent = [
      {
        type: 'audio',
        file: { url: '/uploads/ep1.mp3' },
        player: { controls: true },
        alignment: 'none',
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    expect(container.querySelector('figure')).toHaveClass('align-none');
    const audio = container.querySelector('audio') as HTMLAudioElement;
    expect(audio.style.maxWidth).toBe('100%');
  });

  it('ships fallback text and a download link inside <audio>', () => {
    const content: BlocksContent = [
      {
        type: 'audio',
        file: { url: '/uploads/ep1.mp3' },
        player: { controls: true },
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);
    const audio = container.querySelector('audio') as HTMLAudioElement;
    expect(audio.textContent).toContain('Your browser does not support the audio element.');
    const download = audio.querySelector('a');
    expect(download).toHaveAttribute('href', '/uploads/ep1.mp3');
    expect(download?.textContent).toBe('Download the audio');
  });

  it('uses a custom audio renderer', () => {
    const content: BlocksContent = [
      {
        type: 'audio',
        file: { id: 9, url: '/uploads/ep1.mp3' },
        title: 'My Episode',
        player: { controls: true },
      },
    ];
    render(
      <BlocksRenderer
        content={content}
        blocks={{
          audio: ({ file, title }) => (
            <div data-testid="custom-audio" data-url={file.url}>
              {title}
            </div>
          ),
        }}
      />
    );
    const el = screen.getByTestId('custom-audio');
    expect(el).toHaveAttribute('data-url', '/uploads/ep1.mp3');
    expect(el.textContent).toBe('My Episode');
  });

  // ── Embed (generic iframe) ───────────────────────────────────────

  const EMBED_HTML =
    '<iframe src="https://www.youtube.com/embed/abc12345678" title="Product Demo" allowfullscreen loading="lazy"></iframe>';

  it('renders the sanitized embedHtml inside an aspect-ratio box', () => {
    const content: BlocksContent = [
      {
        type: 'embed',
        source: 'url',
        url: 'https://www.youtube.com/watch?v=abc12345678',
        embedHtml: EMBED_HTML,
        embedSrc: 'https://www.youtube.com/embed/abc12345678',
        provider: 'youtube',
        aspectRatio: '16:9',
        alignment: 'center',
        title: 'Product Demo',
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);

    const figure = container.querySelector('figure.bb-embed');
    expect(figure).toHaveClass('bb-embed', 'align-center');
    expect(figure).toHaveAttribute('aria-label', 'Product Demo');

    const frame = container.querySelector('.bb-embed-frame') as HTMLElement;
    expect(frame.style.aspectRatio).toBe('16 / 9');
    expect(frame.style.maxWidth).toBe('48rem');

    const iframe = frame.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toBe('https://www.youtube.com/embed/abc12345678');
    expect(iframe.getAttribute('title')).toBe('Product Demo');
  });

  it('ships the embed frame stylesheet only when a default embed renders', () => {
    const embed: BlocksContent = [{ type: 'embed', embedHtml: EMBED_HTML }];
    const { container } = render(<BlocksRenderer content={embed} />);
    expect(container.querySelector('style')?.textContent).toContain('.bb-embed-frame iframe');

    const paragraph: BlocksContent = [
      { type: 'paragraph', children: [{ type: 'text', text: 'Hi' }] },
    ];
    const { container: plain } = render(<BlocksRenderer content={paragraph} />);
    expect(plain.querySelector('style')).toBeNull();

    const { container: overridden } = render(
      <BlocksRenderer content={embed} blocks={{ embed: () => <div /> }} />
    );
    expect(overridden.querySelector('style')).toBeNull();
  });

  it('converts each aspect ratio to a CSS value', () => {
    const ratios: Array<[BlocksContent[number], string]> = [
      [{ type: 'embed', embedHtml: EMBED_HTML, aspectRatio: '21:9' }, '21 / 9'],
      [{ type: 'embed', embedHtml: EMBED_HTML, aspectRatio: '4:3' }, '4 / 3'],
      [{ type: 'embed', embedHtml: EMBED_HTML, aspectRatio: '1:1' }, '1 / 1'],
      [
        { type: 'embed', embedHtml: EMBED_HTML, aspectRatio: 'custom', customAspectRatio: '3 / 2' },
        '3 / 2',
      ],
      // Missing (or an empty custom value) falls back to 16:9.
      [{ type: 'embed', embedHtml: EMBED_HTML }, '16 / 9'],
      [{ type: 'embed', embedHtml: EMBED_HTML, aspectRatio: 'custom' }, '16 / 9'],
    ];

    for (const [block, expected] of ratios) {
      const { container } = render(<BlocksRenderer content={[block]} />);
      const frame = container.querySelector('.bb-embed-frame') as HTMLElement;
      expect(frame.style.aspectRatio).toBe(expected);
    }
  });

  it('stretches an embed with alignment "none" and caps the aligned ones', () => {
    const { container } = render(
      <BlocksRenderer content={[{ type: 'embed', embedHtml: EMBED_HTML, alignment: 'none' }]} />
    );
    const figure = container.querySelector('figure.bb-embed') as HTMLElement;
    expect(figure).toHaveClass('align-none');
    expect(figure.style.alignItems).toBe('stretch');
    expect((container.querySelector('.bb-embed-frame') as HTMLElement).style.maxWidth).toBe('100%');

    const { container: right } = render(
      <BlocksRenderer content={[{ type: 'embed', embedHtml: EMBED_HTML, alignment: 'right' }]} />
    );
    expect((right.querySelector('figure.bb-embed') as HTMLElement).style.alignItems).toBe(
      'flex-end'
    );
  });

  it('renders an embed caption in a figcaption', () => {
    const { container } = render(
      <BlocksRenderer
        content={[{ type: 'embed', embedHtml: EMBED_HTML, caption: 'A video explaining it' }]}
      />
    );
    expect(container.querySelector('figcaption.bb-embed-caption')?.textContent).toBe(
      'A video explaining it'
    );
  });

  it('falls back to a link when an embed has no embedHtml', () => {
    const { container } = render(
      <BlocksRenderer
        content={[{ type: 'embed', url: 'https://example.com/watch', title: 'Demo' }]}
      />
    );
    const link = container.querySelector('a.bb-embed-fallback') as HTMLAnchorElement;
    expect(link).toHaveAttribute('href', 'https://example.com/watch');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.textContent).toBe('Demo');

    // No markup and no URL — nothing to render at all.
    const { container: empty } = render(<BlocksRenderer content={[{ type: 'embed' }]} />);
    expect(empty.querySelector('figure.bb-embed')).toBeNull();
  });

  it('uses a custom embed renderer with the parsed parts', () => {
    render(
      <BlocksRenderer
        content={[
          {
            type: 'embed',
            source: 'url',
            url: 'https://vimeo.com/12345',
            embedHtml: EMBED_HTML,
            embedSrc: 'https://player.vimeo.com/video/12345',
            provider: 'vimeo',
          },
        ]}
        blocks={{
          embed: ({ provider, embedSrc, source }) => (
            <div data-testid="custom-embed" data-provider={provider} data-source={source}>
              {embedSrc}
            </div>
          ),
        }}
      />
    );
    const el = screen.getByTestId('custom-embed');
    expect(el).toHaveAttribute('data-provider', 'vimeo');
    expect(el).toHaveAttribute('data-source', 'url');
    expect(el.textContent).toBe('https://player.vimeo.com/video/12345');
  });

  // ── Video ────────────────────────────────────────────────────────

  it('renders a native <video>, mapping the player flags 1:1', () => {
    const content: BlocksContent = [
      {
        type: 'video',
        provider: 'local',
        url: '/uploads/demo.mp4',
        poster: '/uploads/demo.jpg',
        file: { id: 12, name: 'demo.mp4', mime: 'video/mp4' },
        player: { autoplay: true, loop: true, muted: true, controls: true },
        aspectRatio: '16:9',
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);

    const figure = container.querySelector('figure.bb-video');
    expect(figure).toHaveClass('bb-video', 'align-center');

    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe('/uploads/demo.mp4');
    expect(video.getAttribute('poster')).toBe('/uploads/demo.jpg');
    expect(video.controls).toBe(true);
    expect(video.autoplay).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.muted).toBe(true);
    // A direct file can be prefetched; a streaming manifest can't (see below).
    expect(video.getAttribute('preload')).toBe('metadata');
    expect(video).toHaveAttribute('aria-label', 'Video player');
    expect((container.querySelector('.bb-video-frame') as HTMLElement).style.aspectRatio).toBe(
      '16 / 9'
    );
  });

  it('defaults the video player flags to controls-only playback', () => {
    const { container } = render(
      <BlocksRenderer content={[{ type: 'video', provider: 'local', url: '/uploads/demo.mp4' }]} />
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.controls).toBe(true);
    expect(video.autoplay).toBe(false);
    expect(video.loop).toBe(false);
    expect(video.muted).toBe(false);
  });

  it('renders the video title, caption and transcript track', () => {
    const content: BlocksContent = [
      {
        type: 'video',
        provider: 'local',
        url: '/uploads/demo.mp4',
        file: { id: 12 },
        title: 'Introduction Video',
        caption: 'Watch this to get started',
        transcript: 'https://example.com/captions.vtt',
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);

    expect(container.querySelector('figcaption.bb-video-title')?.textContent).toBe(
      'Introduction Video'
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video).toHaveAttribute('aria-label', 'Introduction Video');

    const caption = container.querySelector('figcaption.bb-video-caption') as HTMLElement;
    expect(caption.textContent).toBe('Watch this to get started');
    expect(caption.id).toBe('bb-video-cap-12');
    expect(video).toHaveAttribute('aria-describedby', 'bb-video-cap-12');

    const track = video.querySelector('track') as HTMLTrackElement;
    expect(track).toHaveAttribute('kind', 'captions');
    expect(track).toHaveAttribute('src', 'https://example.com/captions.vtt');
  });

  it('omits aria-describedby on a video with no caption', () => {
    const { container } = render(
      <BlocksRenderer content={[{ type: 'video', provider: 'local', url: '/uploads/demo.mp4' }]} />
    );
    expect(container.querySelector('video')).not.toHaveAttribute('aria-describedby');
  });

  it('ships fallback text and a download link inside <video>', () => {
    const { container } = render(
      <BlocksRenderer content={[{ type: 'video', provider: 'local', url: '/uploads/demo.mp4' }]} />
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.textContent).toContain('Your browser does not support the video element.');
    expect(video.querySelector('a')).toHaveAttribute('href', '/uploads/demo.mp4');
  });

  it('does not prefetch an HLS manifest the browser may not parse', () => {
    const { container } = render(
      <BlocksRenderer
        content={[
          {
            type: 'video',
            provider: 'mux',
            url: 'https://stream.mux.com/def456.m3u8',
            playbackId: 'def456',
            poster: 'https://image.mux.com/def456/thumbnail.jpg',
          },
        ]}
      />
    );
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.getAttribute('preload')).toBe('none');
    // No mux-player registered and no window.Hls — the poster carries the block.
    expect(video.getAttribute('poster')).toBe('https://image.mux.com/def456/thumbnail.jpg');
  });

  it('attaches window.Hls to an HLS source when the consumer provides it', () => {
    const loadSource = vi.fn();
    const attachMedia = vi.fn();
    const destroy = vi.fn();
    class FakeHls {
      static isSupported = () => true;
      loadSource = loadSource;
      attachMedia = attachMedia;
      destroy = destroy;
    }
    (window as unknown as { Hls?: unknown }).Hls = FakeHls;

    try {
      const { container, unmount } = render(
        <BlocksRenderer
          content={[
            {
              type: 'video',
              provider: 'mux',
              url: 'https://stream.mux.com/def456.m3u8',
              playbackId: 'def456',
            },
          ]}
        />
      );

      expect(loadSource).toHaveBeenCalledWith('https://stream.mux.com/def456.m3u8');
      expect(attachMedia).toHaveBeenCalledWith(container.querySelector('video'));

      unmount();
      expect(destroy).toHaveBeenCalled();
    } finally {
      delete (window as unknown as { Hls?: unknown }).Hls;
    }
  });

  it('prefers hls.js over a browser that only claims to play HLS', () => {
    // Chrome answers "maybe" for application/vnd.apple.mpegurl and then plays
    // nothing, so canPlayType must not win over an available hls.js.
    const canPlayType = vi
      .spyOn(window.HTMLMediaElement.prototype, 'canPlayType')
      .mockReturnValue('maybe');
    const attachMedia = vi.fn();
    class FakeHls {
      static isSupported = () => true;
      loadSource = vi.fn();
      attachMedia = attachMedia;
      destroy = vi.fn();
    }
    (window as unknown as { Hls?: unknown }).Hls = FakeHls;

    try {
      render(
        <BlocksRenderer
          content={[{ type: 'video', provider: 'mux', url: 'https://stream.mux.com/x.m3u8' }]}
        />
      );
      expect(attachMedia).toHaveBeenCalled();
    } finally {
      delete (window as unknown as { Hls?: unknown }).Hls;
      canPlayType.mockRestore();
    }
  });

  it('leaves a direct file URL alone even when hls.js is available', () => {
    const loadSource = vi.fn();
    class FakeHls {
      static isSupported = () => true;
      loadSource = loadSource;
      attachMedia = vi.fn();
      destroy = vi.fn();
    }
    (window as unknown as { Hls?: unknown }).Hls = FakeHls;

    try {
      render(
        <BlocksRenderer
          content={[{ type: 'video', provider: 'local', url: '/uploads/demo.mp4' }]}
        />
      );
      expect(loadSource).not.toHaveBeenCalled();
    } finally {
      delete (window as unknown as { Hls?: unknown }).Hls;
    }
  });

  it('renders <mux-player> once the custom element is registered', async () => {
    const content: BlocksContent = [
      {
        type: 'video',
        provider: 'mux',
        url: 'https://stream.mux.com/def456.m3u8',
        playbackId: 'def456',
        poster: 'https://image.mux.com/def456/thumbnail.jpg',
        title: 'Introduction Video',
      },
    ];
    const { container } = render(<BlocksRenderer content={content} />);

    // Not registered yet — the native element holds the place.
    expect(container.querySelector('mux-player')).toBeNull();
    expect(container.querySelector('video')).toBeInTheDocument();

    customElements.define('mux-player', class extends HTMLElement {});

    await waitFor(() => {
      const mux = container.querySelector('mux-player');
      expect(mux).toBeInTheDocument();
      expect(mux).toHaveAttribute('playback-id', 'def456');
      expect(mux).toHaveAttribute('poster', 'https://image.mux.com/def456/thumbnail.jpg');
      expect(mux).toHaveAttribute('metadata-video-title', 'Introduction Video');
    });
    expect(container.querySelector('video')).toBeNull();
  });

  it('uses a custom video renderer', () => {
    render(
      <BlocksRenderer
        content={[
          {
            type: 'video',
            provider: 'mux',
            url: 'https://stream.mux.com/def456.m3u8',
            playbackId: 'def456',
            title: 'Intro',
          },
        ]}
        blocks={{
          video: ({ provider, playbackId, title }) => (
            <div data-testid="custom-video" data-provider={provider} data-playback-id={playbackId}>
              {title}
            </div>
          ),
        }}
      />
    );
    const el = screen.getByTestId('custom-video');
    expect(el).toHaveAttribute('data-provider', 'mux');
    expect(el).toHaveAttribute('data-playback-id', 'def456');
    expect(el.textContent).toBe('Intro');
  });
});
