import * as React from 'react';

import { useFetchClient } from '@strapi/admin/strapi-admin';

/* ---------------------------------------------------------------------------
 * Mux Video Uploader integration
 *
 * Talks to `strapi-plugin-mux-video-uploader` (muxinc/strapi-plugin-mux-video-uploader)
 * over its admin HTTP routes. That plugin exposes no reusable admin components,
 * so HTTP is the only integration surface.
 *
 * Everything here degrades to "unavailable" when the plugin isn't installed —
 * the video block stays fully usable without it.
 * -------------------------------------------------------------------------*/

export const MUX_PLUGIN_ID = 'mux-video-uploader';

/** Subset of `plugin::mux-video-uploader.mux-asset` this block consumes. */
export interface MuxAsset {
  documentId: string;
  title: string;
  asset_id?: string;
  playback_id?: string;
  /** True when the asset uses a signed playback policy. */
  signed: boolean;
  isReady: boolean;
  duration?: number;
  /** Mux reports this as e.g. "16:9". */
  aspect_ratio?: string;
}

/**
 * Thumbnails go through the plugin's own proxy rather than image.mux.com
 * directly: the route is unauthenticated and exists precisely because the
 * Strapi admin CSP blocks the Mux image host.
 */
export const muxThumbnailProxyUrl = (playbackId: string): string =>
  `${window.strapi.backendURL}/${MUX_PLUGIN_ID}/thumbnail/${playbackId}`;

interface MuxAssetListResponse {
  items: MuxAsset[];
  totalCount: number;
}

const PAGE_SIZE = 12;

export interface UseMuxAssetsResult {
  /** null while still probing for the plugin. */
  available: boolean | null;
  assets: MuxAsset[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  search: (query: string) => void;
  query: string;
}

/**
 * List Mux assets, with title search. Returns `available: false` when the Mux
 * plugin isn't installed or can't be queried, so callers can hide their UI.
 *
 * Availability is decided by the asset-list call itself rather than the
 * plugin's `mux-settings` route: that route reports "configured" only when a
 * *webhook signing secret* is also set, which listing assets does not need — so
 * it answers false for perfectly usable installs.
 */
export const useMuxAssets = (enabled: boolean): UseMuxAssetsResult => {
  const { get } = useFetchClient();

  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [assets, setAssets] = React.useState<MuxAsset[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const timer = setTimeout(
      async () => {
        setLoading(true);
        setError(null);
        try {
          const params = new URLSearchParams({
            start: '0',
            limit: String(PAGE_SIZE),
            sort: 'createdAt',
            order: 'desc',
          });
          if (query.trim()) {
            params.set('filters[title][$containsi]', query.trim());
          }
          const { data } = await get<MuxAssetListResponse>(
            `/${MUX_PLUGIN_ID}/mux-asset?${params.toString()}`
          );
          if (cancelled) return;
          setAssets(data?.items ?? []);
          setTotalCount(data?.totalCount ?? 0);
          setAvailable(true);
        } catch {
          if (cancelled) return;
          // A failure here means the plugin is absent or unreachable; either
          // way there's nothing to pick, so the whole Mux UI stays hidden.
          setAvailable(false);
          setError('Could not load Mux assets.');
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      // Debounce so typing in the search box doesn't spam the API.
      query ? 300 : 0
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, query, get]);

  return {
    available,
    assets,
    totalCount,
    loading,
    error,
    search: setQuery,
    query,
  };
};
