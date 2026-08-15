'use client';

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react';

import {
  MEDIA_CAPTION_STYLE,
  getAspectRatio,
  getMediaFigureStyle,
  getMediaFrameStyle,
} from './media';
import type { AspectRatio, MediaAlignment, VideoFile, VideoPlayer, VideoProvider } from './types';

// ── Optional HLS support ─────────────────────────────────────────────

// Minimal structural type for the bits of hls.js we touch. Declaring it here
// keeps the package free of an `hls.js` dependency (and of a build-time import
// that consumers who don't need it would have to install anyway).
type HlsInstance = {
  loadSource: (url: string) => void;
  attachMedia: (media: HTMLMediaElement) => void;
  destroy: () => void;
};

type HlsConstructor = {
  new (): HlsInstance;
  isSupported?: () => boolean;
};

// hls.js is picked up from `window.Hls` — set either by its UMD build loaded
// from a <script> tag, or by a one-liner in the consumer's app entry:
//   import Hls from 'hls.js'; window.Hls = Hls;
// Resolving it at runtime rather than importing it keeps the dependency
// genuinely optional: apps that never render an HLS video ship nothing extra,
// and apps that don't install it at all still build.
type HlsWindow = { Hls?: HlsConstructor };

const HLS_MANIFEST = /\.m3u8(?:[?#]|$)/i;
const DASH_MANIFEST = /\.mpd(?:[?#]|$)/i;

// `<mux-player>` typed as a component so the dashed attributes type-check. The
// element is only rendered once the consumer's bundle has registered it.
const MuxPlayer = 'mux-player' as unknown as ComponentType<Record<string, unknown>>;

/**
 * Renders a Better Blocks `video` node.
 *
 * Direct file URLs (`provider: "local"` / `"custom"`) use a native `<video>`.
 * HLS/DASH manifests — most Mux assets — only play natively in Safari, so this
 * component opportunistically upgrades them without taking on a dependency:
 *
 * - `provider: "mux"` with a `playbackId` renders `<mux-player>` when the
 *   consumer has registered that custom element (`@mux/mux-player`).
 * - `.m3u8` sources attach `hls.js` when the consumer exposes it as
 *   `window.Hls` and the browser supports it (everywhere but iOS WebKit).
 * - Otherwise playback falls back to the native element, which works in Safari
 *   and shows the `poster` elsewhere.
 *
 * Pass your own `video` block renderer for full control over the player.
 */
export function Video({
  provider,
  url,
  playbackId,
  poster,
  title,
  caption,
  transcript,
  player,
  alignment = 'center',
  aspectRatio,
  customAspectRatio,
  instanceId,
}: {
  provider?: VideoProvider;
  url: string;
  assetId?: string;
  playbackId?: string;
  file?: VideoFile;
  poster?: string;
  title?: string;
  caption?: string;
  transcript?: string;
  player?: VideoPlayer;
  alignment?: MediaAlignment;
  aspectRatio?: AspectRatio;
  customAspectRatio?: string;
  /** Disambiguates the generated caption id when several videos share a page. */
  instanceId?: string | number;
}): ReactNode {
  const videoRef = useRef<HTMLVideoElement>(null);

  const wantsMux = provider === 'mux' && Boolean(playbackId);
  const [muxDefined, setMuxDefined] = useState(false);

  // `<mux-player>` is usually registered by a side-effect import that resolves
  // after first paint, so watch for the definition instead of checking once.
  useEffect(() => {
    if (!wantsMux || typeof window === 'undefined' || !window.customElements) return;
    if (window.customElements.get('mux-player')) {
      setMuxDefined(true);
      return;
    }

    let cancelled = false;
    void window.customElements.whenDefined('mux-player').then(() => {
      if (!cancelled) setMuxDefined(true);
    });

    return () => {
      cancelled = true;
    };
  }, [wantsMux]);

  const isHls = HLS_MANIFEST.test(url);
  const isStreaming = isHls || DASH_MANIFEST.test(url);
  const useMux = wantsMux && muxDefined;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isHls) return;

    // Prefer hls.js wherever it runs, and only fall through to native playback
    // when it can't (iOS WebKit, which has no MSE but does play the manifest
    // straight from `src`). Sniffing `canPlayType` first looks tempting and is
    // wrong: Chrome answers "maybe" for `application/vnd.apple.mpegurl` and
    // then fails to play anything.
    const Hls = (window as unknown as HlsWindow).Hls;
    if (!Hls || Hls.isSupported?.() === false) return;

    let instance: HlsInstance | undefined;
    try {
      instance = new Hls();
      instance.loadSource(url);
      instance.attachMedia(video);
    } catch {
      // A broken/incompatible build shouldn't take the page down — the poster
      // stays visible, same as when hls.js isn't present at all.
      instance?.destroy();
      instance = undefined;
    }

    return () => instance?.destroy();
  }, [isHls, url, useMux]);

  const capId = caption ? `bb-video-cap-${instanceId ?? playbackId ?? 0}` : undefined;
  const ratio = getAspectRatio(aspectRatio, customAspectRatio);
  const frameStyle = getMediaFrameStyle(alignment, ratio);
  const fillStyle: CSSProperties = { width: '100%', height: '100%', display: 'block' };

  return (
    <figure
      className={`bb-video align-${alignment}`}
      style={getMediaFigureStyle(alignment)}
      aria-label={title ? `Video: ${title}` : undefined}
    >
      {title && (
        <figcaption className="bb-video-title" style={{ fontWeight: 600 }}>
          {title}
        </figcaption>
      )}
      <div className="bb-video-frame" style={frameStyle}>
        {useMux ? (
          <MuxPlayer
            className="bb-video-player"
            playback-id={playbackId}
            poster={poster}
            metadata-video-title={title}
            autoplay={player?.autoplay ? true : undefined}
            loop={player?.loop ? true : undefined}
            muted={player?.muted ? true : undefined}
            aria-describedby={capId}
            style={fillStyle}
          />
        ) : (
          <video
            ref={videoRef}
            className="bb-video-player"
            src={url}
            poster={poster}
            controls={player?.controls ?? true}
            autoPlay={player?.autoplay ?? false}
            loop={player?.loop ?? false}
            muted={player?.muted ?? false}
            playsInline
            // Streaming manifests are handed to hls.js / the provider player,
            // so don't let the browser prefetch a source it can't parse.
            preload={isStreaming ? 'none' : 'metadata'}
            aria-label={title || 'Video player'}
            aria-describedby={capId}
            style={fillStyle}
          >
            {transcript && <track kind="captions" src={transcript} label="Captions" />}
            Your browser does not support the video element. <a href={url}>Download the video</a>.
          </video>
        )}
      </div>
      {caption && (
        <figcaption id={capId} className="bb-video-caption" style={MEDIA_CAPTION_STYLE}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
