import { afterEach, describe, expect, it, vi } from 'vitest';

import oembedService, { resolveShortUrl } from './oembed';
import type { SocialConfig } from './oembed';

/**
 * The half of the oEmbed service that talks to the network, with `fetch` stubbed.
 *
 * No Strapi here: the service only reaches for
 * `strapi.plugin('better-blocks').config('social')`, and that config actually
 * resolving is already covered by tests/integration/plugin-boot.test.ts. A stub
 * hides nothing and keeps these fast.
 */

const strapiStub = (social: SocialConfig) =>
  ({
    plugin: () => ({
      config: (_key: string, fallback: unknown) => social ?? fallback,
    }),
  }) as any;

const jsonResponse = (body: unknown, url = 'https://example.com') =>
  ({
    ok: true,
    status: 200,
    url,
    json: async () => body,
  }) as unknown as Response;

const TWEET = 'https://twitter.com/user/status/1234567890';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('resolveShortUrl', () => {
  it('does not touch the network for a URL that is not a short link', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const url = 'https://www.pinterest.com/pin/12345/';
    expect(await resolveShortUrl(url)).toBe(url);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('expands a pin.it link to the canonical pin URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({}, 'https://www.pinterest.com/pin/98765/')
      )
    );

    expect(await resolveShortUrl('https://pin.it/abc123')).toBe(
      'https://www.pinterest.com/pin/98765/'
    );
  });

  it('follows redirects rather than reading the Location header itself', async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({}, 'https://www.pinterest.com/pin/1/')
    );
    vi.stubGlobal('fetch', fetchSpy);

    await resolveShortUrl('https://pin.it/abc123');

    expect(fetchSpy).toHaveBeenCalledWith('https://pin.it/abc123', {
      redirect: 'follow',
    });
  });

  it('keeps the original URL when the redirect lands somewhere that is not a pin', async () => {
    // Pinterest bounces short links through api.pinterest.com; that is not an
    // address the oEmbed endpoint accepts.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({}, 'https://api.pinterest.com/url_shortener/x/redirect')
      )
    );

    expect(await resolveShortUrl('https://pin.it/abc123')).toBe(
      'https://pin.it/abc123'
    );
  });

  it('keeps the original URL when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      })
    );

    // A dead short-link resolver must not take the whole embed down with it.
    expect(await resolveShortUrl('https://pin.it/abc123')).toBe(
      'https://pin.it/abc123'
    );
  });
});

describe('service.fetch', () => {
  const service = (social: SocialConfig) =>
    oembedService({ strapi: strapiStub(social) });

  it('refuses when social embeds are switched off', async () => {
    await expect(service({ enabled: false }).fetch(TWEET)).rejects.toThrow(
      /disabled in plugin config/
    );
  });

  it('refuses a platform left out of the configured list', async () => {
    await expect(
      service({ platforms: ['tiktok'] }).fetch(TWEET)
    ).rejects.toThrow(/"twitter" is not enabled/);
  });

  it('refuses a URL it cannot attribute to a platform', async () => {
    await expect(service({}).fetch('https://example.com/x')).rejects.toThrow(
      /Unsupported or unrecognized/
    );
  });

  it('returns the normalised payload for a successful request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          html: '<blockquote>hi</blockquote><script src="widgets.js"></script>',
          author_name: 'Someone',
        })
      )
    );

    const result = await service({ cache: false }).fetch(TWEET);

    expect(result.platform).toBe('twitter');
    expect(result.html).toBe('<blockquote>hi</blockquote>');
    expect(result.author).toBe('Someone');
  });

  it('surfaces an error payload returned with HTTP 200', async () => {
    // Pinterest notably answers 200 with an error body. Storing that silently
    // would leave a bare link on the frontend with no explanation.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'Pin not found' }))
    );

    await expect(service({ cache: false }).fetch(TWEET)).rejects.toThrow(
      /Pin not found/
    );
  });

  it('surfaces a failed upstream request with its status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 }) as unknown as Response)
    );

    await expect(service({ cache: false }).fetch(TWEET)).rejects.toThrow(
      /HTTP 404/
    );
  });

  it('rejects a payload with no embed markup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ html: '' }))
    );

    await expect(service({ cache: false }).fetch(TWEET)).rejects.toThrow(
      /returned no embed markup/
    );
  });

  it('builds a LinkedIn embed without calling out to the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await service({ cache: false }).fetch(
      'https://www.linkedin.com/feed/update/urn:li:activity:7000000000000000000/'
    );

    expect(result.platform).toBe('linkedin');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('serves a second request for the same URL from cache', async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({ html: '<blockquote>hi</blockquote>' })
    );
    vi.stubGlobal('fetch', fetchSpy);

    const svc = service({});
    await svc.fetch(TWEET);
    await svc.fetch(TWEET);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('goes back to the network when caching is switched off', async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({ html: '<blockquote>hi</blockquote>' })
    );
    vi.stubGlobal('fetch', fetchSpy);

    const svc = service({ cache: false });
    await svc.fetch(TWEET);
    await svc.fetch(TWEET);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps the cache within the configured bound', async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({ html: '<blockquote>hi</blockquote>' })
    );
    vi.stubGlobal('fetch', fetchSpy);

    const svc = service({ cacheMaxEntries: 2 });

    // Three distinct posts through a cache that holds two: the first is evicted,
    // so asking for it again is a miss and hits the network a second time.
    await svc.fetch('https://twitter.com/user/status/1');
    await svc.fetch('https://twitter.com/user/status/2');
    await svc.fetch('https://twitter.com/user/status/3');
    await svc.fetch('https://twitter.com/user/status/1');

    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it('does not share cached embeds between service instances', async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({ html: '<blockquote>hi</blockquote>' })
    );
    vi.stubGlobal('fetch', fetchSpy);

    await service({}).fetch(TWEET);
    await service({}).fetch(TWEET);

    // The cache used to live at module scope, so a second Strapi instance in the
    // same process inherited the first one's embeds.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
