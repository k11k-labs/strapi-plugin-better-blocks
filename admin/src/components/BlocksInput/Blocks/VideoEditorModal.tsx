import * as React from 'react';

import { useStrapiApp } from '@strapi/admin/strapi-admin';
import { Button, Flex, Modal, Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { styled } from 'styled-components';

import {
  type AspectRatio,
  type MediaAlignment,
  type VideoElement,
  type VideoPlayerSettings,
  type VideoProvider,
} from '../utils/types';

import { ASPECT_RATIOS, toCssAspectRatio } from './embedProviders';
import { type MuxAsset, muxThumbnailProxyUrl, useMuxAssets } from './muxClient';
import {
  VIDEO_PROVIDER_LABELS,
  detectVideoSource,
  isStreamingUrl,
  muxPlaybackUrl,
  muxThumbnailUrl,
} from './videoProviders';

/* ---------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------*/

const prefixFileUrlWithBackendUrl = (fileURL?: string): string => {
  if (!fileURL) return '';
  return fileURL.startsWith('/')
    ? `${window.strapi.backendURL}${fileURL}`
    : fileURL;
};

const stripExtension = (name: string): string => name.replace(/\.[^/.]+$/, '');

/** Human-readable file size. Strapi stores media size in KB (float). */
export const formatBytes = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
};

export const DEFAULT_VIDEO_PLAYER: VideoPlayerSettings = {
  autoplay: false,
  loop: false,
  muted: false,
  controls: true,
};

/* ---------------------------------------------------------------------------
 * Styled
 * -------------------------------------------------------------------------*/

const ModalContent = styled(Modal.Content)`
  max-width: 720px;
  width: 92vw;
`;

const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spaces[4]};
  padding: ${({ theme }) => theme.spaces[4]} ${({ theme }) => theme.spaces[6]}
    ${({ theme }) => theme.spaces[6]};
  max-height: 70vh;
  overflow: auto;
`;

const TextField = styled.input`
  width: 100%;
  box-sizing: border-box;
  min-height: 40px;
  padding: 0 ${({ theme }) => theme.spaces[3]};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.neutral800};
  background: ${({ theme }) => theme.colors.neutral0};
`;

const Select = styled.select`
  min-height: 40px;
  padding: 0 ${({ theme }) => theme.spaces[3]};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.neutral800};
  background: ${({ theme }) => theme.colors.neutral0};
`;

const SegmentRow = styled.div`
  display: inline-flex;
  align-self: flex-start;
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  overflow: hidden;
`;

const SegmentButton = styled.button<{ $active: boolean }>`
  min-width: 84px;
  min-height: 34px;
  padding: 0 ${({ theme }) => theme.spaces[3]};
  border: none;
  border-left: 1px solid ${({ theme }) => theme.colors.neutral200};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primary600 : theme.colors.neutral0};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.neutral0 : theme.colors.neutral700};
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  cursor: pointer;
  text-transform: capitalize;

  &:first-child {
    border-left: none;
  }

  &:hover {
    background: ${({ $active, theme }) =>
      $active ? theme.colors.primary600 : theme.colors.neutral100};
  }

  &:focus {
    outline: none;
  }
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary600};
    outline-offset: -2px;
  }
`;

const ToggleRow = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spaces[2]};
  cursor: pointer;
  user-select: none;
`;

const SourceCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral100};
  padding: ${({ theme }) => theme.spaces[3]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spaces[2]};
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spaces[2]};
  color: ${({ theme }) => theme.colors.neutral500};
  font-size: 12px;
  text-transform: uppercase;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colors.neutral200};
  }
`;

const PreviewBox = styled.div<{ $ratio: string }>`
  width: 100%;
  aspect-ratio: ${({ $ratio }) => $ratio};
  border-radius: ${({ theme }) => theme.borderRadius};
  overflow: hidden;
  background: ${({ theme }) => theme.colors.neutral800};

  video,
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
`;

const Hint = styled(Typography)`
  color: ${({ theme }) => theme.colors.neutral500};
`;

const ErrorText = styled(Typography)`
  color: ${({ theme }) => theme.colors.danger600};
`;

const MuxGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: ${({ theme }) => theme.spaces[2]};
  max-height: 260px;
  overflow: auto;
`;

const MuxItem = styled.button<{ $selected: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spaces[1]};
  padding: 0;
  text-align: left;
  border: 2px solid
    ${({ $selected, theme }) =>
      $selected ? theme.colors.primary600 : theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral0};
  overflow: hidden;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    display: block;
    background: ${({ theme }) => theme.colors.neutral800};
  }
`;

const MuxItemMeta = styled.div`
  padding: ${({ theme }) => theme.spaces[2]};
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="pi" fontWeight="bold" textColor="neutral700">
    {children}
  </Typography>
);

/* ---------------------------------------------------------------------------
 * Modal
 * -------------------------------------------------------------------------*/

export interface VideoDraft {
  provider: VideoProvider;
  assetId?: string;
  playbackId?: string;
  url: string;
  file?: VideoElement['file'];
  poster?: string;
  title?: string;
  caption?: string;
  transcript?: string;
  player: VideoPlayerSettings;
  alignment: MediaAlignment;
  aspectRatio: AspectRatio;
  customAspectRatio?: string;
}

interface VideoEditorModalProps {
  open: boolean;
  element: VideoElement;
  onSave: (draft: VideoDraft) => void;
  onRemove: () => void;
  onClose: () => void;
}

const ALIGNMENTS: MediaAlignment[] = ['left', 'center', 'right', 'none'];

/** Which Media Library dialog is currently open, if any. */
type PickerTarget = 'video' | 'poster' | 'transcript' | null;

export const VideoEditorModal = ({
  open,
  element,
  onSave,
  onRemove,
  onClose,
}: VideoEditorModalProps) => {
  const { formatMessage } = useIntl();
  const components = useStrapiApp(
    'VideoEditorModal',
    (state) => state.components
  );

  const [draft, setDraft] = React.useState<VideoDraft>({
    provider: element.provider ?? 'local',
    assetId: element.assetId,
    playbackId: element.playbackId,
    url: element.url ?? '',
    file: element.file,
    poster: element.poster,
    title: element.title,
    caption: element.caption,
    transcript: element.transcript,
    player: element.player ?? DEFAULT_VIDEO_PLAYER,
    alignment: element.alignment ?? 'center',
    aspectRatio: element.aspectRatio ?? '16:9',
    customAspectRatio: element.customAspectRatio,
  });
  const [picker, setPicker] = React.useState<PickerTarget>(null);
  const [muxOpen, setMuxOpen] = React.useState(false);
  const mux = useMuxAssets(true);

  const patch = (next: Partial<VideoDraft>) =>
    setDraft((prev) => ({ ...prev, ...next }));
  const patchPlayer = (next: Partial<VideoPlayerSettings>) =>
    setDraft((prev) => ({ ...prev, player: { ...prev.player, ...next } }));

  const MediaLibraryDialog = components?.['media-library'] as
    | React.ComponentType<{
        allowedTypes: string[];
        onClose: () => void;
        onSelectAssets: (assets: Record<string, unknown>[]) => void;
      }>
    | undefined;

  const handleSelectAssets = (assets: Record<string, unknown>[]) => {
    const asset = assets[0];
    const target = picker;
    setPicker(null);
    if (!asset) return;

    const url = prefixFileUrlWithBackendUrl(asset.url as string);

    if (target === 'poster') {
      patch({ poster: url });
      return;
    }
    if (target === 'transcript') {
      patch({ transcript: url });
      return;
    }

    const sizeKb = typeof asset.size === 'number' ? asset.size : undefined;
    const name = (asset.name as string) ?? 'video';
    setDraft((d) => ({
      ...d,
      // A Media Library asset is served by Strapi's upload provider, so the
      // block plays it directly rather than through a provider player.
      provider: 'local',
      url,
      playbackId: undefined,
      assetId: undefined,
      file: {
        id: typeof asset.id === 'number' ? asset.id : undefined,
        name,
        ext: (asset.ext as string) ?? undefined,
        mime: (asset.mime as string) ?? undefined,
        size: sizeKb !== undefined ? Math.round(sizeKb * 1024) : undefined,
        duration:
          typeof asset.duration === 'number' ? asset.duration : undefined,
        provider: (asset.provider as string) ?? undefined,
      },
      title: d.title?.trim() ? d.title : stripExtension(name),
    }));
  };

  /**
   * Re-detect the provider whenever the author types a URL or playback id, so
   * pasting a Mux id fills in the HLS URL and poster without extra steps.
   */
  const handleSourceInput = (value: string) => {
    const detected = detectVideoSource(value);
    if (!detected) {
      patch({
        url: '',
        provider: 'local',
        playbackId: undefined,
        file: undefined,
      });
      return;
    }
    setDraft((d) => ({
      ...d,
      provider: detected.provider,
      url: detected.url,
      playbackId: detected.playbackId,
      // Don't clobber a poster the author picked by hand.
      poster: d.poster ?? detected.poster,
      file: undefined,
    }));
  };

  const handleSelectMuxAsset = (asset: MuxAsset) => {
    if (!asset.playback_id) return;
    const ratio = asset.aspect_ratio as VideoDraft['aspectRatio'] | undefined;
    setDraft((d) => ({
      ...d,
      provider: 'mux',
      assetId: asset.asset_id,
      playbackId: asset.playback_id,
      url: muxPlaybackUrl(asset.playback_id as string),
      // Store the canonical Mux poster: the node is rendered on the public
      // frontend, which has no reason to route images through Strapi.
      poster: muxThumbnailUrl(asset.playback_id as string),
      file: undefined,
      title: d.title?.trim() ? d.title : asset.title,
      aspectRatio:
        ratio && ASPECT_RATIOS.includes(ratio) ? ratio : d.aspectRatio,
    }));
    setMuxOpen(false);
  };

  const hasSource = !!draft.url?.trim();
  const streaming = hasSource && isStreamingUrl(draft.url);

  const cssRatio =
    draft.aspectRatio === 'custom'
      ? draft.customAspectRatio || '16 / 9'
      : toCssAspectRatio(draft.aspectRatio);

  // The Strapi Media Library dialog is its own full-screen modal; render it in
  // place of ours while the author browses/uploads.
  if (picker && MediaLibraryDialog) {
    return (
      <MediaLibraryDialog
        allowedTypes={
          picker === 'video'
            ? ['videos']
            : picker === 'poster'
              ? ['images']
              : ['files']
        }
        onClose={() => setPicker(null)}
        onSelectAssets={handleSelectAssets}
      />
    );
  }

  return (
    <Modal.Root
      open={open}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) onClose();
      }}
    >
      <ModalContent>
        <Modal.Header>
          <Modal.Title>
            {formatMessage({
              id: 'components.Blocks.video.modal.title',
              defaultMessage: 'Video',
            })}
          </Modal.Title>
        </Modal.Header>

        <ModalBody>
          {/* Source */}
          <Flex direction="column" gap={2} alignItems="stretch">
            <FieldLabel>
              {formatMessage({
                id: 'components.Blocks.video.field.source',
                defaultMessage: 'Video source',
              })}
            </FieldLabel>
            <SourceCard>
              <Flex gap={2} alignItems="center" justifyContent="space-between">
                <Flex direction="column" gap={1} alignItems="flex-start">
                  {hasSource ? (
                    <>
                      <Typography fontWeight="bold" variant="pi">
                        {draft.file?.name || draft.playbackId || draft.url}
                      </Typography>
                      <Typography variant="pi" textColor="neutral500">
                        {VIDEO_PROVIDER_LABELS[draft.provider]}
                        {draft.file?.size
                          ? ` · ${formatBytes(draft.file.size)}`
                          : ''}
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="pi" textColor="neutral500">
                      {formatMessage({
                        id: 'components.Blocks.video.source.empty',
                        defaultMessage: 'No video selected yet.',
                      })}
                    </Typography>
                  )}
                </Flex>
                <Flex gap={2}>
                  {mux.available ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setMuxOpen((v) => !v)}
                    >
                      {formatMessage({
                        id: 'components.Blocks.video.action.browseMux',
                        defaultMessage: 'Mux',
                      })}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!MediaLibraryDialog}
                    onClick={() => setPicker('video')}
                  >
                    {formatMessage({
                      id: 'components.Blocks.video.action.browse',
                      defaultMessage: 'Media Library',
                    })}
                  </Button>
                </Flex>
              </Flex>

              {/* Mux asset picker — only rendered when the Mux Video Uploader
                  plugin is installed and configured. */}
              {muxOpen && mux.available ? (
                <Flex direction="column" gap={2} alignItems="stretch">
                  <TextField
                    type="search"
                    placeholder={formatMessage({
                      id: 'components.Blocks.video.mux.search',
                      defaultMessage: 'Search Mux assets by title…',
                    })}
                    value={mux.query}
                    onChange={(e) => mux.search(e.target.value)}
                  />
                  {mux.error ? (
                    <ErrorText variant="pi">{mux.error}</ErrorText>
                  ) : null}
                  {mux.loading ? (
                    <Hint variant="pi">
                      {formatMessage({
                        id: 'components.Blocks.video.mux.loading',
                        defaultMessage: 'Loading…',
                      })}
                    </Hint>
                  ) : mux.assets.length === 0 ? (
                    <Hint variant="pi">
                      {formatMessage({
                        id: 'components.Blocks.video.mux.empty',
                        defaultMessage: 'No Mux assets found.',
                      })}
                    </Hint>
                  ) : (
                    <MuxGrid>
                      {mux.assets.map((asset) => {
                        // Signed playback needs a short-lived JWT minted per
                        // request; a token stored in the document body would
                        // expire, so those assets can't be selected here.
                        const unusable =
                          !asset.playback_id || !asset.isReady || asset.signed;
                        return (
                          <MuxItem
                            key={asset.documentId}
                            type="button"
                            disabled={unusable}
                            $selected={draft.playbackId === asset.playback_id}
                            onClick={() => handleSelectMuxAsset(asset)}
                          >
                            {asset.playback_id ? (
                              <img
                                src={muxThumbnailProxyUrl(asset.playback_id)}
                                alt=""
                                loading="lazy"
                              />
                            ) : null}
                            <MuxItemMeta>
                              <Typography variant="pi" fontWeight="bold">
                                {asset.title}
                              </Typography>
                              <Typography variant="pi" textColor="neutral500">
                                {asset.signed
                                  ? formatMessage({
                                      id: 'components.Blocks.video.mux.signed',
                                      defaultMessage:
                                        'Signed playback — not supported',
                                    })
                                  : !asset.isReady
                                    ? formatMessage({
                                        id: 'components.Blocks.video.mux.notReady',
                                        defaultMessage: 'Still processing',
                                      })
                                    : asset.aspect_ratio || ''}
                              </Typography>
                            </MuxItemMeta>
                          </MuxItem>
                        );
                      })}
                    </MuxGrid>
                  )}
                </Flex>
              ) : null}

              <Divider>
                {formatMessage({
                  id: 'components.Blocks.video.source.or',
                  defaultMessage: 'or',
                })}
              </Divider>

              <TextField
                type="text"
                placeholder="https://stream.mux.com/…m3u8, a Mux playback ID, or https://example.com/video.mp4"
                value={draft.file?.id ? '' : (draft.url ?? '')}
                onChange={(e) => handleSourceInput(e.target.value)}
              />
              <Hint variant="pi">
                {formatMessage({
                  id: 'components.Blocks.video.hint.source',
                  defaultMessage:
                    'Mux, api.video and Cloudinary URLs are detected automatically. A bare Mux playback ID fills in the stream URL and poster for you. For YouTube or Vimeo, use the Embed block instead.',
                })}
              </Hint>
            </SourceCard>
          </Flex>

          {/* Preview */}
          {hasSource ? (
            <Flex direction="column" gap={2} alignItems="stretch">
              <FieldLabel>
                {formatMessage({
                  id: 'components.Blocks.video.field.preview',
                  defaultMessage: 'Preview',
                })}
              </FieldLabel>
              <PreviewBox $ratio={cssRatio}>
                {streaming ? (
                  draft.poster ? (
                    <img
                      src={draft.poster}
                      alt={formatMessage({
                        id: 'components.Blocks.video.preview.posterAlt',
                        defaultMessage: 'Video poster',
                      })}
                    />
                  ) : null
                ) : (
                  <video
                    key={draft.url}
                    src={draft.url}
                    poster={draft.poster}
                    controls
                    preload="metadata"
                  />
                )}
              </PreviewBox>
              {streaming ? (
                <Hint variant="pi">
                  {formatMessage({
                    id: 'components.Blocks.video.hint.streaming',
                    defaultMessage:
                      'HLS/DASH streams need a streaming-capable player, so the editor shows the poster frame instead. Playback works on the frontend via the provider player.',
                  })}
                </Hint>
              ) : null}
            </Flex>
          ) : null}

          {/* Poster */}
          <Flex direction="column" gap={2} alignItems="stretch">
            <FieldLabel>
              {formatMessage({
                id: 'components.Blocks.video.field.poster',
                defaultMessage: 'Poster image (optional)',
              })}
            </FieldLabel>
            <Flex gap={2} alignItems="center">
              <TextField
                type="url"
                placeholder="https://…/thumbnail.jpg"
                value={draft.poster ?? ''}
                onChange={(e) => patch({ poster: e.target.value })}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={!MediaLibraryDialog}
                onClick={() => setPicker('poster')}
              >
                {formatMessage({
                  id: 'components.Blocks.video.action.browsePoster',
                  defaultMessage: 'Browse',
                })}
              </Button>
            </Flex>
          </Flex>

          {/* Title */}
          <Flex direction="column" gap={2} alignItems="stretch">
            <FieldLabel>
              {formatMessage({
                id: 'components.Blocks.video.field.title',
                defaultMessage: 'Title (optional)',
              })}
            </FieldLabel>
            <TextField
              type="text"
              value={draft.title ?? ''}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </Flex>

          {/* Caption */}
          <Flex direction="column" gap={2} alignItems="stretch">
            <FieldLabel>
              {formatMessage({
                id: 'components.Blocks.video.field.caption',
                defaultMessage: 'Caption (optional)',
              })}
            </FieldLabel>
            <TextField
              type="text"
              value={draft.caption ?? ''}
              onChange={(e) => patch({ caption: e.target.value })}
            />
          </Flex>

          {/* Player settings */}
          <Flex direction="column" gap={2} alignItems="stretch">
            <FieldLabel>
              {formatMessage({
                id: 'components.Blocks.video.field.player',
                defaultMessage: 'Player settings',
              })}
            </FieldLabel>
            <Flex gap={4} wrap="wrap">
              <ToggleRow>
                <input
                  type="checkbox"
                  checked={draft.player.controls}
                  onChange={(e) => patchPlayer({ controls: e.target.checked })}
                />
                <Typography variant="pi">
                  {formatMessage({
                    id: 'components.Blocks.video.player.controls',
                    defaultMessage: 'Show controls',
                  })}
                </Typography>
              </ToggleRow>
              <ToggleRow>
                <input
                  type="checkbox"
                  checked={draft.player.autoplay}
                  onChange={(e) =>
                    // Browsers block autoplay with sound, so opting into
                    // autoplay implies muted unless the author says otherwise.
                    patchPlayer({
                      autoplay: e.target.checked,
                      ...(e.target.checked ? { muted: true } : {}),
                    })
                  }
                />
                <Typography variant="pi">
                  {formatMessage({
                    id: 'components.Blocks.video.player.autoplay',
                    defaultMessage: 'Autoplay',
                  })}
                </Typography>
              </ToggleRow>
              <ToggleRow>
                <input
                  type="checkbox"
                  checked={draft.player.muted}
                  onChange={(e) => patchPlayer({ muted: e.target.checked })}
                />
                <Typography variant="pi">
                  {formatMessage({
                    id: 'components.Blocks.video.player.muted',
                    defaultMessage: 'Muted',
                  })}
                </Typography>
              </ToggleRow>
              <ToggleRow>
                <input
                  type="checkbox"
                  checked={draft.player.loop}
                  onChange={(e) => patchPlayer({ loop: e.target.checked })}
                />
                <Typography variant="pi">
                  {formatMessage({
                    id: 'components.Blocks.video.player.loop',
                    defaultMessage: 'Loop',
                  })}
                </Typography>
              </ToggleRow>
            </Flex>
            {draft.player.autoplay && !draft.player.muted ? (
              <Hint variant="pi">
                {formatMessage({
                  id: 'components.Blocks.video.player.autoplayWarning',
                  defaultMessage:
                    'Most browsers block autoplay unless the video is muted.',
                })}
              </Hint>
            ) : null}
          </Flex>

          {/* Aspect ratio */}
          <Flex direction="column" gap={2} alignItems="stretch">
            <FieldLabel>
              {formatMessage({
                id: 'components.Blocks.video.field.aspectRatio',
                defaultMessage: 'Aspect ratio',
              })}
            </FieldLabel>
            <Flex gap={2} alignItems="center" wrap="wrap">
              <Select
                value={draft.aspectRatio}
                onChange={(e) =>
                  patch({ aspectRatio: e.target.value as AspectRatio })
                }
              >
                {ASPECT_RATIOS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                <option value="custom">
                  {formatMessage({
                    id: 'components.Blocks.embed.aspectRatio.custom',
                    defaultMessage: 'Custom',
                  })}
                </option>
              </Select>
              {draft.aspectRatio === 'custom' ? (
                <TextField
                  type="text"
                  style={{ maxWidth: 160 }}
                  placeholder="3 / 2"
                  value={draft.customAspectRatio ?? ''}
                  onChange={(e) => patch({ customAspectRatio: e.target.value })}
                />
              ) : null}
            </Flex>
          </Flex>

          {/* Alignment */}
          <Flex direction="column" gap={2} alignItems="stretch">
            <FieldLabel>
              {formatMessage({
                id: 'components.Blocks.video.field.alignment',
                defaultMessage: 'Alignment',
              })}
            </FieldLabel>
            <SegmentRow>
              {ALIGNMENTS.map((a) => (
                <SegmentButton
                  key={a}
                  type="button"
                  $active={draft.alignment === a}
                  onClick={() => patch({ alignment: a })}
                >
                  {a}
                </SegmentButton>
              ))}
            </SegmentRow>
          </Flex>

          {/* Accessibility */}
          <Flex direction="column" gap={2} alignItems="stretch">
            <FieldLabel>
              {formatMessage({
                id: 'components.Blocks.video.field.transcript',
                defaultMessage: 'Captions / transcript (WebVTT, optional)',
              })}
            </FieldLabel>
            <Flex gap={2} alignItems="center">
              <TextField
                type="url"
                placeholder="https://…/captions.vtt"
                value={draft.transcript ?? ''}
                onChange={(e) => patch({ transcript: e.target.value })}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={!MediaLibraryDialog}
                onClick={() => setPicker('transcript')}
              >
                {formatMessage({
                  id: 'components.Blocks.video.action.browseTranscript',
                  defaultMessage: 'Browse',
                })}
              </Button>
            </Flex>
          </Flex>
        </ModalBody>

        <Modal.Footer>
          <Button variant="danger-light" type="button" onClick={onRemove}>
            {formatMessage({
              id: 'components.Blocks.popover.remove',
              defaultMessage: 'Remove',
            })}
          </Button>
          <Flex gap={2} marginLeft="auto">
            <Button variant="tertiary" type="button" onClick={onClose}>
              {formatMessage({ id: 'global.cancel', defaultMessage: 'Cancel' })}
            </Button>
            <Button
              type="button"
              disabled={!hasSource}
              onClick={() => onSave(draft)}
            >
              {formatMessage({ id: 'global.save', defaultMessage: 'Save' })}
            </Button>
          </Flex>
        </Modal.Footer>
      </ModalContent>
    </Modal.Root>
  );
};

export default VideoEditorModal;
