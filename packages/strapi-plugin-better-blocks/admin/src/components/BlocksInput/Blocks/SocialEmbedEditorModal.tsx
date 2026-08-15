import * as React from 'react';

import { useFetchClient } from '@strapi/admin/strapi-admin';
import { Button, Flex, Loader, Modal, Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { styled } from 'styled-components';

import {
  type SocialAlignment,
  type SocialEmbedElement,
  type SocialOEmbed,
  type SocialPlatform,
} from '../utils/types';

/* ---------------------------------------------------------------------------
 * Platform metadata (shared with the in-editor preview)
 * -------------------------------------------------------------------------*/

export interface PlatformMeta {
  label: string;
  icon: string;
  color: string;
}

export const PLATFORM_META: Record<SocialPlatform, PlatformMeta> = {
  twitter: { label: 'X / Twitter', icon: '𝕏', color: '#000000' },
  instagram: { label: 'Instagram', icon: '📸', color: '#E1306C' },
  facebook: { label: 'Facebook', icon: '👍', color: '#1877F2' },
  tiktok: { label: 'TikTok', icon: '🎵', color: '#010101' },
  linkedin: { label: 'LinkedIn', icon: '💼', color: '#0A66C2' },
  pinterest: { label: 'Pinterest', icon: '📌', color: '#E60023' },
};

export const ALL_PLATFORMS: SocialPlatform[] = [
  'twitter',
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'pinterest',
];

/** Detect the platform from a pasted URL (mirrors the server-side detection). */
export const detectPlatform = (url: string): SocialPlatform | null => {
  if (/(?:twitter\.com|x\.com)\/[^/]+\/status/i.test(url)) return 'twitter';
  if (/instagram\.com\/(?:p|reel|tv)\//i.test(url)) return 'instagram';
  if (/tiktok\.com\/@[^/]+\/video\//i.test(url)) return 'tiktok';
  if (/facebook\.com\//i.test(url)) return 'facebook';
  if (/linkedin\.com\//i.test(url)) return 'linkedin';
  if (/(?:pinterest\.[a-z.]+|pin\.it)\//i.test(url)) return 'pinterest';
  return null;
};

/**
 * Widget scripts pasted along with an embed snippet are inert once injected via
 * `innerHTML`, and their leftover tags make renderers think the widget is
 * already loaded. Renderers load those scripts themselves, so keep markup only.
 */
export const stripScripts = (html: string): string =>
  html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').trim();

/**
 * Pull the canonical post URL out of a pasted embed snippet, so an embed-code-only
 * embed still carries a link for fallbacks and analytics. Covers Instagram's
 * `data-instgrm-permalink`, blockquote `cite`, and iframe `src`.
 */
export const extractUrlFromEmbedCode = (code: string): string | null => {
  // `dropQuery` is set for permalinks, whose query string is only tracking
  // params — an iframe `src` needs its query to stay intact.
  const patterns: Array<{ re: RegExp; dropQuery?: boolean }> = [
    { re: /data-instgrm-permalink=["']([^"']+)["']/i, dropQuery: true },
    { re: /\bcite=["'](https?:\/\/[^"']+)["']/i, dropQuery: true },
    { re: /<iframe[^>]+src=["'](https?:\/\/[^"']+)["']/i },
    { re: /<a[^>]+href=["'](https?:\/\/[^"']+)["']/i, dropQuery: true },
  ];
  for (const { re, dropQuery } of patterns) {
    const match = code.match(re);
    if (!match) continue;
    const url = match[1].replace(/&amp;/g, '&');
    return dropQuery ? url.split('?')[0] : url;
  }
  return null;
};

/* ---------------------------------------------------------------------------
 * Styled
 * -------------------------------------------------------------------------*/

const ModalContent = styled(Modal.Content)`
  max-width: 760px;
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

const PlatformGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: ${({ theme }) => theme.spaces[2]};
`;

const PlatformChip = styled.button<{ $active: boolean; $color: string }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: ${({ theme }) => theme.spaces[2]};
  border-radius: ${({ theme }) => theme.borderRadius};
  border: 2px solid
    ${({ $active, $color, theme }) =>
      $active ? $color : theme.colors.neutral200};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.neutral100 : theme.colors.neutral0};
  cursor: pointer;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.neutral800};

  &:hover {
    border-color: ${({ $color }) => $color};
  }
`;

const ChipIcon = styled.span`
  font-size: 22px;
  line-height: 1;
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

const TextArea = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  min-height: 80px;
  padding: ${({ theme }) => theme.spaces[2]} ${({ theme }) => theme.spaces[3]};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  font-size: 13px;
  font-family: monospace;
  color: ${({ theme }) => theme.colors.neutral800};
  background: ${({ theme }) => theme.colors.neutral0};
  resize: vertical;
`;

const AlignRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spaces[2]};
`;

const AlignButton = styled.button<{ $active: boolean }>`
  flex: 1;
  min-height: 36px;
  border-radius: ${({ theme }) => theme.borderRadius};
  border: 1px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.primary600 : theme.colors.neutral200};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.primary100 : theme.colors.neutral0};
  color: ${({ theme }) => theme.colors.neutral800};
  cursor: pointer;
  text-transform: capitalize;
`;

const PreviewCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral100};
  padding: ${({ theme }) => theme.spaces[3]};
  display: flex;
  gap: ${({ theme }) => theme.spaces[3]};
  align-items: center;
`;

const PreviewThumb = styled.img`
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: ${({ theme }) => theme.borderRadius};
  flex: 0 0 auto;
`;

const ErrorText = styled.div`
  color: ${({ theme }) => theme.colors.danger600};
  font-size: 13px;
`;

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="pi" fontWeight="bold" textColor="neutral700">
    {children}
  </Typography>
);

/* ---------------------------------------------------------------------------
 * Modal
 * -------------------------------------------------------------------------*/

interface OEmbedResponse extends SocialOEmbed {
  platform: SocialPlatform;
  url: string;
}

export interface SocialEmbedDraft {
  platform: SocialPlatform;
  url: string;
  embedCode?: string;
  oembed?: SocialOEmbed;
  alignment: SocialAlignment;
  caption?: string;
}

interface SocialEmbedEditorModalProps {
  open: boolean;
  element: SocialEmbedElement;
  enabledPlatforms?: SocialPlatform[];
  onSave: (patch: SocialEmbedDraft) => void;
  onRemove: () => void;
  onClose: () => void;
}

const ALIGNMENTS: SocialAlignment[] = ['left', 'center', 'right'];

export const SocialEmbedEditorModal = ({
  open,
  element,
  enabledPlatforms,
  onSave,
  onRemove,
  onClose,
}: SocialEmbedEditorModalProps) => {
  const { formatMessage } = useIntl();
  const { get } = useFetchClient();

  const platforms =
    enabledPlatforms && enabledPlatforms.length > 0
      ? enabledPlatforms
      : ALL_PLATFORMS;

  const [draft, setDraft] = React.useState<SocialEmbedDraft>({
    platform: element.platform ?? platforms[0],
    url: element.url ?? '',
    embedCode: element.embedCode,
    oembed: element.oembed,
    alignment: element.alignment ?? 'center',
    caption: element.caption,
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const patch = (next: Partial<SocialEmbedDraft>) =>
    setDraft((prev) => ({ ...prev, ...next }));

  const handleUrlChange = (url: string) => {
    const detected = detectPlatform(url);
    // Re-detecting clears a stale fetched payload for the previous URL.
    patch({
      url,
      oembed: undefined,
      ...(detected ? { platform: detected } : {}),
    });
    setError(null);
  };

  const handleEmbedCodeChange = (raw: string) => {
    const embedCode = raw.trim() === '' ? '' : raw;
    // An embed snippet alone is enough to render a post, but recovering the
    // permalink from it keeps the node linkable when the widget can't load.
    if (embedCode && !draft.url.trim()) {
      const found = extractUrlFromEmbedCode(embedCode);
      const detected = found ? detectPlatform(found) : null;
      patch({
        embedCode,
        ...(found ? { url: found } : {}),
        ...(detected ? { platform: detected } : {}),
      });
      return;
    }
    patch({ embedCode });
  };

  const handleFetch = async () => {
    if (!draft.url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await get(
        `/better-blocks/oembed?url=${encodeURIComponent(
          draft.url.trim()
        )}&platform=${draft.platform}`
      );
      const data = res.data as OEmbedResponse;
      patch({
        oembed: {
          html: data.html ?? undefined,
          title: data.title,
          author: data.author,
          authorUrl: data.authorUrl,
          thumbnailUrl: data.thumbnailUrl,
          providerName: data.providerName,
          width: data.width,
          height: data.height,
        },
      });
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to fetch embed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const oembed = draft.oembed;
  const meta = PLATFORM_META[draft.platform];
  // Either source renders a post: a URL we can fetch/link, or a pasted snippet.
  const canSave = Boolean(draft.url.trim() || draft.embedCode?.trim());

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
              id: 'components.Blocks.social.modal.title',
              defaultMessage: 'Social media embed',
            })}
          </Modal.Title>
        </Modal.Header>
        <ModalBody>
          {/* Platform picker */}
          <Flex direction="column" gap={2} alignItems="stretch">
            <FieldLabel>
              {formatMessage({
                id: 'components.Blocks.social.field.platform',
                defaultMessage: 'Platform',
              })}
            </FieldLabel>
            <PlatformGrid>
              {platforms.map((p) => (
                <PlatformChip
                  key={p}
                  type="button"
                  $active={draft.platform === p}
                  $color={PLATFORM_META[p].color}
                  onClick={() => patch({ platform: p })}
                >
                  <ChipIcon>{PLATFORM_META[p].icon}</ChipIcon>
                  {PLATFORM_META[p].label}
                </PlatformChip>
              ))}
            </PlatformGrid>
          </Flex>

          {/* URL + fetch */}
          <Flex direction="column" gap={2} alignItems="stretch">
            <FieldLabel>
              {formatMessage({
                id: 'components.Blocks.social.field.url',
                defaultMessage: 'Post URL',
              })}
            </FieldLabel>
            <Flex gap={2} alignItems="stretch">
              <TextField
                type="url"
                placeholder="https://x.com/user/status/123…"
                value={draft.url}
                onChange={(e) => handleUrlChange(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleFetch}
                disabled={!draft.url.trim() || loading}
              >
                {loading ? (
                  <Loader small>…</Loader>
                ) : (
                  formatMessage({
                    id: 'components.Blocks.social.action.fetch',
                    defaultMessage: 'Fetch preview',
                  })
                )}
              </Button>
            </Flex>
            {error ? <ErrorText>{error}</ErrorText> : null}
          </Flex>

          {/* Preview */}
          {oembed && (oembed.thumbnailUrl || oembed.author || oembed.title) ? (
            <PreviewCard>
              {oembed.thumbnailUrl ? (
                <PreviewThumb src={oembed.thumbnailUrl} alt="" />
              ) : null}
              <Flex direction="column" gap={1} alignItems="flex-start">
                <Typography variant="sigma" textColor="neutral600">
                  {meta.icon} {oembed.providerName || meta.label}
                </Typography>
                {oembed.author ? (
                  <Typography fontWeight="bold">{oembed.author}</Typography>
                ) : null}
                {oembed.title ? (
                  <Typography variant="pi" textColor="neutral700">
                    {oembed.title}
                  </Typography>
                ) : null}
              </Flex>
            </PreviewCard>
          ) : null}

          {/* Caption */}
          <Flex direction="column" gap={2} alignItems="stretch">
            <FieldLabel>
              {formatMessage({
                id: 'components.Blocks.social.field.caption',
                defaultMessage: 'Caption (optional)',
              })}
            </FieldLabel>
            <TextField
              type="text"
              value={draft.caption ?? ''}
              onChange={(e) => patch({ caption: e.target.value })}
            />
          </Flex>

          {/* Alignment */}
          <Flex direction="column" gap={2} alignItems="stretch">
            <FieldLabel>
              {formatMessage({
                id: 'components.Blocks.social.field.alignment',
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

          {/* Manual embed-code override */}
          <Flex direction="column" gap={2} alignItems="stretch">
            <FieldLabel>
              {formatMessage({
                id: 'components.Blocks.social.field.embedCode',
                defaultMessage: 'Embed code override (optional)',
              })}
            </FieldLabel>
            <TextArea
              placeholder="<blockquote …>…</blockquote>"
              value={draft.embedCode ?? ''}
              onChange={(e) => handleEmbedCodeChange(e.target.value)}
            />
            <Typography variant="pi" textColor="neutral600">
              {formatMessage({
                id: 'components.Blocks.social.field.embedCode.hint',
                defaultMessage:
                  'Pasting an embed code is enough on its own — the post URL is optional.',
              })}
            </Typography>
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
              disabled={!canSave}
              onClick={() =>
                onSave({
                  ...draft,
                  url: draft.url.trim(),
                  embedCode: draft.embedCode
                    ? stripScripts(draft.embedCode) || undefined
                    : undefined,
                })
              }
            >
              {formatMessage({ id: 'global.save', defaultMessage: 'Save' })}
            </Button>
          </Flex>
        </Modal.Footer>
      </ModalContent>
    </Modal.Root>
  );
};

export default SocialEmbedEditorModal;
