import * as React from 'react';

import { useStrapiApp } from '@strapi/admin/strapi-admin';
import { Button, Flex, Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { styled } from 'styled-components';

import {
  type AudioAlignment,
  type AudioElement,
  type AudioPreload,
  type AudioPlayerSettings,
} from '../utils/types';

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

export const DEFAULT_PLAYER: AudioPlayerSettings = {
  autoplay: false,
  loop: false,
  controls: true,
  preload: 'metadata',
};

/* ---------------------------------------------------------------------------
 * Styled
 * -------------------------------------------------------------------------*/

const ModalContent = styled.div`
  max-width: 640px;
  width: 90vw;
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

// A connected segmented control — deliberately styled as a single grouped
// toggle (not four bordered pills) so it doesn't read as a row of text inputs.
const AlignRow = styled.div`
  display: inline-flex;
  align-self: flex-start;
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  overflow: hidden;
`;

const AlignButton = styled.button<{ $active: boolean }>`
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

  /* Keep keyboard focus visible without the input-like ring a plain :focus
     draws around each segment. */
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

const PreviewAudio = styled.audio`
  width: 100%;
`;

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="pi" fontWeight="bold" textColor="neutral700">
    {children}
  </Typography>
);

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 6vh;
  background: rgba(0, 0, 0, 0.4);
`;

const Panel = styled.div`
  background: ${({ theme }) => theme.colors.neutral0};
  border-radius: ${({ theme }) => theme.borderRadius};
  box-shadow: ${({ theme }) => theme.shadows.popupShadow};
  overflow: hidden;
`;

const PanelHeader = styled.div`
  padding: ${({ theme }) => theme.spaces[4]} ${({ theme }) => theme.spaces[6]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral150};
`;

const PanelFooter = styled.div`
  display: flex;
  padding: ${({ theme }) => theme.spaces[4]} ${({ theme }) => theme.spaces[6]};
  border-top: 1px solid ${({ theme }) => theme.colors.neutral150};
`;

/* ---------------------------------------------------------------------------
 * Modal
 * -------------------------------------------------------------------------*/

export interface AudioDraft {
  file: AudioElement['file'];
  title?: string;
  caption?: string;
  player: AudioPlayerSettings;
  alignment: AudioAlignment;
}

interface AudioEditorModalProps {
  open: boolean;
  element: AudioElement;
  onSave: (draft: AudioDraft) => void;
  onRemove: () => void;
  onClose: () => void;
}

const ALIGNMENTS: AudioAlignment[] = ['left', 'center', 'right', 'none'];
const PRELOADS: AudioPreload[] = ['none', 'metadata', 'auto'];

export const AudioEditorModal = ({
  open,
  element,
  onSave,
  onRemove,
  onClose,
}: AudioEditorModalProps) => {
  const { formatMessage } = useIntl();
  const components = useStrapiApp(
    'AudioEditorModal',
    (state) => state.components
  );

  const [draft, setDraft] = React.useState<AudioDraft>({
    file: element.file ?? { url: '' },
    title: element.title,
    caption: element.caption,
    player: element.player ?? DEFAULT_PLAYER,
    alignment: element.alignment ?? 'center',
  });
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const patch = (next: Partial<AudioDraft>) =>
    setDraft((prev) => ({ ...prev, ...next }));
  const patchPlayer = (next: Partial<AudioPlayerSettings>) =>
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
    if (asset) {
      const sizeKb = typeof asset.size === 'number' ? asset.size : undefined;
      const name = (asset.name as string) ?? 'audio';
      setDraft((d) => ({
        ...d,
        file: {
          id: typeof asset.id === 'number' ? asset.id : undefined,
          url: prefixFileUrlWithBackendUrl(asset.url as string),
          name,
          ext: (asset.ext as string) ?? undefined,
          hash: (asset.hash as string) ?? undefined,
          mime: (asset.mime as string) ?? undefined,
          size: sizeKb !== undefined ? Math.round(sizeKb * 1024) : undefined,
          provider: (asset.provider as string) ?? undefined,
        },
        title: d.title?.trim() ? d.title : stripExtension(name),
      }));
    }
    setPickerOpen(false);
  };

  const hasSource = !!draft.file?.url?.trim();

  if (!open) return null;

  // The Strapi Media Library dialog is its own full-screen modal; render it
  // in place of ours while the author browses/uploads.
  if (pickerOpen && MediaLibraryDialog) {
    return (
      <MediaLibraryDialog
        allowedTypes={['audios']}
        onClose={() => setPickerOpen(false)}
        onSelectAssets={handleSelectAssets}
      />
    );
  }

  return (
    <Overlay
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <ModalContent onMouseDown={(e) => e.stopPropagation()}>
        <Panel>
          <PanelHeader>
            <Typography variant="beta">
              {formatMessage({
                id: 'components.Blocks.audio.modal.title',
                defaultMessage: 'Audio',
              })}
            </Typography>
          </PanelHeader>

          <ModalBody>
            {/* Source: Media Library + URL */}
            <Flex direction="column" gap={2} alignItems="stretch">
              <FieldLabel>
                {formatMessage({
                  id: 'components.Blocks.audio.field.source',
                  defaultMessage: 'Audio source',
                })}
              </FieldLabel>
              <SourceCard>
                <Flex
                  gap={2}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Flex direction="column" gap={1} alignItems="flex-start">
                    {hasSource ? (
                      <>
                        <Typography fontWeight="bold" variant="pi">
                          {draft.file.name || draft.file.url}
                        </Typography>
                        {draft.file.size ? (
                          <Typography variant="pi" textColor="neutral500">
                            {formatBytes(draft.file.size)}
                            {draft.file.mime ? ` · ${draft.file.mime}` : ''}
                          </Typography>
                        ) : null}
                      </>
                    ) : (
                      <Typography variant="pi" textColor="neutral500">
                        {formatMessage({
                          id: 'components.Blocks.audio.source.empty',
                          defaultMessage: 'No audio selected yet.',
                        })}
                      </Typography>
                    )}
                  </Flex>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!MediaLibraryDialog}
                    onClick={() => setPickerOpen(true)}
                  >
                    {formatMessage({
                      id: 'components.Blocks.audio.action.browse',
                      defaultMessage: 'Media Library',
                    })}
                  </Button>
                </Flex>

                <Divider>
                  {formatMessage({
                    id: 'components.Blocks.audio.source.or',
                    defaultMessage: 'or',
                  })}
                </Divider>

                <TextField
                  type="url"
                  placeholder="https://example.com/episode.mp3"
                  value={draft.file?.id ? '' : (draft.file?.url ?? '')}
                  onChange={(e) =>
                    patch({
                      file: {
                        url: e.target.value,
                      },
                    })
                  }
                />
              </SourceCard>
            </Flex>

            {/* Live preview */}
            {hasSource ? (
              <Flex direction="column" gap={2} alignItems="stretch">
                <FieldLabel>
                  {formatMessage({
                    id: 'components.Blocks.audio.field.preview',
                    defaultMessage: 'Preview',
                  })}
                </FieldLabel>
                <PreviewAudio
                  key={draft.file.url}
                  src={draft.file.url}
                  controls
                  preload="metadata"
                />
              </Flex>
            ) : null}

            {/* Title */}
            <Flex direction="column" gap={2} alignItems="stretch">
              <FieldLabel>
                {formatMessage({
                  id: 'components.Blocks.audio.field.title',
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
                  id: 'components.Blocks.audio.field.caption',
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
                  id: 'components.Blocks.audio.field.player',
                  defaultMessage: 'Player settings',
                })}
              </FieldLabel>
              <Flex gap={4} wrap="wrap">
                <ToggleRow>
                  <input
                    type="checkbox"
                    checked={draft.player.controls}
                    onChange={(e) =>
                      patchPlayer({ controls: e.target.checked })
                    }
                  />
                  <Typography variant="pi">
                    {formatMessage({
                      id: 'components.Blocks.audio.player.controls',
                      defaultMessage: 'Show controls',
                    })}
                  </Typography>
                </ToggleRow>
                <ToggleRow>
                  <input
                    type="checkbox"
                    checked={draft.player.autoplay}
                    onChange={(e) =>
                      patchPlayer({ autoplay: e.target.checked })
                    }
                  />
                  <Typography variant="pi">
                    {formatMessage({
                      id: 'components.Blocks.audio.player.autoplay',
                      defaultMessage: 'Autoplay',
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
                      id: 'components.Blocks.audio.player.loop',
                      defaultMessage: 'Loop',
                    })}
                  </Typography>
                </ToggleRow>
              </Flex>
              <Flex direction="column" gap={1} alignItems="flex-start">
                <Typography variant="pi" textColor="neutral600">
                  {formatMessage({
                    id: 'components.Blocks.audio.player.preload',
                    defaultMessage: 'Preload',
                  })}
                </Typography>
                <Select
                  value={draft.player.preload}
                  onChange={(e) =>
                    patchPlayer({ preload: e.target.value as AudioPreload })
                  }
                >
                  {PRELOADS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Flex>
            </Flex>

            {/* Alignment */}
            <Flex direction="column" gap={2} alignItems="stretch">
              <FieldLabel>
                {formatMessage({
                  id: 'components.Blocks.audio.field.alignment',
                  defaultMessage: 'Alignment',
                })}
              </FieldLabel>
              <AlignRow>
                {ALIGNMENTS.map((a) => (
                  <AlignButton
                    key={a}
                    type="button"
                    $active={draft.alignment === a}
                    onClick={() => patch({ alignment: a })}
                  >
                    {a}
                  </AlignButton>
                ))}
              </AlignRow>
            </Flex>
          </ModalBody>

          <PanelFooter>
            <Button variant="danger-light" type="button" onClick={onRemove}>
              {formatMessage({
                id: 'components.Blocks.popover.remove',
                defaultMessage: 'Remove',
              })}
            </Button>
            <Flex gap={2} marginLeft="auto">
              <Button variant="tertiary" type="button" onClick={onClose}>
                {formatMessage({
                  id: 'global.cancel',
                  defaultMessage: 'Cancel',
                })}
              </Button>
              <Button
                type="button"
                disabled={!hasSource}
                onClick={() => onSave(draft)}
              >
                {formatMessage({ id: 'global.save', defaultMessage: 'Save' })}
              </Button>
            </Flex>
          </PanelFooter>
        </Panel>
      </ModalContent>
    </Overlay>
  );
};

export default AudioEditorModal;
