import { type VideoProvider } from '../utils/types';

/* ---------------------------------------------------------------------------
 * Video hosting providers
 *
 * The video block plays a *source*, not an iframe: an uploaded Media Library
 * file, a provider playback id, or a direct URL. This module maps between those
 * three, so the author only ever has to supply the one they have at hand.
 *
 * Anything that can only be embedded as an iframe (YouTube, Vimeo, Loom …)
 * belongs to the `embed` block instead — see ./embedProviders.
 * -------------------------------------------------------------------------*/

/** Mux playback ids are opaque; this is the shape the API actually returns. */
const MUX_PLAYBACK_ID = /^[A-Za-z0-9]{20,}$/;

const MUX_URL = /stream\.mux\.com\/([A-Za-z0-9]+)(?:\.m3u8)?/i;
const API_VIDEO_URL =
  /(?:embed\.api\.video\/vod|vod\.api\.video)\/([A-Za-z0-9]+)/i;
const CLOUDINARY_URL =
  /res\.cloudinary\.com\/([^/]+)\/video\/upload\/(?:.*\/)?([^/.]+)\.[a-z0-9]+/i;

/** Hosts an app must allow for Mux playback (media-src / img-src). */
export const MUX_HOSTS = {
  stream: 'https://stream.mux.com',
  image: 'https://image.mux.com',
};

/**
 * HLS manifest for a Mux playback id.
 *
 * Only valid for assets with a **public** playback policy. Signed playback
 * requires a per-request JWT (`?token=…`) that must be minted server-side with
 * a Mux signing key, which this block deliberately does not handle — storing a
 * short-lived token in the document body would break as soon as it expired.
 */
export const muxPlaybackUrl = (playbackId: string): string =>
  `${MUX_HOSTS.stream}/${playbackId}.m3u8`;

/** Auto-generated poster frame for a Mux playback id (public policy only). */
export const muxThumbnailUrl = (playbackId: string): string =>
  `${MUX_HOSTS.image}/${playbackId}/thumbnail.jpg`;

export const isMuxPlaybackId = (value: string): boolean =>
  MUX_PLAYBACK_ID.test(value.trim());

export interface DetectedVideo {
  provider: VideoProvider;
  url: string;
  playbackId?: string;
  poster?: string;
}

/**
 * Work out what a pasted string is: a Mux playback id, a provider URL, or a
 * plain video file URL. Returns null for empty input.
 */
export const detectVideoSource = (input: string): DetectedVideo | null => {
  const value = input.trim();
  if (!value) return null;

  // A bare Mux playback id — what the Mux dashboard shows next to an asset.
  if (!value.includes('/') && isMuxPlaybackId(value)) {
    return {
      provider: 'mux',
      url: muxPlaybackUrl(value),
      playbackId: value,
      poster: muxThumbnailUrl(value),
    };
  }

  const mux = value.match(MUX_URL);
  if (mux) {
    return {
      provider: 'mux',
      url: muxPlaybackUrl(mux[1]),
      playbackId: mux[1],
      poster: muxThumbnailUrl(mux[1]),
    };
  }

  const apiVideo = value.match(API_VIDEO_URL);
  if (apiVideo) {
    return {
      provider: 'api-video',
      url: value,
      playbackId: apiVideo[1],
    };
  }

  const cloudinary = value.match(CLOUDINARY_URL);
  if (cloudinary) {
    const [, cloud, publicId] = cloudinary;
    return {
      provider: 'cloudinary',
      url: value,
      playbackId: publicId,
      // Cloudinary derives a poster by swapping the extension to .jpg.
      poster: `https://res.cloudinary.com/${cloud}/video/upload/${publicId}.jpg`,
    };
  }

  return { provider: 'custom', url: value };
};

/**
 * True when the URL needs an HLS/DASH-capable player rather than a plain
 * `<video src>`. Safari plays HLS natively; other browsers need hls.js or a
 * provider player, which is a frontend-renderer concern — the editor preview
 * degrades to the poster image instead.
 */
export const isStreamingUrl = (url: string): boolean =>
  /\.(m3u8|mpd)(\?|$)/i.test(url);

export const VIDEO_PROVIDER_LABELS: Record<VideoProvider, string> = {
  local: 'Media Library',
  mux: 'Mux',
  'api-video': 'api.video',
  cloudinary: 'Cloudinary',
  custom: 'Direct URL',
};
