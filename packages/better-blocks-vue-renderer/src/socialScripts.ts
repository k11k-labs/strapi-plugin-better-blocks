/**
 * Lazy, deduped loader for social-platform widget scripts.
 *
 * The embed markup itself is server-rendered, so a page has its posts in the
 * HTML before any of this runs. What a platform script adds is the upgrade -
 * turning a `<blockquote>` into the real card - and there is no reason to pay
 * for it before an embed is anywhere near the viewport. Each `SocialEmbed`
 * hands its element here on mount; the script is injected once per platform,
 * when the first embed of that platform scrolls close.
 *
 * Everything below is client-only and guards on `document`, so importing the
 * module during SSR is inert.
 */

import type { SocialPlatform } from './types';

import { SOCIAL_SCRIPTS } from './utils';

// Globals the platform widget scripts expose once loaded. Every hop is optional
// so the processor can be called defensively without assuming the script is ready.
interface SocialWindow {
  twttr?: { widgets?: { load?: () => void } };
  instgrm?: { Embeds?: { process?: () => void } };
  FB?: { XFBML?: { parse?: () => void } };
  tiktokEmbed?: { lib?: { render?: (elements: Element[]) => void } };
  PinUtils?: { build?: () => void };
}

const socialWindow = (): SocialWindow => window as unknown as SocialWindow;

// Marks the `<script>` tags this module injected. Deduping on `src` alone is a
// trap: TikTok's oEmbed payload always ships `<script src=".../embed.js">`
// inline, and matching that would make the loader skip the real load and leave
// the blockquote un-upgraded forever.
const SCRIPT_MARKER = 'data-bb-social-script';

/**
 * Re-runs a platform's embed processor over markup that mounted after its
 * script loaded. Returns `false` when the platform's global is genuinely
 * missing, so the caller can re-inject the script instead.
 */
function process(platform: SocialPlatform, container: HTMLElement): boolean {
  const w = socialWindow();
  switch (platform) {
    case 'twitter': {
      const load = w.twttr?.widgets?.load;
      load?.();
      return Boolean(load);
    }
    case 'instagram': {
      const run = w.instgrm?.Embeds?.process;
      run?.();
      return Boolean(run);
    }
    case 'facebook': {
      const parse = w.FB?.XFBML?.parse;
      parse?.();
      return Boolean(parse);
    }
    case 'pinterest': {
      const build = w.PinUtils?.build;
      build?.();
      return Boolean(build);
    }
    case 'tiktok': {
      const render = w.tiktokEmbed?.lib?.render;
      render?.(Array.from(container.querySelectorAll('.tiktok-embed')));
      return Boolean(render);
    }
    default:
      return true;
  }
}

// One shared load per platform, so several embeds of the same platform don't
// inject duplicate `<script>` tags.
const loads = new Map<SocialPlatform, Promise<void>>();

// Platforms whose script was already re-injected once after `process` reported
// a missing global - the retry gets a single shot, so a permanently blocked
// script can't trigger a request per mount.
const reinjected = new Set<SocialPlatform>();

function inject(platform: SocialPlatform, src: string): Promise<void> {
  const promise = new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute(SCRIPT_MARKER, platform);
    if (platform === 'instagram' || platform === 'facebook') script.crossOrigin = 'anonymous';
    // Resolve on error too: the embed degrades to the raw platform markup
    // instead of an unhandled rejection.
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => resolve());
    document.body.appendChild(script);
  });
  loads.set(platform, promise);
  return promise;
}

function load(platform: SocialPlatform, src: string): Promise<void> {
  const cached = loads.get(platform);
  if (cached) return cached;

  // A script this module injected on an earlier page of the same session is
  // already there; nothing to fetch, only markup to process.
  if (document.querySelector(`script[${SCRIPT_MARKER}="${platform}"]`)) {
    const resolved = Promise.resolve();
    loads.set(platform, resolved);
    return resolved;
  }

  return inject(platform, src);
}

/** Last resort when the platform exposes no processor: re-inject so it rescans. */
function reinject(platform: SocialPlatform, src: string): void {
  if (reinjected.has(platform)) return;
  reinjected.add(platform);
  document.querySelectorAll(`script[${SCRIPT_MARKER}="${platform}"]`).forEach((s) => s.remove());
  loads.delete(platform);
  void inject(platform, src);
}

function upgrade(platform: SocialPlatform, container: HTMLElement): void {
  const src = SOCIAL_SCRIPTS[platform];
  if (!src) return; // e.g. linkedin - a self-contained iframe.
  void load(platform, src).then(() => {
    if (!process(platform, container)) reinject(platform, src);
  });
}

/**
 * Watches one embed and loads its platform's widget script when it nears the
 * viewport. Returns the teardown to run when the component unmounts.
 */
export function enhanceSocialEmbed(container: HTMLElement, platform: SocialPlatform): () => void {
  if (typeof document === 'undefined') return () => {};
  if (!SOCIAL_SCRIPTS[platform]) return () => {};

  // No IntersectionObserver (old browsers, some test environments) - upgrade now.
  if (typeof IntersectionObserver === 'undefined') {
    upgrade(platform, container);
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      upgrade(platform, container);
    },
    { rootMargin: '200px' }
  );
  observer.observe(container);
  return () => observer.disconnect();
}
