import { describe, expect, it } from 'vitest';

import {
  buildEndpoint,
  buildLinkedInIframe,
  detectPlatform,
  normalize,
  stripScripts,
} from './oembed';

/**
 * The pure half of the oEmbed service. Everything here is a data transform over
 * a URL or a provider payload, so none of it needs Strapi - which is the point:
 * the parts most likely to break when a platform changes its URL shape are also
 * the cheapest to pin down.
 */

describe('detectPlatform', () => {
  it('recognises both twitter.com and x.com status URLs', () => {
    expect(detectPlatform('https://twitter.com/user/status/1234567890')).toBe(
      'twitter'
    );
    expect(detectPlatform('https://x.com/user/status/1234567890')).toBe(
      'twitter'
    );
  });

  it('accepts the legacy /statuses/ path', () => {
    expect(detectPlatform('https://twitter.com/user/statuses/1234567890')).toBe(
      'twitter'
    );
  });

  it('recognises the three Instagram post shapes', () => {
    expect(detectPlatform('https://www.instagram.com/p/Cabc123/')).toBe(
      'instagram'
    );
    expect(detectPlatform('https://www.instagram.com/reel/Cabc123/')).toBe(
      'instagram'
    );
    expect(detectPlatform('https://www.instagram.com/tv/Cabc123/')).toBe(
      'instagram'
    );
  });

  it('does not treat an Instagram profile as an embeddable post', () => {
    // Better a clear "unsupported URL" than an upstream request that fails.
    expect(detectPlatform('https://www.instagram.com/someuser/')).toBeNull();
  });

  it('recognises TikTok video URLs', () => {
    expect(
      detectPlatform(
        'https://www.tiktok.com/@someone/video/7300000000000000000'
      )
    ).toBe('tiktok');
  });

  it('recognises Pinterest pins and pin.it short links', () => {
    expect(detectPlatform('https://www.pinterest.com/pin/12345/')).toBe(
      'pinterest'
    );
    expect(detectPlatform('https://pin.it/abc123')).toBe('pinterest');
    // Regional domains are covered by the [a-z.]+ suffix.
    expect(detectPlatform('https://www.pinterest.co.uk/pin/12345/')).toBe(
      'pinterest'
    );
  });

  it('matches the narrower platforms before the catch-all ones', () => {
    // `facebook.com/` and `linkedin.com/` match any path on those hosts, so
    // they only stay correct because they sit last in the pattern list. A
    // reordering that broke this would be invisible without a test.
    expect(detectPlatform('https://www.facebook.com/someone/posts/123')).toBe(
      'facebook'
    );
    expect(
      detectPlatform('https://www.linkedin.com/feed/update/urn:li:activity:1/')
    ).toBe('linkedin');
  });

  it('returns null for a URL from no known platform', () => {
    expect(detectPlatform('https://example.com/post/1')).toBeNull();
  });
});

describe('buildLinkedInIframe', () => {
  it('keeps an activity id addressed as an activity', () => {
    // LinkedIn 404s an activity id addressed as a share, so the type carried by
    // the URL has to survive into the URN.
    const embed = buildLinkedInIframe(
      'https://www.linkedin.com/posts/someone_slug-activity-7000000000000000000-AbCd'
    );

    expect(embed).not.toBeNull();
    expect(embed!.html).toContain(
      encodeURIComponent('urn:li:activity:7000000000000000000')
    );
  });

  it('preserves the ugcPost capitalisation LinkedIn expects', () => {
    // The URL spells it lowercase; the URN must not.
    const embed = buildLinkedInIframe(
      'https://www.linkedin.com/feed/update/urn:li:ugcpost:7123456789012345678/'
    );

    expect(embed!.html).toContain(
      encodeURIComponent('urn:li:ugcPost:7123456789012345678')
    );
  });

  it('keeps a share id addressed as a share', () => {
    const embed = buildLinkedInIframe(
      'https://www.linkedin.com/feed/update/urn:li:share:7000000000000000001/'
    );

    expect(embed!.html).toContain(
      encodeURIComponent('urn:li:share:7000000000000000001')
    );
  });

  it('returns null when the URL carries no usable URN', () => {
    expect(
      buildLinkedInIframe('https://www.linkedin.com/in/someone/')
    ).toBeNull();
    // Ids shorter than 10 digits are not LinkedIn URNs.
    expect(
      buildLinkedInIframe('https://www.linkedin.com/feed/update/activity-42/')
    ).toBeNull();
  });

  it('describes itself as a LinkedIn embed', () => {
    const embed = buildLinkedInIframe(
      'https://www.linkedin.com/feed/update/urn:li:activity:7000000000000000000/'
    );

    expect(embed!.platform).toBe('linkedin');
    expect(embed!.providerName).toBe('LinkedIn');
    expect(embed!.html).toContain('title="Embedded LinkedIn post"');
  });
});

describe('stripScripts', () => {
  it('removes the widget script providers ship inline', () => {
    const html = stripScripts(
      '<blockquote class="tiktok-embed">post</blockquote>\n' +
        '<script async src="https://www.tiktok.com/embed.js"></script>'
    );

    expect(html).toBe('<blockquote class="tiktok-embed">post</blockquote>');
  });

  it('removes multiple scripts and multi-line script bodies', () => {
    const html = stripScripts(
      '<p>a</p><script>\nwindow.x = 1;\n</script><p>b</p><script src="x.js"></script>'
    );

    expect(html).toBe('<p>a</p><p>b</p>');
  });

  it('is case-insensitive about the tag', () => {
    expect(stripScripts('<p>a</p><SCRIPT>x()</SCRIPT>')).toBe('<p>a</p>');
  });

  it('leaves markup without scripts untouched', () => {
    const markup =
      '<blockquote class="twitter-tweet"><p>hello</p></blockquote>';
    expect(stripScripts(markup)).toBe(markup);
  });
});

describe('normalize', () => {
  const url = 'https://twitter.com/user/status/1';

  it('maps a provider payload onto the normalised shape', () => {
    const result = normalize('twitter', url, {
      html: '<blockquote>hi</blockquote>',
      author_name: 'Someone',
      author_url: 'https://twitter.com/user',
      thumbnail_url: 'https://example.com/thumb.jpg',
      provider_name: 'Twitter',
      width: 550,
      height: 400,
    });

    expect(result).toEqual({
      platform: 'twitter',
      url,
      html: '<blockquote>hi</blockquote>',
      title: undefined,
      author: 'Someone',
      authorUrl: 'https://twitter.com/user',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      providerName: 'Twitter',
      width: 550,
      height: 400,
    });
  });

  it('strips scripts out of the provider markup', () => {
    const result = normalize('tiktok', url, {
      html: '<blockquote>post</blockquote><script src="embed.js"></script>',
    });

    expect(result.html).toBe('<blockquote>post</blockquote>');
  });

  it('reports html as null when the payload is script-only', () => {
    // The caller turns a null html into a clear error rather than storing an
    // embed that degrades to a bare link on the frontend.
    const result = normalize('tiktok', url, {
      html: '<script src="embed.js"></script>',
    });

    expect(result.html).toBeNull();
  });

  it('ignores fields of the wrong type instead of passing them through', () => {
    const result = normalize('twitter', url, {
      html: 42,
      author_name: { name: 'Someone' },
      width: '550',
    });

    expect(result.html).toBeNull();
    expect(result.author).toBeUndefined();
    expect(result.width).toBeUndefined();
  });
});

describe('buildEndpoint', () => {
  const url = 'https://twitter.com/user/status/1?utm=x';

  it('asks Twitter to omit the script and honour do-not-track', () => {
    const endpoint = buildEndpoint('twitter', url, {});

    expect(endpoint).toContain('omit_script=true');
    expect(endpoint).toContain('dnt=true');
    expect(endpoint).toContain(`url=${encodeURIComponent(url)}`);
  });

  it('builds token-free endpoints for TikTok and Pinterest', () => {
    expect(buildEndpoint('tiktok', url, {})).toContain(
      'https://www.tiktok.com/oembed?url='
    );
    expect(buildEndpoint('pinterest', url, {})).toContain(
      'https://www.pinterest.com/oembed.json?url='
    );
  });

  it('returns null for Instagram and Facebook without an access token', () => {
    // This null is what produces the "configure a token" message instead of a
    // request that fails upstream for an unexplained reason.
    expect(buildEndpoint('instagram', url, {})).toBeNull();
    expect(buildEndpoint('facebook', url, {})).toBeNull();
    expect(
      buildEndpoint('instagram', url, { instagram: { accessToken: '' } })
    ).toBeNull();
  });

  it('encodes the access token into the Graph API endpoint', () => {
    const endpoint = buildEndpoint('instagram', url, {
      instagram: { accessToken: 'tok|en' },
    });

    expect(endpoint).toContain('instagram_oembed');
    expect(endpoint).toContain(`access_token=${encodeURIComponent('tok|en')}`);
    expect(endpoint).toContain('omitscript=true');
  });

  it('returns null for LinkedIn, which has no oEmbed API', () => {
    expect(buildEndpoint('linkedin', url, {})).toBeNull();
  });
});
