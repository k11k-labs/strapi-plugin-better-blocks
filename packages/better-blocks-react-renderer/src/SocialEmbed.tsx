'use client';

import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';

import type { SocialEmbedOembed, SocialEmbedAlignment, SocialPlatform } from './types';

// Globals the platform widget scripts expose once loaded. Every hop is optional
// so we can call the processor defensively without assuming the script is ready.
interface SocialWindow {
  twttr?: { widgets?: { load?: () => void } };
  instgrm?: { Embeds?: { process?: () => void } };
  FB?: { XFBML?: { parse?: () => void } };
  tiktokEmbed?: { lib?: { render?: (elements: Element[]) => void } };
  PinUtils?: { build?: () => void };
}

interface WidgetScript {
  src: string;
  // Re-runs the platform's embed processor over freshly-mounted markup. Returns
  // `false` when the platform global isn't available (script blocked, or the
  // vendor renamed its API), which makes the caller re-inject the script so it
  // rescans the document on its own.
  process: (container: HTMLElement) => boolean;
}

const socialWindow = (): SocialWindow => window as unknown as SocialWindow;

// Widget enhancement scripts per platform. `src` is injected once and, after it
// loads, `process` upgrades the mounted markup - this also covers remounts and
// SPA navigations, where the script is long since loaded and only the new
// markup needs processing. LinkedIn renders a self-contained `<iframe>` and
// needs no script.
const WIDGET_SCRIPTS: Record<SocialPlatform, WidgetScript | null> = {
  twitter: {
    src: 'https://platform.twitter.com/widgets.js',
    process: () => {
      const load = socialWindow().twttr?.widgets?.load;
      load?.();
      return Boolean(load);
    },
  },
  instagram: {
    src: 'https://www.instagram.com/embed.js',
    process: () => {
      const process = socialWindow().instgrm?.Embeds?.process;
      process?.();
      return Boolean(process);
    },
  },
  tiktok: {
    src: 'https://www.tiktok.com/embed.js',
    process: (container) => {
      const render = socialWindow().tiktokEmbed?.lib?.render;
      render?.(Array.from(container.querySelectorAll('.tiktok-embed')));
      return Boolean(render);
    },
  },
  pinterest: {
    src: 'https://assets.pinterest.com/js/pinit.js',
    process: () => {
      const build = socialWindow().PinUtils?.build;
      build?.();
      return Boolean(build);
    },
  },
  facebook: {
    src: 'https://connect.facebook.net/en_US/sdk.js',
    process: () => {
      const parse = socialWindow().FB?.XFBML?.parse;
      parse?.();
      return Boolean(parse);
    },
  },
  linkedin: null,
};

// Human-readable provider name used for the a11y label and fallback card when
// the oEmbed payload doesn't supply its own `providerName`.
const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  twitter: 'X',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
};

// Marks the `<script>` tags we injected ourselves. Deduping on `src` alone is a
// trap: TikTok's oEmbed payload always ships `<script src=".../embed.js">`
// inline, and a script inserted through `dangerouslySetInnerHTML` sits in the
// DOM without ever executing - matching it would make us skip the real load and
// leave the blockquote un-upgraded forever.
const SCRIPT_MARKER = 'data-bb-social-script';

// One shared load per script URL, so multiple embeds of the same platform don't
// inject duplicate `<script>` tags. Keyed by src; resolves once the script has
// loaded (or immediately if a tag we injected earlier is already present).
const scriptPromises = new Map<string, Promise<void>>();

// Platforms whose script we already re-injected once after `process` reported a
// missing global - the retry gets a single shot, so a permanently blocked
// script can't trigger a request per mount.
const reinjected = new Set<SocialPlatform>();

function injectScript(src: string, platform: SocialPlatform): Promise<void> {
  const promise = new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute(SCRIPT_MARKER, platform);
    // Resolve on error too: the embed degrades to the raw platform markup
    // instead of the script rejection bubbling up unhandled.
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => resolve());
    document.body.appendChild(script);
  });
  scriptPromises.set(src, promise);
  return promise;
}

function loadWidgetScript(src: string, platform: SocialPlatform): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();

  const cached = scriptPromises.get(src);
  if (cached) return cached;

  const existing = document.querySelector(`script[${SCRIPT_MARKER}="${platform}"]`);
  if (existing) {
    const resolved = Promise.resolve();
    scriptPromises.set(src, resolved);
    return resolved;
  }

  return injectScript(src, platform);
}

// Last resort when the platform exposes no processor we can call: drop our
// script and inject a fresh copy so the widget rescans the document.
function reinjectWidgetScript(src: string, platform: SocialPlatform): void {
  if (typeof document === 'undefined' || reinjected.has(platform)) return;
  reinjected.add(platform);

  document.querySelectorAll(`script[${SCRIPT_MARKER}="${platform}"]`).forEach((script) => {
    script.remove();
  });
  scriptPromises.delete(src);
  void injectScript(src, platform);
}

// `<script>` tags injected via `dangerouslySetInnerHTML` never execute, so the
// platform script inline in an oEmbed payload (TikTok always, hand-pasted
// Instagram snippets often) is dead weight that only confuses script dedupe.
// We inject the widget script ourselves instead.
const SCRIPT_TAG = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;

function stripScripts(html: string | undefined): string | undefined {
  return html?.replace(SCRIPT_TAG, '');
}

// ── Fallback Link Card ───────────────────────────────────────────────

// Rendered when neither `embedCode` nor `oembed.html` is available: a plain,
// always-working link to the source post, enriched with the oEmbed thumbnail
// and author when present.
function FallbackCard({
  url,
  oembed,
  providerName,
}: {
  url?: string;
  oembed?: SocialEmbedOembed;
  providerName: string;
}): ReactNode {
  // Title first, author second, and only then the bare "View on X" prompt. The
  // provider line is dropped in that last case - with no title and no author it
  // would just repeat the prompt back ("View on X" over "X").
  const title = oembed?.title ?? (oembed?.author ? `Post by ${oembed.author}` : null);

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    border: '1px solid #d0d7de',
    borderRadius: '0.5rem',
    textDecoration: 'none',
    color: 'inherit',
    textAlign: 'left',
  };

  // An embed saved with a manual `embedCode` and no source URL has nothing to
  // link to - render the same card as a plain element rather than an `href=""`
  // anchor, which would reload the current page.
  const Tag = url ? 'a' : 'div';
  const linkProps = url ? { href: url, target: '_blank', rel: 'noopener noreferrer' } : {};

  return (
    <Tag className="bb-social-embed-fallback" style={style} {...linkProps}>
      {oembed?.thumbnailUrl && (
        <img
          className="bb-social-embed-fallback-thumb"
          src={oembed.thumbnailUrl}
          alt=""
          loading="lazy"
          width={48}
          height={48}
          style={{ borderRadius: '0.25rem', objectFit: 'cover', flexShrink: 0 }}
        />
      )}
      <span className="bb-social-embed-fallback-body">
        <span
          className="bb-social-embed-fallback-title"
          style={{ display: 'block', fontWeight: 600 }}
        >
          {title ?? `View on ${providerName}`}
        </span>
        {title && (
          <span
            className="bb-social-embed-fallback-provider"
            style={{ opacity: 0.7, fontSize: '0.875em' }}
          >
            {providerName}
          </span>
        )}
      </span>
    </Tag>
  );
}

// ── Social Embed ─────────────────────────────────────────────────────

/**
 * Renders a Better Blocks `social-embed` node.
 *
 * HTML source priority: `embedCode` (manual override) → `oembed.html` →
 * a graceful fallback link card. The embed HTML is injected via
 * `dangerouslySetInnerHTML` with only its `<script>` tags removed (they never
 * execute there anyway; the widget script is loaded separately). It is NOT
 * otherwise sanitized, because social embeds rely on `<iframe>`/`<blockquote>`
 * markup that a sanitizer would strip. Trust boundary: this markup originates
 * from the platform's oEmbed API or a manual override pasted by a trusted
 * editor, so treat the CMS content as trusted.
 */
export function SocialEmbed({
  platform,
  url,
  embedCode,
  oembed,
  alignment = 'center',
  caption,
}: {
  platform: SocialPlatform;
  url?: string;
  embedCode?: string;
  oembed?: SocialEmbedOembed;
  alignment?: SocialEmbedAlignment;
  caption?: string;
}): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => stripScripts(embedCode ?? oembed?.html), [embedCode, oembed?.html]);

  useEffect(() => {
    if (!html) return;

    // Any iframe the platform ships in its markup (e.g. LinkedIn) should lazy-load.
    containerRef.current?.querySelectorAll('iframe').forEach((iframe) => {
      if (!iframe.hasAttribute('loading')) iframe.setAttribute('loading', 'lazy');
    });

    const widget = WIDGET_SCRIPTS[platform];
    if (!widget) return;

    let canceled = false;
    void loadWidgetScript(widget.src, platform).then(() => {
      const container = containerRef.current;
      if (canceled || !container) return;
      if (!widget.process(container)) reinjectWidgetScript(widget.src, platform);
    });

    return () => {
      canceled = true;
    };
  }, [platform, html]);

  const providerName = oembed?.providerName ?? PLATFORM_LABELS[platform];
  const ariaLabel = oembed?.author
    ? `${providerName} post by ${oembed.author}`
    : `${providerName} post`;

  const figureStyle: CSSProperties = {
    margin: alignment === 'center' ? '1rem auto' : '1rem 0',
    textAlign: alignment,
  };

  return (
    <figure
      className={`bb-social-embed bb-social-embed-${platform} social-embed align-${alignment}`}
      aria-label={ariaLabel}
      style={figureStyle}
    >
      {html ? (
        <div
          ref={containerRef}
          className="bb-social-embed-html"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <FallbackCard url={url} oembed={oembed} providerName={providerName} />
      )}
      {caption && <figcaption className="bb-social-embed-caption">{caption}</figcaption>}
    </figure>
  );
}
