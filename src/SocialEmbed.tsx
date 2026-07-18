'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

import type { SocialEmbedOembed, SocialEmbedAlignment, SocialPlatform } from './types';

// Globals the platform widget scripts expose once loaded. Every hop is optional
// so we can call the processor defensively without assuming the script is ready.
interface SocialWindow {
  twttr?: { widgets?: { load?: () => void } };
  instgrm?: { Embeds?: { process?: () => void } };
  FB?: { XFBML?: { parse?: () => void } };
}

// Widget enhancement scripts per platform. `src` is injected once (deduped by
// URL) and, after it loads, `process` re-runs the platform's embed processor so
// the freshly-mounted markup gets upgraded. LinkedIn renders a self-contained
// `<iframe>` and needs no script.
const WIDGET_SCRIPTS: Record<SocialPlatform, { src: string; process?: () => void } | null> = {
  twitter: {
    src: 'https://platform.twitter.com/widgets.js',
    process: () => (window as unknown as SocialWindow).twttr?.widgets?.load?.(),
  },
  instagram: {
    src: 'https://www.instagram.com/embed.js',
    process: () => (window as unknown as SocialWindow).instgrm?.Embeds?.process?.(),
  },
  tiktok: {
    src: 'https://www.tiktok.com/embed.js',
  },
  pinterest: {
    src: 'https://assets.pinterest.com/js/pinit.js',
  },
  facebook: {
    src: 'https://connect.facebook.net/en_US/sdk.js',
    process: () => (window as unknown as SocialWindow).FB?.XFBML?.parse?.(),
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

// One shared load per script URL, so multiple embeds of the same platform don't
// inject duplicate `<script>` tags. Keyed by src; resolves once the script has
// loaded (or immediately if the tag is already present in the DOM).
const scriptPromises = new Map<string, Promise<void>>();

function loadWidgetScript(src: string): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();

  const cached = scriptPromises.get(src);
  if (cached) return cached;

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing) {
    const resolved = Promise.resolve();
    scriptPromises.set(src, resolved);
    return resolved;
  }

  const promise = new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    // Resolve on error too: the embed degrades to the raw platform markup
    // instead of the script rejection bubbling up unhandled.
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => resolve());
    document.body.appendChild(script);
  });
  scriptPromises.set(src, promise);
  return promise;
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
  url: string;
  oembed?: SocialEmbedOembed;
  providerName: string;
}): ReactNode {
  const label = oembed?.author
    ? `${providerName} post by ${oembed.author}`
    : `View on ${providerName}`;

  return (
    <a
      className="bb-social-embed-fallback"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        border: '1px solid #d0d7de',
        borderRadius: '0.5rem',
        textDecoration: 'none',
        color: 'inherit',
        textAlign: 'left',
      }}
    >
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
          {oembed?.title ?? label}
        </span>
        <span
          className="bb-social-embed-fallback-provider"
          style={{ opacity: 0.7, fontSize: '0.875em' }}
        >
          {providerName}
        </span>
      </span>
    </a>
  );
}

// ── Social Embed ─────────────────────────────────────────────────────

/**
 * Renders a Better Blocks `social-embed` node.
 *
 * HTML source priority: `embedCode` (manual override) → `oembed.html` →
 * a graceful fallback link card. The embed HTML is injected verbatim via
 * `dangerouslySetInnerHTML` — it is NOT sanitized, because social embeds rely
 * on `<script>`/`<iframe>`/`<blockquote>` that a sanitizer would strip. Trust
 * boundary: this markup originates from the platform's oEmbed API or a manual
 * override pasted by a trusted editor, so treat the CMS content as trusted.
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
  url: string;
  embedCode?: string;
  oembed?: SocialEmbedOembed;
  alignment?: SocialEmbedAlignment;
  caption?: string;
}): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const html = embedCode ?? oembed?.html;

  useEffect(() => {
    if (!html) return;

    // Any iframe the platform ships in its markup (e.g. LinkedIn) should lazy-load.
    containerRef.current?.querySelectorAll('iframe').forEach((iframe) => {
      if (!iframe.hasAttribute('loading')) iframe.setAttribute('loading', 'lazy');
    });

    const widget = WIDGET_SCRIPTS[platform];
    if (!widget) return;

    let cancelled = false;
    void loadWidgetScript(widget.src).then(() => {
      if (!cancelled) widget.process?.();
    });

    return () => {
      cancelled = true;
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
