import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parseHTML } from 'linkedom';
import { describe, it, expect, beforeAll } from 'vitest';

import BlocksRenderer from '../src/BlocksRenderer.astro';
import type {
  BlocksContent,
  CustomBlocksConfig,
  CustomModifiersConfig,
  DiagramTheme,
} from '../src/types';

import CustomParagraph from './fixtures/CustomParagraph.astro';
import CustomHeading from './fixtures/CustomHeading.astro';
import CustomLink from './fixtures/CustomLink.astro';
import CustomHr from './fixtures/CustomHr.astro';
import CustomEmbed from './fixtures/CustomEmbed.astro';
import CustomTable from './fixtures/CustomTable.astro';
import CustomRow from './fixtures/CustomRow.astro';
import CustomTh from './fixtures/CustomTh.astro';
import CustomTd from './fixtures/CustomTd.astro';
import CustomCode from './fixtures/CustomCode.astro';
import CustomQuote from './fixtures/CustomQuote.astro';
import CustomImage from './fixtures/CustomImage.astro';
import CustomMath from './fixtures/CustomMath.astro';
import CustomDiagram from './fixtures/CustomDiagram.astro';
import CustomCallout from './fixtures/CustomCallout.astro';
import CustomDetails from './fixtures/CustomDetails.astro';
import CustomButton from './fixtures/CustomButton.astro';
import CustomSocialEmbed from './fixtures/CustomSocialEmbed.astro';
import CustomAudio from './fixtures/CustomAudio.astro';
import CustomEmbedBlock from './fixtures/CustomEmbedBlock.astro';
import CustomVideo from './fixtures/CustomVideo.astro';
import CustomBold from './fixtures/CustomBold.astro';
import CustomColor from './fixtures/CustomColor.astro';
import CustomBg from './fixtures/CustomBg.astro';

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

type RenderProps = {
  blocks?: CustomBlocksConfig;
  modifiers?: CustomModifiersConfig;
  diagramTheme?: DiagramTheme;
  codeTheme?: string;
  codeCopyButton?: boolean;
};

async function render(content: BlocksContent | null, props: RenderProps = {}) {
  const raw = await container.renderToString(BlocksRenderer, {
    props: { content, ...props },
  });
  // Strip Astro's dev-only source-mapping attributes for clean assertions.
  const html = raw.replace(/ data-astro-source-(file|loc)="[^"]*"/g, '');
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  return { html, document, container: document.body as unknown as HTMLElement };
}

/** Normalized inline-style string (whitespace removed) for substring checks. */
function styleOf(el: Element | null): string {
  return (el?.getAttribute('style') ?? '').replace(/\s/g, '');
}

function byText(root: ParentNode, text: string): Element | null {
  return (
    Array.from(root.querySelectorAll('*')).find((el) =>
      Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent === text)
    ) ?? null
  );
}

describe('BlocksRenderer', () => {
  it('returns empty for empty content', async () => {
    const { container } = await render([]);
    expect(container.innerHTML.trim()).toBe('');
  });

  it('returns empty for undefined-ish content', async () => {
    const { container } = await render(null);
    expect(container.innerHTML.trim()).toBe('');
  });

  // ── Paragraphs ───────────────────────────────────────────────────

  it('renders a paragraph with plain text', async () => {
    const { container } = await render([
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello world' }] },
    ]);
    const p = container.querySelector('p');
    expect(p).not.toBeNull();
    expect(p?.textContent).toBe('Hello world');
  });

  // ── Headings ─────────────────────────────────────────────────────

  it('renders headings h1-h6', async () => {
    const { container } = await render([
      { type: 'heading', level: 1, children: [{ type: 'text', text: 'H1' }] },
      { type: 'heading', level: 2, children: [{ type: 'text', text: 'H2' }] },
      { type: 'heading', level: 3, children: [{ type: 'text', text: 'H3' }] },
    ]);
    expect(container.querySelector('h1')?.textContent).toBe('H1');
    expect(container.querySelector('h2')?.textContent).toBe('H2');
    expect(container.querySelector('h3')?.textContent).toBe('H3');
  });

  // ── Standard Marks ───────────────────────────────────────────────

  it('renders bold text', async () => {
    const { container } = await render([
      { type: 'paragraph', children: [{ type: 'text', text: 'Bold', bold: true }] },
    ]);
    expect(container.querySelector('strong')?.textContent).toBe('Bold');
  });

  it('renders italic text', async () => {
    const { container } = await render([
      { type: 'paragraph', children: [{ type: 'text', text: 'Italic', italic: true }] },
    ]);
    expect(container.querySelector('em')?.textContent).toBe('Italic');
  });

  it('renders underline text', async () => {
    const { container } = await render([
      { type: 'paragraph', children: [{ type: 'text', text: 'Under', underline: true }] },
    ]);
    const span = container.querySelector('span');
    expect(span?.textContent).toBe('Under');
    expect(styleOf(span)).toContain('text-decoration:underline');
  });

  it('renders strikethrough text', async () => {
    const { container } = await render([
      { type: 'paragraph', children: [{ type: 'text', text: 'Strike', strikethrough: true }] },
    ]);
    expect(container.querySelector('del')?.textContent).toBe('Strike');
  });

  it('renders inline code', async () => {
    const { container } = await render([
      { type: 'paragraph', children: [{ type: 'text', text: 'Code', code: true }] },
    ]);
    expect(container.querySelector('code')?.textContent).toBe('Code');
  });

  // ── Color & Background Marks ─────────────────────────────────────

  it('renders text with color', async () => {
    const { container } = await render([
      { type: 'paragraph', children: [{ type: 'text', text: 'Red', color: '#E53E3E' }] },
    ]);
    const span = container.querySelector('span');
    expect(span?.textContent).toBe('Red');
    expect(styleOf(span)).toContain('color:#E53E3E');
  });

  it('renders text with backgroundColor', async () => {
    const { container } = await render([
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Highlighted', backgroundColor: '#FED7D7' }],
      },
    ]);
    const span = container.querySelector('span');
    expect(span?.textContent).toBe('Highlighted');
    expect(styleOf(span)).toContain('background-color:#FED7D7');
  });

  it('renders text with both color and backgroundColor', async () => {
    const { container } = await render([
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Both', color: '#E53E3E', backgroundColor: '#FED7D7' }],
      },
    ]);
    expect(container.querySelector('span[style*="background-color"]')).not.toBeNull();
    expect(container.querySelector('span[style*="color"]')).not.toBeNull();
  });

  it('renders bold + color combined', async () => {
    const { container } = await render([
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'BoldRed', bold: true, color: '#E53E3E' }],
      },
    ]);
    const strong = container.querySelector('strong');
    expect(strong?.textContent).toBe('BoldRed');
    expect(strong?.closest('span[style*="color"]')).not.toBeNull();
  });

  // ── Links ────────────────────────────────────────────────────────

  it('renders links', async () => {
    const { container } = await render([
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
    ]);
    const a = container.querySelector('a');
    expect(a?.textContent).toBe('Click me');
    expect(a?.getAttribute('href')).toBe('https://example.com');
  });

  it('renders links with target="_blank" and rel', async () => {
    const { container } = await render([
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
    ]);
    const a = container.querySelector('a');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('does not set target when not provided', async () => {
    const { container } = await render([
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
    ]);
    expect(container.querySelector('a')?.hasAttribute('target')).toBe(false);
  });

  // ── Lists ────────────────────────────────────────────────────────

  it('renders unordered lists', async () => {
    const { container } = await render([
      {
        type: 'list',
        format: 'unordered',
        children: [
          { type: 'list-item', children: [{ type: 'text', text: 'Item 1' }] },
          { type: 'list-item', children: [{ type: 'text', text: 'Item 2' }] },
        ],
      },
    ]);
    const li = byText(container, 'Item 1');
    expect(li?.closest('ul')).not.toBeNull();
    expect(li?.closest('li')).not.toBeNull();
  });

  it('renders ordered lists', async () => {
    const { container } = await render([
      {
        type: 'list',
        format: 'ordered',
        children: [{ type: 'list-item', children: [{ type: 'text', text: 'First' }] }],
      },
    ]);
    expect(byText(container, 'First')?.closest('ol')).not.toBeNull();
  });

  it('renders nested lists', async () => {
    const { container } = await render([
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
    ]);
    const childLi = byText(container, 'Child')?.closest('li');
    const nestedUl = childLi?.closest('ul');
    const outerUl = nestedUl?.parentElement?.closest('ul');
    expect(outerUl).not.toBeNull();
  });

  it('applies cycling list-style-type for unordered lists based on indentLevel', async () => {
    const { container } = await render([
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
    ]);
    const uls = container.querySelectorAll('ul');
    expect(styleOf(uls[0])).toContain('list-style-type:disc');
    expect(styleOf(uls[1])).toContain('list-style-type:circle');
    expect(styleOf(uls[2])).toContain('list-style-type:square');
  });

  it('applies cycling list-style-type for ordered lists based on indentLevel', async () => {
    const { container } = await render([
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
    ]);
    const ols = container.querySelectorAll('ol');
    expect(styleOf(ols[0])).toContain('list-style-type:decimal');
    expect(styleOf(ols[1])).toContain('list-style-type:lower-alpha');
    expect(styleOf(ols[2])).toContain('list-style-type:upper-roman');
  });

  it('cycles list-style-type back to start after exhausting styles', async () => {
    const { container } = await render([
      {
        type: 'list',
        format: 'unordered',
        indentLevel: 3,
        children: [{ type: 'list-item', children: [{ type: 'text', text: 'Level 3' }] }],
      },
    ]);
    expect(styleOf(container.querySelector('ul'))).toContain('list-style-type:disc');
  });

  it('defaults to indentLevel 0 when not provided', async () => {
    const { container } = await render([
      {
        type: 'list',
        format: 'unordered',
        children: [{ type: 'list-item', children: [{ type: 'text', text: 'No indent' }] }],
      },
    ]);
    expect(styleOf(container.querySelector('ul'))).toContain('list-style-type:disc');
  });

  it('supports mixed ordered/unordered nested lists with indentLevel', async () => {
    const { container } = await render([
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
    ]);
    expect(styleOf(container.querySelector('ul'))).toContain('list-style-type:disc');
    expect(styleOf(container.querySelector('ol'))).toContain('list-style-type:lower-alpha');
  });

  // ── To-do Lists ──────────────────────────────────────────────────

  it('renders to-do list with checkboxes', async () => {
    const { container } = await render([
      {
        type: 'list',
        format: 'todo',
        children: [
          { type: 'list-item', checked: false, children: [{ type: 'text', text: 'Unchecked' }] },
          { type: 'list-item', checked: true, children: [{ type: 'text', text: 'Checked' }] },
        ],
      },
    ]);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0].hasAttribute('checked')).toBe(false);
    expect(checkboxes[1].hasAttribute('checked')).toBe(true);
  });

  it('applies strikethrough and opacity to checked to-do items', async () => {
    const { container } = await render([
      {
        type: 'list',
        format: 'todo',
        children: [
          { type: 'list-item', checked: true, children: [{ type: 'text', text: 'Done' }] },
        ],
      },
    ]);
    const span = byText(container, 'Done');
    expect(styleOf(span)).toContain('text-decoration:line-through');
    expect(styleOf(span)).toContain('opacity:0.6');
  });

  it('renders to-do list without bullet markers', async () => {
    const { container } = await render([
      {
        type: 'list',
        format: 'todo',
        children: [
          { type: 'list-item', checked: false, children: [{ type: 'text', text: 'Task' }] },
        ],
      },
    ]);
    expect(styleOf(container.querySelector('ul'))).toContain('list-style:none');
  });

  // ── Quote ────────────────────────────────────────────────────────

  it('renders blockquote', async () => {
    const { container } = await render([
      { type: 'quote', children: [{ type: 'text', text: 'Wise words' }] },
    ]);
    expect(byText(container, 'Wise words')?.closest('blockquote')).not.toBeNull();
  });

  it('renders blockquote with the bb-quote class', async () => {
    const { container } = await render([
      { type: 'quote', children: [{ type: 'text', text: 'Wise words' }] },
    ]);
    expect(container.querySelector('blockquote.bb-quote')).not.toBeNull();
  });

  it('uses a custom quote renderer', async () => {
    const { container } = await render(
      [{ type: 'quote', children: [{ type: 'text', text: 'Wise words' }] }],
      { blocks: { quote: CustomQuote } }
    );
    expect(container.querySelector('[data-testid="custom-quote"]')?.textContent).toBe('Wise words');
    expect(container.querySelector('blockquote')).toBeNull();
  });

  // ── Code Block ───────────────────────────────────────────────────

  it('renders code block', async () => {
    const { container } = await render([
      { type: 'code', children: [{ type: 'text', text: 'const x = 1;' }] },
    ]);
    const code = container.querySelector('code');
    expect(code?.textContent).toBe('const x = 1;');
    expect(code?.closest('pre')).not.toBeNull();
  });

  it('wraps code blocks in a bb-code container', async () => {
    const { container } = await render([
      { type: 'code', children: [{ type: 'text', text: 'const x = 1;' }] },
    ]);
    expect(container.querySelector('.bb-code')).not.toBeNull();
    expect(container.querySelector('.bb-code .astro-code')).not.toBeNull();
  });

  it('highlights code blocks with the given language', async () => {
    const { container } = await render([
      { type: 'code', language: 'typescript', children: [{ type: 'text', text: 'const x = 1;' }] },
    ]);
    expect(container.querySelector('pre.astro-code')?.getAttribute('data-language')).toBe(
      'typescript'
    );
  });

  it('falls back to plaintext for unknown or missing languages', async () => {
    const { container } = await render([
      { type: 'code', language: 'not-a-real-lang', children: [{ type: 'text', text: 'hi' }] },
    ]);
    expect(container.querySelector('pre.astro-code')?.getAttribute('data-language')).toBe(
      'plaintext'
    );
  });

  it('maps editor language values to Shiki grammar ids', async () => {
    const { container } = await render([
      { type: 'code', language: 'objectivec', children: [{ type: 'text', text: 'int a;' }] },
    ]);
    expect(container.querySelector('pre.astro-code')?.getAttribute('data-language')).toBe(
      'objective-c'
    );
  });

  it('applies the codeTheme prop to the highlighted output', async () => {
    const { container } = await render(
      [
        {
          type: 'code',
          language: 'javascript',
          children: [{ type: 'text', text: 'const x = 1;' }],
        },
      ],
      { codeTheme: 'github-light' }
    );
    expect(container.querySelector('pre.astro-code')?.classList.contains('github-light')).toBe(
      true
    );
  });

  it('omits the copy button by default', async () => {
    const { container } = await render([
      { type: 'code', children: [{ type: 'text', text: 'const x = 1;' }] },
    ]);
    expect(container.querySelector('[data-bb-code-copy]')).toBeNull();
  });

  it('renders an opt-in copy button when codeCopyButton is set', async () => {
    const { container } = await render(
      [{ type: 'code', children: [{ type: 'text', text: 'const x = 1;' }] }],
      { codeCopyButton: true }
    );
    expect(container.querySelector('.bb-code button[data-bb-code-copy]')).not.toBeNull();
  });

  it('uses a custom code renderer with plainText and language', async () => {
    const { container } = await render(
      [{ type: 'code', language: 'python', children: [{ type: 'text', text: 'x = 1' }] }],
      { blocks: { code: CustomCode } }
    );
    const custom = container.querySelector('[data-testid="custom-code"]');
    expect(custom).not.toBeNull();
    expect(custom?.getAttribute('data-language')).toBe('python');
    expect(custom?.textContent).toContain('x = 1');
    expect(container.querySelector('.astro-code')).toBeNull();
  });

  // ── Image ────────────────────────────────────────────────────────

  it('renders images', async () => {
    const { container } = await render([
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
    ]);
    const img = container.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('An image');
    expect(img?.getAttribute('src')).toBe('https://example.com/img.png');
    expect(img?.getAttribute('width')).toBe('200');
    expect(img?.getAttribute('height')).toBe('100');
  });

  it('renders image with caption', async () => {
    const { container } = await render([
      {
        type: 'image',
        image: { url: 'https://example.com/img.png', alternativeText: 'Photo' },
        caption: 'A beautiful photo',
        children: [{ type: 'text', text: '' }],
      },
    ]);
    expect(container.querySelector('figcaption')?.textContent).toBe('A beautiful photo');
  });

  it('does not render figcaption when caption is empty', async () => {
    const { container } = await render([
      {
        type: 'image',
        image: { url: 'https://example.com/img.png', alternativeText: 'Photo' },
        children: [{ type: 'text', text: '' }],
      },
    ]);
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('renders image inside a figure element', async () => {
    const { container } = await render([
      {
        type: 'image',
        image: { url: 'https://example.com/img.png', alternativeText: 'Photo' },
        children: [{ type: 'text', text: '' }],
      },
    ]);
    expect(container.querySelector('figure')).not.toBeNull();
  });

  it('renders image with alignment', async () => {
    const { container } = await render([
      {
        type: 'image',
        image: { url: 'https://example.com/img.png', alternativeText: 'Photo' },
        imageAlign: 'left',
        children: [{ type: 'text', text: '' }],
      },
    ]);
    expect(styleOf(container.querySelector('figure'))).toContain('text-align:left');
  });

  it('defaults image alignment to center', async () => {
    const { container } = await render([
      {
        type: 'image',
        image: { url: 'https://example.com/img.png', alternativeText: 'Photo' },
        children: [{ type: 'text', text: '' }],
      },
    ]);
    expect(styleOf(container.querySelector('figure'))).toContain('text-align:center');
  });

  // ── Horizontal Line ──────────────────────────────────────────────

  it('renders horizontal line', async () => {
    const { container } = await render([
      { type: 'horizontal-line', children: [{ type: 'text', text: '' }] },
    ]);
    expect(container.querySelector('hr')).not.toBeNull();
  });

  // ── Text Alignment ───────────────────────────────────────────────

  it('renders paragraph with text alignment', async () => {
    const { container } = await render([
      { type: 'paragraph', textAlign: 'center', children: [{ type: 'text', text: 'Centered' }] },
    ]);
    expect(styleOf(container.querySelector('p'))).toContain('text-align:center');
  });

  it('renders heading with text alignment', async () => {
    const { container } = await render([
      {
        type: 'heading',
        level: 2,
        textAlign: 'right',
        children: [{ type: 'text', text: 'Right H2' }],
      },
    ]);
    expect(styleOf(container.querySelector('h2'))).toContain('text-align:right');
  });

  it('renders blockquote with text alignment', async () => {
    const { container } = await render([
      { type: 'quote', textAlign: 'center', children: [{ type: 'text', text: 'Centered quote' }] },
    ]);
    expect(styleOf(container.querySelector('blockquote'))).toContain('text-align:center');
  });

  it('does not apply textAlign style when not set', async () => {
    const { container } = await render([
      { type: 'paragraph', children: [{ type: 'text', text: 'Default' }] },
    ]);
    expect(container.querySelector('p')?.getAttribute('style')).toBeNull();
  });

  // ── Tables ───────────────────────────────────────────────────────

  it('renders a table with header and data cells', async () => {
    const { container } = await render([
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
    ]);
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('td')).toHaveLength(2);
    expect(container.querySelector('th')?.textContent).toBe('Name');
    expect(container.querySelector('td')?.textContent).toBe('Alice');
  });

  it('renders table within tbody', async () => {
    const { container } = await render([
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [{ type: 'table-cell', children: [{ type: 'text', text: 'Cell' }] }],
          },
        ],
      },
    ]);
    expect(container.querySelector('tbody')).not.toBeNull();
  });

  it('applies the bb-table class and splits header rows into thead', async () => {
    const { container } = await render([
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
    ]);
    expect(container.querySelector('table.bb-table')).not.toBeNull();
    // Header row lives in <thead>, data row in <tbody>.
    expect(container.querySelectorAll('thead th')).toHaveLength(2);
    expect(container.querySelector('thead td')).toBeNull();
    expect(container.querySelectorAll('tbody td')).toHaveLength(2);
    expect(container.querySelector('tbody th')).toBeNull();
  });

  it('renders a headerless table without an empty thead', async () => {
    const { container } = await render([
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [{ type: 'table-cell', children: [{ type: 'text', text: 'Cell' }] }],
          },
        ],
      },
    ]);
    expect(container.querySelector('thead')).toBeNull();
    expect(container.querySelectorAll('tbody td')).toHaveLength(1);
  });

  it('renders header cells as <th scope="col">', async () => {
    const { container } = await render([
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [{ type: 'table-header-cell', children: [{ type: 'text', text: 'Name' }] }],
          },
        ],
      },
    ]);
    expect(container.querySelector('th')?.getAttribute('scope')).toBe('col');
    // Data cells carry no scope.
    const { container: c2 } = await render([
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [{ type: 'table-cell', children: [{ type: 'text', text: 'Alice' }] }],
          },
        ],
      },
    ]);
    expect(c2.querySelector('td')?.getAttribute('scope')).toBeNull();
  });

  it('maps cell align to text-align, defaulting to left when absent', async () => {
    const { container } = await render([
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [
              {
                type: 'table-header-cell',
                align: 'center',
                children: [{ type: 'text', text: 'H' }],
              },
            ],
          },
          {
            type: 'table-row',
            children: [
              { type: 'table-cell', align: 'right', children: [{ type: 'text', text: 'R' }] },
              { type: 'table-cell', children: [{ type: 'text', text: 'L' }] },
            ],
          },
        ],
      },
    ]);
    expect(styleOf(container.querySelector('th'))).toContain('text-align:center');
    const dataCells = container.querySelectorAll('td');
    expect(styleOf(dataCells[0])).toContain('text-align:right');
    // Absent align emits no inline text-align (left is the CSS default).
    expect(styleOf(dataCells[1])).not.toContain('text-align');
  });

  it('maps colSpan / rowSpan to attributes, defaulting to 1 when absent', async () => {
    const { container } = await render([
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
                children: [{ type: 'text', text: 'Span' }],
              },
            ],
          },
          {
            type: 'table-row',
            children: [
              { type: 'table-cell', colSpan: 1, children: [{ type: 'text', text: 'One' }] },
            ],
          },
        ],
      },
    ]);
    const th = container.querySelector('th');
    expect(th?.getAttribute('colspan')).toBe('2');
    expect(th?.getAttribute('rowspan')).toBe('2');
    // colSpan of 1 (or absent) emits no attribute — existing content unchanged.
    const td = container.querySelector('td');
    expect(td?.getAttribute('colspan')).toBeNull();
    expect(td?.getAttribute('rowspan')).toBeNull();
  });

  it('routes cell children through the inline renderer (marks and links)', async () => {
    const { container } = await render([
      {
        type: 'table',
        children: [
          {
            type: 'table-row',
            children: [
              {
                type: 'table-cell',
                children: [
                  { type: 'text', text: 'bold', bold: true },
                  {
                    type: 'link',
                    url: 'https://example.com',
                    children: [{ type: 'text', text: 'link' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
    const cell = container.querySelector('td');
    expect(cell?.querySelector('strong')?.textContent).toBe('bold');
    expect(cell?.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
  });

  it('passes align / colSpan / rowSpan to custom cell renderers', async () => {
    const { container } = await render(
      [
        {
          type: 'table',
          children: [
            {
              type: 'table-row',
              children: [
                {
                  type: 'table-header-cell',
                  align: 'center',
                  colSpan: 2,
                  children: [{ type: 'text', text: 'H' }],
                },
              ],
            },
            {
              type: 'table-row',
              children: [
                {
                  type: 'table-cell',
                  align: 'right',
                  rowSpan: 3,
                  children: [{ type: 'text', text: 'D' }],
                },
              ],
            },
          ],
        },
      ],
      {
        blocks: { 'table-header-cell': CustomTh, 'table-cell': CustomTd },
      }
    );
    const th = container.querySelector('[data-testid="custom-th"]');
    expect(th?.getAttribute('data-align')).toBe('center');
    expect(th?.getAttribute('data-colspan')).toBe('2');
    const td = container.querySelector('[data-testid="custom-td"]');
    expect(td?.getAttribute('data-align')).toBe('right');
    expect(td?.getAttribute('data-rowspan')).toBe('3');
  });

  // ── Media Embed ──────────────────────────────────────────────────

  it('renders media embed as responsive iframe', async () => {
    const { container } = await render([
      {
        type: 'media-embed',
        url: 'https://www.youtube.com/embed/abc123',
        originalUrl: 'https://www.youtube.com/watch?v=abc123',
        children: [{ type: 'text', text: '' }],
      },
    ]);
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toBe('https://www.youtube.com/embed/abc123');
    expect(iframe?.hasAttribute('allowfullscreen')).toBe(true);
  });

  it('renders media embed wrapper with 16:9 aspect ratio', async () => {
    const { container } = await render([
      {
        type: 'media-embed',
        url: 'https://player.vimeo.com/video/12345',
        children: [{ type: 'text', text: '' }],
      },
    ]);
    const wrapper = container.querySelector('div');
    expect(styleOf(wrapper)).toContain('position:relative');
    expect(styleOf(wrapper)).toContain('padding-bottom:56.25%');
    expect(styleOf(wrapper)).toContain('height:0');
  });

  // ── Math (KaTeX) ─────────────────────────────────────────────────

  it('renders block math as a div.katex-block', async () => {
    const { container } = await render([
      { type: 'math', format: 'block', value: 'E = mc^2', children: [{ type: 'text', text: '' }] },
    ]);
    const block = container.querySelector('div.katex-block');
    expect(block).not.toBeNull();
    expect(block?.querySelector('.katex')).not.toBeNull();
    expect(block?.textContent).toContain('E = mc^2');
  });

  it('renders inline math as a span.katex-inline within a paragraph', async () => {
    const { container } = await render([
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
    ]);
    const span = container.querySelector('span.katex-inline');
    expect(span).not.toBeNull();
    expect(span?.closest('p')).not.toBeNull();
    expect(span?.querySelector('.katex')).not.toBeNull();
  });

  it('renders inline math in non-display mode (no .katex-display wrapper)', async () => {
    const { container } = await render([
      { type: 'math', format: 'inline', value: 'x + y', children: [{ type: 'text', text: '' }] },
    ]);
    expect(container.querySelector('span.katex-inline')).not.toBeNull();
    expect(container.querySelector('.katex-display')).toBeNull();
  });

  it('renders block math in display mode (.katex-display wrapper)', async () => {
    const { container } = await render([
      {
        type: 'math',
        format: 'block',
        value: '\\frac{1}{2}',
        children: [{ type: 'text', text: '' }],
      },
    ]);
    expect(container.querySelector('.katex-display')).not.toBeNull();
  });

  it('uses custom math renderer with formula and inline props', async () => {
    const { container } = await render(
      [
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
        { type: 'math', format: 'block', value: '\\sum x', children: [{ type: 'text', text: '' }] },
      ],
      { blocks: { math: CustomMath } }
    );
    const els = container.querySelectorAll('[data-testid="custom-math"]');
    expect(els).toHaveLength(2);
    expect(els[0].getAttribute('data-formula')).toBe('\\pi');
    expect(els[0].getAttribute('data-inline')).toBe('true');
    expect(els[1].getAttribute('data-formula')).toBe('\\sum x');
    expect(els[1].getAttribute('data-inline')).toBe('false');
  });

  // ── Diagrams (Mermaid) ───────────────────────────────────────────

  it('renders a supported diagram to inline SVG on the server', async () => {
    const { container } = await render([
      {
        type: 'diagram',
        format: 'mermaid',
        value: 'graph TD\n  A[Start] --> B[End];',
        children: [{ type: 'text', text: '' }],
      },
    ]);
    const wrapper = container.querySelector('div.mermaid-diagram');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('pre.mermaid-source')).toBeNull();
  });

  it('renders diagrams in color with a mermaid.js-like palette by default', async () => {
    const { container } = await render([
      {
        type: 'diagram',
        format: 'mermaid',
        value: 'graph TD\n  A[Start] --> B[End];',
        children: [{ type: 'text', text: '' }],
      },
    ]);
    // Without a palette beautiful-mermaid renders monochrome (only fg/bg). The
    // default mirrors mermaid.js: lavender node fill + purple border, so nodes —
    // not just arrows — are colored.
    const html = container.querySelector('div.mermaid-diagram')?.innerHTML.toLowerCase() ?? '';
    expect(html).toContain('#ececff');
    expect(html).toContain('#9370db');
  });

  it('applies a built-in diagram theme by name', async () => {
    const { container } = await render(
      [
        {
          type: 'diagram',
          format: 'mermaid',
          value: 'graph TD\n  A[Start] --> B[End];',
          children: [{ type: 'text', text: '' }],
        },
      ],
      { diagramTheme: 'dracula' }
    );
    const html = container.querySelector('div.mermaid-diagram')?.innerHTML ?? '';
    expect(html.toLowerCase()).toContain('#bd93f9');
  });

  it('applies a custom diagram color palette object', async () => {
    const { container } = await render(
      [
        {
          type: 'diagram',
          format: 'mermaid',
          value: 'graph TD\n  A[Start] --> B[End];',
          children: [{ type: 'text', text: '' }],
        },
      ],
      { diagramTheme: { bg: '#ffffff', fg: '#222222', accent: '#ff0000' } }
    );
    const html = container.querySelector('div.mermaid-diagram')?.innerHTML ?? '';
    expect(html.toLowerCase()).toContain('#ff0000');
  });

  it('falls back to raw source in a <pre> for unsupported diagram types', async () => {
    const { container } = await render([
      {
        type: 'diagram',
        format: 'mermaid',
        value: 'gantt\n  title A\n  section S\n  Task :a1, 2024-01-01, 30d',
        children: [{ type: 'text', text: '' }],
      },
    ]);
    const pre = container.querySelector('pre.mermaid-source');
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain('gantt');
    expect(container.querySelector('div.mermaid-diagram')).toBeNull();
  });

  it('uses a custom diagram renderer with code and format props', async () => {
    const { container } = await render(
      [
        {
          type: 'diagram',
          format: 'mermaid',
          value: 'graph TD\n  A --> B;',
          children: [{ type: 'text', text: '' }],
        },
      ],
      { blocks: { diagram: CustomDiagram } }
    );
    const el = container.querySelector('.custom-diagram');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-format')).toBe('mermaid');
    expect(el?.textContent).toContain('A --> B');
    expect(container.querySelector('div.mermaid-diagram')).toBeNull();
  });

  // ── Callouts (Admonitions) ───────────────────────────────────────

  it('renders a callout with the localized variant label and nested content', async () => {
    const { container } = await render([
      {
        type: 'callout',
        variant: 'warning',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Be careful.' }] }],
      },
    ]);
    const aside = container.querySelector('aside.bb-callout.bb-callout-warning');
    expect(aside).not.toBeNull();
    expect(aside?.getAttribute('role')).toBe('note');
    expect(aside?.querySelector('.bb-callout-title')?.textContent).toContain('Warning');
    expect(aside?.querySelector('svg.bb-callout-icon')).not.toBeNull();
    expect(aside?.querySelector('.bb-callout-body p')?.textContent).toBe('Be careful.');
  });

  it('uses a custom title when provided', async () => {
    const { container } = await render([
      {
        type: 'callout',
        variant: 'tip',
        title: 'Pro tip',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'x' }] }],
      },
    ]);
    expect(container.querySelector('.bb-callout-title')?.textContent).toContain('Pro tip');
  });

  it('uses a custom callout renderer with variant, title and children', async () => {
    const { container } = await render(
      [
        {
          type: 'callout',
          variant: 'important',
          title: 'Heads up',
          children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Body' }] }],
        },
      ],
      { blocks: { callout: CustomCallout } }
    );
    const el = container.querySelector('.custom-callout');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-variant')).toBe('important');
    expect(el?.getAttribute('data-title')).toBe('Heads up');
    expect(el?.textContent).toContain('Body');
    expect(container.querySelector('aside.bb-callout')).toBeNull();
  });

  // ── Details / Summary (Collapsible) ──────────────────────────────

  it('renders a details block with a summary and nested content', async () => {
    const { container } = await render([
      {
        type: 'details',
        summary: 'Click to expand',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Hidden content.' }] }],
      },
    ]);
    const details = container.querySelector('details.bb-details');
    expect(details).not.toBeNull();
    // Closed by default when defaultOpen is omitted
    expect(details?.hasAttribute('open')).toBe(false);
    const summary = details?.querySelector('summary.bb-details-summary');
    expect(summary?.textContent).toBe('Click to expand');
    // Block children are rendered recursively inside the details
    expect(details?.querySelector('p')?.textContent).toBe('Hidden content.');
  });

  it('honors defaultOpen via the open attribute', async () => {
    const { container } = await render([
      {
        type: 'details',
        summary: 'Already open',
        defaultOpen: true,
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Visible.' }] }],
      },
    ]);
    expect(container.querySelector('details.bb-details')?.hasAttribute('open')).toBe(true);
  });

  it('supports arbitrarily nested details blocks', async () => {
    const { container } = await render([
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
    ]);
    const outer = container.querySelector('details.bb-details');
    const inner = outer?.querySelector('details.bb-details');
    expect(inner).not.toBeNull();
    expect(inner?.querySelector('summary')?.textContent).toBe('Inner');
    expect(inner?.querySelector('p')?.textContent).toBe('Deep.');
  });

  it('uses a custom details renderer with summary, defaultOpen and children', async () => {
    const { container } = await render(
      [
        {
          type: 'details',
          summary: 'More info',
          defaultOpen: true,
          children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Body' }] }],
        },
      ],
      { blocks: { details: CustomDetails } }
    );
    const el = container.querySelector('details.custom-details');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-summary')).toBe('More info');
    expect(el?.hasAttribute('open')).toBe(true);
    expect(el?.textContent).toContain('Body');
    expect(container.querySelector('details.bb-details')).toBeNull();
  });

  // ── Button (CTA / File Download) ─────────────────────────────────

  it('renders a link-mode button with href, target, rel, aria-label and alignment', async () => {
    const { container } = await render([
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
    ]);
    const wrapper = container.querySelector('.bb-button-wrapper');
    expect(styleOf(wrapper as HTMLElement)).toContain('text-align:center');
    const a = container.querySelector('a.bb-button');
    expect(a?.getAttribute('href')).toBe('https://example.com');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a?.getAttribute('aria-label')).toBe('Get started now');
    expect(a?.classList.contains('my-cta')).toBe(true);
    expect(a?.textContent?.trim()).toBe('Get started');
    const style = styleOf(a as HTMLElement);
    expect(style).toContain('background-color:#4945ff');
    expect(style).toContain('color:#ffffff');
    expect(style).toContain('border-radius:4px');
  });

  it('renders a file-mode button with download, icon and human-readable size', async () => {
    const { container } = await render([
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
    ]);
    const a = container.querySelector('a.bb-button');
    expect(a?.getAttribute('href')).toBe('/uploads/whitepaper.pdf');
    expect(a?.getAttribute('download')).toBe('Product Whitepaper.pdf');
    expect(a?.getAttribute('aria-label')).toBe('Download Product Whitepaper.pdf');
    expect(a?.querySelector('.bb-button-icon')?.textContent?.trim()).toBe('📄');
    expect(a?.querySelector('.bb-button-size')?.textContent?.trim()).toBe('(5 MB)');
    expect(a?.textContent).toContain('Download whitepaper');
  });

  it('omits size and icon in file mode when their flags are off', async () => {
    const { container } = await render([
      {
        type: 'button',
        buttonType: 'file',
        label: 'Download',
        file: { url: '/uploads/f.zip', name: 'f.zip', size: 1024, ext: '.zip' },
        showFileSize: false,
        showFileIcon: false,
      },
    ]);
    const a = container.querySelector('a.bb-button');
    expect(a?.querySelector('.bb-button-icon')).toBeNull();
    expect(a?.querySelector('.bb-button-size')).toBeNull();
  });

  it('tags a download-mode file button for the force-download script', async () => {
    const { container } = await render([
      {
        type: 'button',
        buttonType: 'file',
        label: 'Download',
        file: { url: 'https://cdn.example.com/report.pdf', name: 'report.pdf', ext: '.pdf' },
      },
    ]);
    const a = container.querySelector('a.bb-button');
    // Download mode keeps the native download attribute (works same-origin) and
    // is tagged so the progressive-enhancement script can force cross-origin
    // downloads on click.
    expect(a?.getAttribute('download')).toBe('report.pdf');
    expect(a?.hasAttribute('data-bb-download')).toBe(true);
    expect(a?.getAttribute('data-bb-download-name')).toBe('report.pdf');
    expect(a?.getAttribute('target')).toBeNull();
  });

  it('opens the file in a new tab (no download) when filePreview is enabled', async () => {
    const { container } = await render([
      {
        type: 'button',
        buttonType: 'file',
        label: 'View report',
        filePreview: true,
        file: { url: 'https://cdn.example.com/report.pdf', name: 'report.pdf', ext: '.pdf' },
      },
    ]);
    const a = container.querySelector('a.bb-button');
    expect(a?.getAttribute('href')).toBe('https://cdn.example.com/report.pdf');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a?.hasAttribute('download')).toBe(false);
    expect(a?.hasAttribute('data-bb-download')).toBe(false);
    expect(a?.getAttribute('aria-label')).toBe('Preview report.pdf');
  });

  it('exposes hover colors as CSS custom properties', async () => {
    const { container } = await render([
      {
        type: 'button',
        buttonType: 'link',
        label: 'Hover me',
        link: { url: '#' },
        style: { hoverBackgroundColor: '#3732c9', hoverTextColor: '#ffffff' },
      },
    ]);
    const style = styleOf(container.querySelector('a.bb-button') as HTMLElement);
    expect(style).toContain('--bb-button-hover-bg:#3732c9');
    expect(style).toContain('--bb-button-hover-color:#ffffff');
  });

  it('renders inline (no wrapper) when alignment is "none"', async () => {
    const { container } = await render([
      {
        type: 'button',
        buttonType: 'link',
        label: 'Inline',
        alignment: 'none',
        link: { url: '#' },
      },
    ]);
    expect(container.querySelector('.bb-button-wrapper')).toBeNull();
    expect(container.querySelector('a.bb-button')?.textContent?.trim()).toBe('Inline');
  });

  it('renders a styled span when neither link nor file payload is present', async () => {
    const { container } = await render([
      { type: 'button', buttonType: 'link', label: 'No target' },
    ]);
    expect(container.querySelector('a.bb-button')).toBeNull();
    expect(container.querySelector('span.bb-button')?.textContent?.trim()).toBe('No target');
  });

  it('uses a custom button renderer via the blocks override', async () => {
    const { container } = await render(
      [
        {
          type: 'button',
          buttonType: 'file',
          label: 'Download asset',
          alignment: 'right',
          file: { url: '/uploads/a.svg', name: 'a.svg' },
        },
      ],
      { blocks: { button: CustomButton } }
    );
    const el = container.querySelector('a.custom-button');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-button-type')).toBe('file');
    expect(el?.getAttribute('href')).toBe('/uploads/a.svg');
    expect(el?.getAttribute('download')).toBe('a.svg');
    expect(el?.textContent?.trim()).toBe('Download asset');
    expect(container.querySelector('a.bb-button')).toBeNull();
  });

  // ── Social Embed (Twitter/X, Instagram, TikTok, …) ───────────────

  it('renders oembed.html verbatim inside an aligned, labelled figure', async () => {
    const { container } = await render([
      {
        type: 'social-embed',
        platform: 'twitter',
        url: 'https://x.com/user/status/123',
        oembed: {
          html: '<blockquote class="twitter-tweet"><p>Hello world</p></blockquote>',
          author: 'Jane Doe',
          providerName: 'Twitter',
        },
        alignment: 'center',
      },
    ]);
    const figure = container.querySelector('figure.bb-social-embed');
    expect(figure).not.toBeNull();
    // Class hooks mirror the React renderer.
    expect(figure?.classList.contains('bb-social-embed-twitter')).toBe(true);
    expect(figure?.classList.contains('social-embed')).toBe(true);
    expect(figure?.classList.contains('align-center')).toBe(true);
    expect(figure?.getAttribute('aria-label')).toBe('Twitter post by Jane Doe');
    // Embed markup is emitted verbatim (not sanitized) in the `bb-social-embed-html` wrapper.
    expect(
      figure?.querySelector('.bb-social-embed-html blockquote.twitter-tweet')?.textContent
    ).toContain('Hello world');
    // Tagged for the lazy widget-script loader.
    expect(figure?.getAttribute('data-bb-social-embed')).toBe('');
    expect(figure?.getAttribute('data-bb-social-platform')).toBe('twitter');
  });

  it('prefers author-pasted embedCode over oembed.html', async () => {
    const { container } = await render([
      {
        type: 'social-embed',
        platform: 'instagram',
        url: 'https://www.instagram.com/p/abc/',
        embedCode: '<blockquote class="instagram-media" data-src="pasted"></blockquote>',
        oembed: { html: '<blockquote class="instagram-media" data-src="oembed"></blockquote>' },
      },
    ]);
    const blockquote = container.querySelector('figure.social-embed blockquote');
    expect(blockquote?.getAttribute('data-src')).toBe('pasted');
  });

  it('defaults alignment to center', async () => {
    const { container } = await render([
      {
        type: 'social-embed',
        platform: 'twitter',
        url: 'https://x.com/user/status/1',
        oembed: { html: '<blockquote class="twitter-tweet"></blockquote>' },
      },
    ]);
    expect(container.querySelector('figure.social-embed')?.classList.contains('align-center')).toBe(
      true
    );
  });

  it('renders a caption in a figcaption when present', async () => {
    const { container } = await render([
      {
        type: 'social-embed',
        platform: 'twitter',
        url: 'https://x.com/user/status/1',
        oembed: { html: '<blockquote class="twitter-tweet"></blockquote>' },
        caption: 'A great tweet',
      },
    ]);
    expect(container.querySelector('figure.social-embed figcaption')?.textContent?.trim()).toBe(
      'A great tweet'
    );
  });

  it('adds loading="lazy" to iframes that lack it, leaving existing ones', async () => {
    const { container } = await render([
      {
        type: 'social-embed',
        platform: 'linkedin',
        url: 'https://www.linkedin.com/posts/abc',
        oembed: {
          html: '<iframe src="https://www.linkedin.com/embed/abc"></iframe><iframe loading="eager" src="x"></iframe>',
        },
      },
    ]);
    const iframes = container.querySelectorAll('figure.social-embed iframe');
    expect(iframes[0]?.getAttribute('loading')).toBe('lazy');
    // Existing loading attribute is preserved (not overwritten or duplicated).
    expect(iframes[1]?.getAttribute('loading')).toBe('eager');
  });

  it('does not tag linkedin embeds for the widget-script loader (self-contained iframe)', async () => {
    const { html, container } = await render([
      {
        type: 'social-embed',
        platform: 'linkedin',
        url: 'https://www.linkedin.com/posts/abc',
        oembed: { html: '<iframe src="https://www.linkedin.com/embed/abc"></iframe>' },
      },
    ]);
    const figure = container.querySelector('figure.social-embed');
    expect(figure?.hasAttribute('data-bb-social-embed')).toBe(false);
    expect(figure?.hasAttribute('data-bb-social-platform')).toBe(false);
    // No widget-script marker anywhere for a script-less platform.
    expect(html).not.toContain('data-bb-social-platform');
  });

  it('falls back to a link card when no embedCode/oembed.html is present', async () => {
    const { container } = await render([
      {
        type: 'social-embed',
        platform: 'tiktok',
        url: 'https://www.tiktok.com/@user/video/1',
        oembed: {
          author: 'Creator',
          title: 'Cool video',
          thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
          providerName: 'TikTok',
        },
      },
    ]);
    const link = container.querySelector('figure.bb-social-embed a.bb-social-embed-fallback');
    expect(link?.getAttribute('href')).toBe('https://www.tiktok.com/@user/video/1');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.querySelector('.bb-social-embed-fallback-provider')?.textContent).toBe('TikTok');
    // Title prefers oembed.title over the descriptive label.
    expect(link?.querySelector('.bb-social-embed-fallback-title')?.textContent).toBe('Cool video');
    expect(link?.querySelector('img.bb-social-embed-fallback-thumb')?.getAttribute('src')).toBe(
      'https://cdn.example.com/thumb.jpg'
    );
    // A pure fallback needs no widget script.
    expect(
      container.querySelector('figure.bb-social-embed')?.hasAttribute('data-bb-social-embed')
    ).toBe(false);
  });

  it('strips widget <script> tags from oembed.html (lazy loader is the only injector)', async () => {
    const { container } = await render([
      {
        type: 'social-embed',
        platform: 'tiktok',
        url: 'https://www.tiktok.com/@user/video/1',
        oembed: {
          html: '<blockquote class="tiktok-embed"><a href="x">link</a></blockquote><script async src="https://www.tiktok.com/embed.js"></script>',
        },
      },
    ]);
    const wrapper = container.querySelector('.bb-social-embed-html');
    // The embed markup survives; the platform's own <script> does not.
    expect(wrapper?.querySelector('blockquote.tiktok-embed')).not.toBeNull();
    expect(wrapper?.querySelector('script')).toBeNull();
    // Still tagged for the lazy loader, which owns script injection.
    expect(
      container.querySelector('figure.bb-social-embed')?.getAttribute('data-bb-social-platform')
    ).toBe('tiktok');
  });

  it('strips <script> tags from a hand-pasted embedCode', async () => {
    const { container } = await render([
      {
        type: 'social-embed',
        platform: 'instagram',
        url: 'https://www.instagram.com/p/abc/',
        embedCode:
          '<blockquote class="instagram-media"></blockquote><script async src="https://www.instagram.com/embed.js"></script>',
      },
    ]);
    const wrapper = container.querySelector('.bb-social-embed-html');
    expect(wrapper?.querySelector('blockquote.instagram-media')).not.toBeNull();
    expect(wrapper?.querySelector('script')).toBeNull();
  });

  it('renders the fallback as a non-interactive div (no empty href) when no url is present', async () => {
    const { container } = await render([
      {
        type: 'social-embed',
        platform: 'instagram',
        oembed: { providerName: 'Instagram', title: 'A post' },
      },
    ]);
    const figure = container.querySelector('figure.bb-social-embed');
    // No <a> at all — an anchor without an href would be meaningless.
    expect(figure?.querySelector('a')).toBeNull();
    const fallback = figure?.querySelector('div.bb-social-embed-fallback');
    expect(fallback).not.toBeNull();
    expect(fallback?.hasAttribute('href')).toBe(false);
    expect(fallback?.querySelector('.bb-social-embed-fallback-title')?.textContent).toBe('A post');
  });

  it('derives the provider name and aria-label from the platform when oembed is absent', async () => {
    const { container } = await render([
      { type: 'social-embed', platform: 'pinterest', url: 'https://pin.it/abc' },
    ]);
    const figure = container.querySelector('figure.bb-social-embed');
    expect(figure?.getAttribute('aria-label')).toBe('Pinterest post');
    expect(figure?.querySelector('.bb-social-embed-fallback-provider')?.textContent).toBe(
      'Pinterest'
    );
  });

  it('uses a nicely-cased platform label when oembed.providerName is absent', async () => {
    const { container } = await render([
      {
        type: 'social-embed',
        platform: 'linkedin',
        url: 'https://www.linkedin.com/posts/abc',
        oembed: { html: '<iframe src="https://www.linkedin.com/embed/abc"></iframe>' },
      },
    ]);
    // "LinkedIn", not a naive "Linkedin".
    expect(container.querySelector('figure.bb-social-embed')?.getAttribute('aria-label')).toBe(
      'LinkedIn post'
    );
  });

  it('labels Twitter as "X" by default (mirrors the React renderer)', async () => {
    const { container } = await render([
      { type: 'social-embed', platform: 'twitter', url: 'https://x.com/user/status/1' },
    ]);
    const figure = container.querySelector('figure.bb-social-embed');
    expect(figure?.getAttribute('aria-label')).toBe('X post');
    expect(figure?.querySelector('.bb-social-embed-fallback-provider')?.textContent).toBe('X');
  });

  it('routes social-embed through a custom renderer when provided', async () => {
    const { container } = await render(
      [
        {
          type: 'social-embed',
          platform: 'twitter',
          url: 'https://x.com/user/status/1',
          alignment: 'left',
          caption: 'Overridden',
          oembed: { html: '<blockquote class="twitter-tweet"></blockquote>' },
        },
      ],
      { blocks: { 'social-embed': CustomSocialEmbed } }
    );
    const el = container.querySelector('div.custom-social-embed');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-platform')).toBe('twitter');
    expect(el?.getAttribute('data-alignment')).toBe('left');
    expect(el?.getAttribute('data-url')).toBe('https://x.com/user/status/1');
    expect(el?.querySelector('.custom-social-caption')?.textContent).toBe('Overridden');
    // The default figure is not rendered when overridden.
    expect(container.querySelector('figure.social-embed')).toBeNull();
  });

  // ── Audio (Media Library / raw URL + HTML5 player) ───────────────

  it('renders a native <audio> inside an aligned figure with player flags mapped 1:1', async () => {
    const { container } = await render([
      {
        type: 'audio',
        file: { id: 123, url: '/uploads/episode.mp3', mime: 'audio/mpeg' },
        player: { autoplay: false, loop: true, controls: true, preload: 'auto' },
        alignment: 'right',
      },
    ]);
    const figure = container.querySelector('figure.bb-audio');
    expect(figure).not.toBeNull();
    expect(figure?.classList.contains('align-right')).toBe(true);
    const audio = figure?.querySelector('audio.bb-audio-player');
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute('src')).toBe('/uploads/episode.mp3');
    expect(audio?.hasAttribute('controls')).toBe(true);
    expect(audio?.hasAttribute('loop')).toBe(true);
    // autoplay: false → attribute omitted entirely.
    expect(audio?.hasAttribute('autoplay')).toBe(false);
    expect(audio?.getAttribute('preload')).toBe('auto');
  });

  it('defaults alignment to center, controls to true, and preload to metadata', async () => {
    const { container } = await render([{ type: 'audio', file: { url: '/uploads/clip.mp3' } }]);
    const figure = container.querySelector('figure.bb-audio');
    expect(figure?.classList.contains('align-center')).toBe(true);
    const audio = figure?.querySelector('audio');
    expect(audio?.hasAttribute('controls')).toBe(true);
    expect(audio?.getAttribute('preload')).toBe('metadata');
  });

  it('omits controls when player.controls is false', async () => {
    const { container } = await render([
      {
        type: 'audio',
        file: { url: '/uploads/clip.mp3' },
        player: { controls: false },
      },
    ]);
    expect(container.querySelector('figure.bb-audio audio')?.hasAttribute('controls')).toBe(false);
  });

  it('renders an optional title above and caption below the player', async () => {
    const { container } = await render([
      {
        type: 'audio',
        file: { id: 7, url: '/uploads/ep.mp3' },
        title: 'Episode 1: Introduction',
        caption: 'Our first podcast episode',
      },
    ]);
    const figure = container.querySelector('figure.bb-audio');
    expect(figure?.querySelector('.bb-audio-title')?.textContent?.trim()).toBe(
      'Episode 1: Introduction'
    );
    expect(figure?.querySelector('.bb-audio-caption')?.textContent?.trim()).toBe(
      'Our first podcast episode'
    );
  });

  it('does not render title/caption figcaptions when absent', async () => {
    const { container } = await render([{ type: 'audio', file: { url: '/uploads/clip.mp3' } }]);
    expect(container.querySelector('.bb-audio-title')).toBeNull();
    expect(container.querySelector('.bb-audio-caption')).toBeNull();
  });

  it('wires aria-label to the title and aria-describedby to the caption', async () => {
    const { container } = await render([
      {
        type: 'audio',
        file: { id: 42, url: '/uploads/ep.mp3' },
        title: 'My Episode',
        caption: 'A caption',
      },
    ]);
    const audio = container.querySelector('figure.bb-audio audio');
    expect(audio?.getAttribute('aria-label')).toBe('My Episode');
    const capId = audio?.getAttribute('aria-describedby');
    expect(capId).toBe('bb-audio-cap-42');
    expect(container.querySelector(`#${capId}`)?.textContent?.trim()).toBe('A caption');
  });

  it('falls back to an "Audio player" aria-label when no title is present', async () => {
    const { container } = await render([{ type: 'audio', file: { url: '/uploads/clip.mp3' } }]);
    const audio = container.querySelector('figure.bb-audio audio');
    expect(audio?.getAttribute('aria-label')).toBe('Audio player');
    // No caption → no aria-describedby.
    expect(audio?.hasAttribute('aria-describedby')).toBe(false);
  });

  it('keys the caption id off the file hash when no id is present (raw-URL block)', async () => {
    const { container } = await render([
      {
        type: 'audio',
        file: { url: 'https://cdn.example.com/song.mp3', hash: 'song_abc123' },
        caption: 'From a raw URL',
      },
    ]);
    const audio = container.querySelector('figure.bb-audio audio');
    expect(audio?.getAttribute('aria-describedby')).toBe('bb-audio-cap-song_abc123');
  });

  it('falls back to the block index for the caption id when id and hash are both absent', async () => {
    const { container } = await render([
      { type: 'paragraph', children: [{ type: 'text', text: 'lead-in' }] },
      {
        type: 'audio',
        file: { url: 'https://cdn.example.com/a.mp3' },
        caption: 'First',
      },
      {
        type: 'audio',
        file: { url: 'https://cdn.example.com/b.mp3' },
        caption: 'Second',
      },
    ]);
    const audios = container.querySelectorAll('figure.bb-audio audio');
    // Distinct, index-derived ids — no duplicate `bb-audio-cap-undefined` clash.
    expect(audios[0]?.getAttribute('aria-describedby')).toBe('bb-audio-cap-1');
    expect(audios[1]?.getAttribute('aria-describedby')).toBe('bb-audio-cap-2');
  });

  it('includes fallback text and a download link inside <audio>', async () => {
    const { container } = await render([{ type: 'audio', file: { url: '/uploads/episode.mp3' } }]);
    const audio = container.querySelector('figure.bb-audio audio');
    expect(audio?.textContent).toContain('Your browser does not support the audio element');
    const download = audio?.querySelector('a');
    expect(download?.getAttribute('href')).toBe('/uploads/episode.mp3');
  });

  it('routes audio through a custom renderer when provided', async () => {
    const { container } = await render(
      [
        {
          type: 'audio',
          file: { id: 9, url: '/uploads/ep.mp3' },
          title: 'Custom title',
          caption: 'Custom caption',
          alignment: 'left',
        },
      ],
      { blocks: { audio: CustomAudio } }
    );
    const el = container.querySelector('div.custom-audio');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-alignment')).toBe('left');
    expect(el?.getAttribute('data-url')).toBe('/uploads/ep.mp3');
    expect(el?.querySelector('.custom-audio-title')?.textContent).toBe('Custom title');
    expect(el?.querySelector('.custom-audio-caption')?.textContent).toBe('Custom caption');
    // The default figure is not rendered when overridden.
    expect(container.querySelector('figure.bb-audio')).toBeNull();
  });

  // ── Embed (generic iframe / URL) ─────────────────────────────────

  it('renders embedHtml verbatim inside an aligned, aspect-ratio figure', async () => {
    const { container } = await render([
      {
        type: 'embed',
        source: 'url',
        provider: 'youtube',
        embedHtml: '<iframe src="https://www.youtube.com/embed/abc12345678"></iframe>',
        embedSrc: 'https://www.youtube.com/embed/abc12345678',
        aspectRatio: '16:9',
        alignment: 'center',
      },
    ]);
    const figure = container.querySelector('figure.bb-embed');
    expect(figure).not.toBeNull();
    expect(figure?.classList.contains('align-center')).toBe(true);
    const frame = container.querySelector('.bb-embed-frame');
    expect(styleOf(frame)).toContain('aspect-ratio:16/9');
    const iframe = frame?.querySelector('iframe');
    expect(iframe?.getAttribute('src')).toBe('https://www.youtube.com/embed/abc12345678');
  });

  it('defaults embed alignment to center and aspect ratio to 16 / 9', async () => {
    const { container } = await render([
      { type: 'embed', embedHtml: '<iframe src="https://player.vimeo.com/video/1"></iframe>' },
    ]);
    const figure = container.querySelector('figure.bb-embed');
    expect(figure?.classList.contains('align-center')).toBe(true);
    expect(styleOf(container.querySelector('.bb-embed-frame'))).toContain('aspect-ratio:16/9');
  });

  it('converts a named aspect ratio and uses customAspectRatio verbatim', async () => {
    const { container } = await render([
      {
        type: 'embed',
        embedHtml: '<iframe src="https://www.loom.com/embed/1"></iframe>',
        aspectRatio: '4:3',
      },
      {
        type: 'embed',
        embedHtml: '<iframe src="https://www.loom.com/embed/2"></iframe>',
        aspectRatio: 'custom',
        customAspectRatio: '3 / 2',
      },
    ]);
    const frames = container.querySelectorAll('.bb-embed-frame');
    expect(styleOf(frames[0])).toContain('aspect-ratio:4/3');
    expect(styleOf(frames[1])).toContain('aspect-ratio:3/2');
  });

  it('flows an embed full-width when alignment is none', async () => {
    const { container } = await render([
      {
        type: 'embed',
        embedHtml: '<iframe src="https://www.dailymotion.com/embed/1"></iframe>',
        alignment: 'none',
      },
    ]);
    const figure = container.querySelector('figure.bb-embed');
    expect(figure?.classList.contains('align-none')).toBe(true);
    // Full-width: the frame is not capped by the max-width custom property.
    expect(styleOf(container.querySelector('.bb-embed-frame'))).toContain('max-width:100%');
  });

  it('renders an embed title above and caption below in figcaptions', async () => {
    const { container } = await render([
      {
        type: 'embed',
        embedHtml: '<iframe src="https://www.youtube.com/embed/x"></iframe>',
        title: 'Product Demo',
        caption: 'A video explaining the feature',
      },
    ]);
    const figure = container.querySelector('figure.bb-embed');
    expect(figure?.querySelector('.bb-embed-title')?.textContent?.trim()).toBe('Product Demo');
    expect(figure?.querySelector('.bb-embed-caption')?.textContent?.trim()).toBe(
      'A video explaining the feature'
    );
  });

  it('does not inject a widget script for embeds (plain iframe)', async () => {
    const { html } = await render([
      { type: 'embed', embedHtml: '<iframe src="https://www.youtube.com/embed/x"></iframe>' },
    ]);
    expect(html).not.toContain('<script');
  });

  it('routes embed through a custom renderer when provided', async () => {
    const { container } = await render(
      [
        {
          type: 'embed',
          provider: 'vimeo',
          embedHtml: '<iframe src="https://player.vimeo.com/video/9"></iframe>',
          aspectRatio: '21:9',
          alignment: 'left',
          title: 'Custom title',
          caption: 'Custom caption',
        },
      ],
      { blocks: { embed: CustomEmbedBlock } }
    );
    const el = container.querySelector('div.custom-embed-block');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-provider')).toBe('vimeo');
    expect(el?.getAttribute('data-aspect')).toBe('21:9');
    expect(el?.getAttribute('data-alignment')).toBe('left');
    expect(el?.querySelector('.custom-embed-html iframe')?.getAttribute('src')).toBe(
      'https://player.vimeo.com/video/9'
    );
    // The default figure is not rendered when overridden.
    expect(container.querySelector('figure.bb-embed')).toBeNull();
  });

  // ── Video (provider-aware) ───────────────────────────────────────

  it('renders a native <video> for a direct file URL with player flags mapped 1:1', async () => {
    const { container } = await render([
      {
        type: 'video',
        provider: 'local',
        file: { id: 5, url: '/uploads/demo.mp4', mime: 'video/mp4' },
        poster: '/uploads/demo.jpg',
        player: { controls: true, autoplay: false, loop: true, muted: false },
        alignment: 'right',
        aspectRatio: '16:9',
      },
    ]);
    const figure = container.querySelector('figure.bb-video');
    expect(figure).not.toBeNull();
    expect(figure?.classList.contains('align-right')).toBe(true);
    expect(styleOf(container.querySelector('.bb-video-frame'))).toContain('aspect-ratio:16/9');
    const video = figure?.querySelector('video.bb-video-player');
    expect(video?.getAttribute('src')).toBe('/uploads/demo.mp4');
    expect(video?.getAttribute('poster')).toBe('/uploads/demo.jpg');
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(video?.hasAttribute('loop')).toBe(true);
    expect(video?.hasAttribute('autoplay')).toBe(false);
  });

  it('defaults video controls to true and alignment to center', async () => {
    const { container } = await render([
      { type: 'video', provider: 'local', url: 'https://cdn.example.com/a.mp4' },
    ]);
    const figure = container.querySelector('figure.bb-video');
    expect(figure?.classList.contains('align-center')).toBe(true);
    expect(figure?.querySelector('video')?.hasAttribute('controls')).toBe(true);
  });

  it('forces muted on when autoplay is set', async () => {
    const { container } = await render([
      {
        type: 'video',
        provider: 'local',
        url: 'https://cdn.example.com/a.mp4',
        player: { autoplay: true, muted: false },
      },
    ]);
    const video = container.querySelector('figure.bb-video video');
    expect(video?.hasAttribute('autoplay')).toBe(true);
    expect(video?.hasAttribute('muted')).toBe(true);
  });

  it('derives the Mux stream URL and poster from the playback id', async () => {
    const { container } = await render([{ type: 'video', provider: 'mux', playbackId: 'def456' }]);
    const figure = container.querySelector('figure.bb-video');
    // HLS marker for consumer CSS / player upgrades.
    expect(figure?.hasAttribute('data-hls')).toBe(true);
    const video = figure?.querySelector('video');
    expect(video?.getAttribute('src')).toBe('https://stream.mux.com/def456.m3u8');
    expect(video?.getAttribute('poster')).toBe('https://image.mux.com/def456/thumbnail.jpg');
  });

  it('prefers an explicit url over the derived Mux stream', async () => {
    const { container } = await render([
      {
        type: 'video',
        provider: 'mux',
        playbackId: 'def456',
        url: 'https://stream.mux.com/custom.m3u8',
      },
    ]);
    expect(container.querySelector('figure.bb-video video')?.getAttribute('src')).toBe(
      'https://stream.mux.com/custom.m3u8'
    );
  });

  it('adds a captions <track> and wires aria-describedby to the caption', async () => {
    const { container } = await render([
      {
        type: 'video',
        provider: 'local',
        file: { id: 12, url: '/uploads/demo.mp4' },
        transcript: 'https://example.com/captions.vtt',
        caption: 'Watch this to get started',
      },
    ]);
    const video = container.querySelector('figure.bb-video video');
    const track = video?.querySelector('track');
    expect(track?.getAttribute('kind')).toBe('captions');
    expect(track?.getAttribute('src')).toBe('https://example.com/captions.vtt');
    const capId = video?.getAttribute('aria-describedby');
    expect(capId).toBe('bb-video-cap-12');
    expect(container.querySelector(`#${capId}`)?.textContent?.trim()).toBe(
      'Watch this to get started'
    );
  });

  it('includes a fallback open-link inside <video>', async () => {
    const { container } = await render([
      { type: 'video', provider: 'local', url: 'https://cdn.example.com/a.mp4' },
    ]);
    const video = container.querySelector('figure.bb-video video');
    expect(video?.textContent).toContain('Your browser can');
    expect(video?.querySelector('a')?.getAttribute('href')).toBe('https://cdn.example.com/a.mp4');
  });

  it('renders a poster image when there is no playable source', async () => {
    const { container } = await render([
      { type: 'video', provider: 'mux', poster: 'https://image.mux.com/x/thumbnail.jpg' },
    ]);
    const figure = container.querySelector('figure.bb-video');
    expect(figure?.querySelector('video')).toBeNull();
    expect(figure?.querySelector('img.bb-video-poster')?.getAttribute('src')).toBe(
      'https://image.mux.com/x/thumbnail.jpg'
    );
  });

  it('does not inject any script for video blocks', async () => {
    const { html } = await render([{ type: 'video', provider: 'mux', playbackId: 'def456' }]);
    expect(html).not.toContain('<script');
  });

  it('routes video through a custom renderer when provided', async () => {
    const { container } = await render(
      [
        {
          type: 'video',
          provider: 'mux',
          playbackId: 'def456',
          poster: 'https://image.mux.com/def456/thumbnail.jpg',
          title: 'Custom title',
          caption: 'Custom caption',
          alignment: 'left',
        },
      ],
      { blocks: { video: CustomVideo } }
    );
    const el = container.querySelector('div.custom-video');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-provider')).toBe('mux');
    expect(el?.getAttribute('data-playback-id')).toBe('def456');
    expect(el?.getAttribute('data-alignment')).toBe('left');
    expect(el?.querySelector('.custom-video-title')?.textContent).toBe('Custom title');
    // The default figure is not rendered when overridden.
    expect(container.querySelector('figure.bb-video')).toBeNull();
  });

  // ── Text Modifiers: uppercase, superscript, subscript ────────────

  it('renders uppercase text', async () => {
    const { container } = await render([
      { type: 'paragraph', children: [{ type: 'text', text: 'upper', uppercase: true }] },
    ]);
    expect(styleOf(byText(container, 'upper'))).toContain('text-transform:uppercase');
  });

  it('renders superscript text', async () => {
    const { container } = await render([
      { type: 'paragraph', children: [{ type: 'text', text: '2', superscript: true }] },
    ]);
    expect(container.querySelector('sup')?.textContent).toBe('2');
  });

  it('renders subscript text', async () => {
    const { container } = await render([
      { type: 'paragraph', children: [{ type: 'text', text: 'n', subscript: true }] },
    ]);
    expect(container.querySelector('sub')?.textContent).toBe('n');
  });

  // ── Text Marks: fontFamily, fontSize ─────────────────────────────

  it('renders text with fontFamily', async () => {
    const { container } = await render([
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Serif', fontFamily: 'Georgia, serif' }],
      },
    ]);
    expect(styleOf(byText(container, 'Serif'))).toContain('font-family:Georgia,serif');
  });

  it('renders text with fontSize', async () => {
    const { container } = await render([
      { type: 'paragraph', children: [{ type: 'text', text: 'Big', fontSize: '24px' }] },
    ]);
    expect(styleOf(byText(container, 'Big'))).toContain('font-size:24px');
  });

  // ── Block Properties: lineHeight, indent ─────────────────────────

  it('renders paragraph with lineHeight', async () => {
    const { container } = await render([
      { type: 'paragraph', lineHeight: '1.8', children: [{ type: 'text', text: 'Spaced' }] },
    ]);
    expect(styleOf(container.querySelector('p'))).toContain('line-height:1.8');
  });

  it('renders heading with lineHeight', async () => {
    const { container } = await render([
      {
        type: 'heading',
        level: 2,
        lineHeight: '2.0',
        children: [{ type: 'text', text: 'Spaced H2' }],
      },
    ]);
    expect(styleOf(container.querySelector('h2'))).toContain('line-height:2.0');
  });

  it('renders paragraph with indent', async () => {
    const { container } = await render([
      { type: 'paragraph', indent: 2, children: [{ type: 'text', text: 'Indented' }] },
    ]);
    expect(styleOf(container.querySelector('p'))).toContain('margin-left:4rem');
  });

  it('renders block with combined textAlign, lineHeight, and indent', async () => {
    const { container } = await render([
      {
        type: 'paragraph',
        textAlign: 'center',
        lineHeight: '1.5',
        indent: 1,
        children: [{ type: 'text', text: 'Combined' }],
      },
    ]);
    const style = styleOf(container.querySelector('p'));
    expect(style).toContain('text-align:center');
    expect(style).toContain('line-height:1.5');
    expect(style).toContain('margin-left:2rem');
  });

  it('does not apply lineHeight or indent when not set', async () => {
    const { container } = await render([
      { type: 'paragraph', children: [{ type: 'text', text: 'Plain' }] },
    ]);
    expect(container.querySelector('p')?.getAttribute('style')).toBeNull();
  });

  // ── Custom Block Renderers ───────────────────────────────────────

  it('uses custom paragraph renderer', async () => {
    const { container } = await render(
      [{ type: 'paragraph', children: [{ type: 'text', text: 'Custom' }] }],
      { blocks: { paragraph: CustomParagraph } }
    );
    expect(container.querySelector('[data-testid="custom-p"]')).not.toBeNull();
    expect(byText(container, 'Custom')).not.toBeNull();
  });

  it('uses custom heading renderer', async () => {
    const { container } = await render(
      [{ type: 'heading', level: 2, children: [{ type: 'text', text: 'Title' }] }],
      { blocks: { heading: CustomHeading } }
    );
    expect(container.querySelector('[data-testid="heading-2"]')).not.toBeNull();
  });

  it('uses custom link renderer', async () => {
    const { container } = await render(
      [
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
      ],
      { blocks: { link: CustomLink } }
    );
    expect(container.querySelector('[data-testid="custom-link"]')?.getAttribute('href')).toBe(
      'https://example.com'
    );
  });

  it('uses custom horizontal-line renderer', async () => {
    const { container } = await render(
      [{ type: 'horizontal-line', children: [{ type: 'text', text: '' }] }],
      { blocks: { 'horizontal-line': CustomHr } }
    );
    expect(container.querySelector('[data-testid="custom-hr"]')).not.toBeNull();
  });

  it('uses custom media-embed renderer', async () => {
    const { container } = await render(
      [
        {
          type: 'media-embed',
          url: 'https://www.youtube.com/embed/abc',
          originalUrl: 'https://www.youtube.com/watch?v=abc',
          children: [{ type: 'text', text: '' }],
        },
      ],
      { blocks: { 'media-embed': CustomEmbed } }
    );
    expect(container.querySelector('[data-testid="custom-embed"]')).not.toBeNull();
  });

  it('uses custom table renderers', async () => {
    const { container } = await render(
      [
        {
          type: 'table',
          children: [
            {
              type: 'table-row',
              children: [
                { type: 'table-header-cell', children: [{ type: 'text', text: 'Header' }] },
              ],
            },
            {
              type: 'table-row',
              children: [{ type: 'table-cell', children: [{ type: 'text', text: 'Data' }] }],
            },
          ],
        },
      ],
      {
        blocks: {
          table: CustomTable,
          'table-row': CustomRow,
          'table-header-cell': CustomTh,
          'table-cell': CustomTd,
        },
      }
    );
    expect(container.querySelector('[data-testid="custom-table"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="custom-row"]')).toHaveLength(2);
    expect(container.querySelector('[data-testid="custom-th"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="custom-td"]')).not.toBeNull();
  });

  it('uses custom image renderer with caption and alignment', async () => {
    const { container } = await render(
      [
        {
          type: 'image',
          image: { url: 'https://example.com/img.png', alternativeText: 'Photo' },
          caption: 'My caption',
          imageAlign: 'right',
          children: [{ type: 'text', text: '' }],
        },
      ],
      { blocks: { image: CustomImage } }
    );
    const el = container.querySelector('[data-testid="custom-img"]');
    expect(el?.getAttribute('data-caption')).toBe('My caption');
    expect(el?.getAttribute('data-align')).toBe('right');
  });

  // ── Custom Modifier Renderers ────────────────────────────────────

  it('uses custom bold modifier', async () => {
    const { container } = await render(
      [{ type: 'paragraph', children: [{ type: 'text', text: 'Bold', bold: true }] }],
      { modifiers: { bold: CustomBold } }
    );
    expect(container.querySelector('[data-testid="custom-bold"]')).not.toBeNull();
  });

  it('uses custom color modifier', async () => {
    const { container } = await render(
      [{ type: 'paragraph', children: [{ type: 'text', text: 'Colored', color: '#FF0000' }] }],
      { modifiers: { color: CustomColor } }
    );
    expect(
      container.querySelector('[data-testid="custom-color"]')?.getAttribute('data-color')
    ).toBe('#FF0000');
  });

  it('uses custom backgroundColor modifier', async () => {
    const { container } = await render(
      [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Highlighted', backgroundColor: '#FFFF00' }],
        },
      ],
      { modifiers: { backgroundColor: CustomBg } }
    );
    expect(container.querySelector('[data-testid="custom-bg"]')).not.toBeNull();
  });
});
