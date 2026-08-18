/**
 * What the components do once they are mounted in a browser.
 *
 * The rest of the suite renders on the server, which is where almost everything
 * happens. Three things cannot: Shiki cannot highlight synchronously, a social
 * widget script has to be fetched, and a cross-origin download has to go through
 * `fetch`. Those are here.
 */
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import BlocksRenderer from '../src/BlocksRenderer.vue';
import type { BlocksContent } from '../src/types';

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
