/**
 * What the components do once they are mounted in a browser.
 *
 * The rest of the suite renders on the server, which is where almost everything
 * happens. Four things cannot: Shiki cannot highlight synchronously, mermaid
 * measures text against a real DOM, a social widget script has to be fetched,
 * and a cross-origin download has to go through `fetch`. Those are here.
 */
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import BlocksRenderer from '../src/BlocksRenderer.vue';
import type { BlocksContent } from '../src/types';

// mermaid is ~800 kB of layout code that needs real text metrics, which jsdom
// does not have. Stub it with a renderer that echoes the source it was handed
// into the markup, so the tests assert on what the component rendered rather
// than on spy calls - and so the `%%{init}%%` theme directive is visible.
const mermaidRender = vi.hoisted(() =>
  vi.fn(async (_id: string, code: string) => ({
    svg: `<svg class="mock-mermaid"><text>${code}</text></svg>`,
  }))
);
vi.mock('mermaid', () => ({
  default: { initialize: vi.fn(), render: mermaidRender },
}));

function mountContent(content: BlocksContent, props: Record<string, unknown> = {}) {
  return mount(BlocksRenderer, {
    props: { content, ...props },
    attachTo: document.body,
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('code blocks', () => {
  it('highlights with Shiki after mount, over the server-rendered source', async () => {
    const wrapper = mountContent([
      { type: 'code', language: 'javascript', children: [{ type: 'text', text: 'const x = 1;' }] },
    ]);

    // The first render is the plain fallback - the same markup the server sent,
    // which is what makes hydration match.
    expect(wrapper.find('pre.bb-code-pre').exists()).toBe(true);

    await vi.waitFor(() => expect(wrapper.find('.bb-code .shiki').exists()).toBe(true), {
      timeout: 20_000,
    });
    expect(wrapper.find('.bb-code').text()).toContain('const x = 1;');
    expect(wrapper.find('pre.bb-code-pre').exists()).toBe(false);
  }, 30_000);

  it('keeps the plain source when the highlighter cannot be built', async () => {
    const wrapper = mountContent(
      [{ type: 'code', children: [{ type: 'text', text: 'plain text' }] }],
      { codeTheme: 'not-a-real-theme' }
    );

    await vi.waitFor(() => expect(wrapper.find('pre.bb-code-pre').exists()).toBe(true));
    expect(wrapper.find('pre.bb-code-pre code').text()).toBe('plain text');
  }, 30_000);

  it('copies the source and confirms on the copy button', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const wrapper = mountContent(
      [{ type: 'code', children: [{ type: 'text', text: 'const x = 1;' }] }],
      { codeCopyButton: true }
    );

    const button = wrapper.find('button.bb-code-copy');
    expect(button.text()).toBe('Copy');

    await button.trigger('click');
    await vi.waitFor(() => expect(button.text()).toBe('Copied!'));
    expect(writeText).toHaveBeenCalledWith('const x = 1;');
  });
});

describe('social embeds', () => {
  it('injects the platform widget script once the embed is mounted', async () => {
    mountContent([
      {
        type: 'social-embed',
        platform: 'pinterest',
        url: 'https://www.pinterest.com/pin/1/',
        oembed: { html: '<blockquote class="pinterest-embed"></blockquote>' },
      },
    ]);

    await vi.waitFor(() =>
      expect(document.querySelector('script[data-bb-social-script="pinterest"]')).not.toBeNull()
    );
  });

  it('loads nothing for a platform whose embed is a self-contained iframe', async () => {
    mountContent([
      {
        type: 'social-embed',
        platform: 'linkedin',
        url: 'https://www.linkedin.com/posts/1/',
        oembed: { html: '<iframe src="https://www.linkedin.com/embed/1"></iframe>' },
      },
    ]);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('script[data-bb-social-script="linkedin"]')).toBeNull();
  });

  it('loads nothing for a fallback card, which has no embed markup to upgrade', async () => {
    mountContent([
      { type: 'social-embed', platform: 'facebook', url: 'https://facebook.com/post/1' },
    ]);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('script[data-bb-social-script="facebook"]')).toBeNull();
  });
});

const preventNavigation = (event: Event) => event.preventDefault();

describe('file download buttons', () => {
  const file = { url: 'https://cdn.example.com/report.pdf', name: 'report.pdf', ext: '.pdf' };

  beforeEach(() => {
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
    // The saved-file click would ask jsdom to navigate to the object URL, which
    // it cannot do and would log about. The click itself is the assertion.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    // Same for the clicks this button is meant *not* to intercept: they reach
    // the anchor's default action, which in jsdom is an unimplemented
    // navigation. Cancelling in the bubble phase leaves the component's own
    // handler - bound on the anchor itself - to run first, untouched.
    document.addEventListener('click', preventNavigation);
  });

  afterEach(() => {
    document.removeEventListener('click', preventNavigation);
  });

  it('fetches the asset and saves it from a same-origin object URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['pdf'])) });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mountContent([{ type: 'button', buttonType: 'file', label: 'Download', file }]);

    await wrapper.find('a.bb-button').trigger('click');

    expect(fetchMock).toHaveBeenCalledWith(file.url);
    await vi.waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });

  it('leaves modifier clicks to the browser', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mountContent([{ type: 'button', buttonType: 'file', label: 'Download', file }]);

    await wrapper.find('a.bb-button').trigger('click', { metaKey: true });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not intercept a preview-mode button', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mountContent([
      { type: 'button', buttonType: 'file', label: 'Preview', file, filePreview: true },
    ]);

    const anchor = wrapper.find('a.bb-button');
    expect(anchor.attributes('target')).toBe('_blank');
    await anchor.trigger('click');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('diagrams', () => {
  const diagram = (value: string): BlocksContent => [
    { type: 'diagram', format: 'mermaid', value, children: [{ type: 'text', text: '' }] },
  ];

  it('renders the SVG after mount, over the server-rendered source', async () => {
    const wrapper = mountContent(diagram('graph TD\n  A-->B'));

    // The first render is the raw source - the same markup the server sent,
    // which is what makes hydration match.
    expect(wrapper.find('pre.mermaid-source').exists()).toBe(true);

    await vi.waitFor(() =>
      expect(wrapper.find('div.mermaid-diagram svg.mock-mermaid').exists()).toBe(true)
    );
    expect(wrapper.find('div.mermaid-diagram').text()).toContain('A-->B');
    expect(wrapper.find('pre.mermaid-source').exists()).toBe(false);
  });

  it('hands mermaid the source unchanged when no theme is set', async () => {
    mountContent(diagram('graph TD\n  A-->B'));

    await vi.waitFor(() => expect(mermaidRender).toHaveBeenCalled());
    expect(mermaidRender.mock.calls[0][1]).toBe('graph TD\n  A-->B');
  });

  it('applies a built-in theme as an init directive', async () => {
    mountContent(diagram('graph TD\n  A-->B'), { diagramTheme: 'dracula' });

    await vi.waitFor(() => expect(mermaidRender).toHaveBeenCalled());
    const source = mermaidRender.mock.calls[0][1];
    expect(source).toContain('%%{init:');
    expect(source).toContain('#282a36');
    expect(source.endsWith('graph TD\n  A-->B')).toBe(true);
  });

  it('applies a custom color palette as an init directive', async () => {
    mountContent(diagram('graph TD\n  A-->B'), {
      diagramTheme: { bg: '#ffffff', fg: '#222222', accent: '#ff0000' },
    });

    await vi.waitFor(() => expect(mermaidRender).toHaveBeenCalled());
    expect(mermaidRender.mock.calls[0][1]).toContain('#ff0000');
  });

  it('keeps the raw source when mermaid cannot parse the diagram', async () => {
    mermaidRender.mockRejectedValueOnce(new Error('Parse error'));

    const wrapper = mountContent(diagram('not a diagram'));

    await vi.waitFor(() => expect(mermaidRender).toHaveBeenCalled());
    expect(wrapper.find('pre.mermaid-source').text()).toBe('not a diagram');
    expect(wrapper.find('div.mermaid-diagram').exists()).toBe(false);
  });

  it('gives each diagram on the page its own render id', async () => {
    mountContent([...diagram('graph TD\n  A-->B'), ...diagram('graph TD\n  C-->D')]);

    await vi.waitFor(() => expect(mermaidRender).toHaveBeenCalledTimes(2));
    const [first, second] = mermaidRender.mock.calls.map((call) => call[0]);
    expect(first).not.toBe(second);
  });

  it('leaves a custom diagram renderer alone', async () => {
    const wrapper = mountContent(diagram('graph TD\n  A-->B'), {
      blocks: {
        diagram: {
          props: ['code', 'format'],
          template: '<div class="custom-diagram">{{ code }}</div>',
        },
      },
    });

    await vi.waitFor(() => expect(wrapper.find('.custom-diagram').exists()).toBe(true));
    expect(mermaidRender).not.toHaveBeenCalled();
  });
});
