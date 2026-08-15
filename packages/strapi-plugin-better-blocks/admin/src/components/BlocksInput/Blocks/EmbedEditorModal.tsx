import * as React from 'react';

import { Button, Flex, Modal, Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { styled } from 'styled-components';

import {
  type AspectRatio,
  type EmbedElement,
  type EmbedProvider,
  type MediaAlignment,
} from '../utils/types';

import {
  ASPECT_RATIOS,
  buildUrlEmbed,
  detectProvider,
  getProviderLabel,
  getThumbnail,
  inferAspectRatio,
  isEmbeddableUrl,
  sanitizeIframe,
  toCssAspectRatio,
} from './embedProviders';

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

const CodeArea = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  min-height: 120px;
  padding: ${({ theme }) => theme.spaces[3]};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  font-family: monospace;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
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

// A connected segmented control, matching the Audio block's alignment picker.
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

const TabRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spaces[4]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral200};
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: ${({ theme }) => theme.spaces[2]} 0;
  border: none;
  border-bottom: 2px solid
    ${({ $active, theme }) =>
      $active ? theme.colors.primary600 : 'transparent'};
  background: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.primary600 : theme.colors.neutral600};
`;

const PreviewFrameWrapper = styled.div<{ $ratio: string }>`
  width: 100%;
  aspect-ratio: ${({ $ratio }) => $ratio};
  border-radius: ${({ theme }) => theme.borderRadius};
  overflow: hidden;
  background: ${({ theme }) => theme.colors.neutral800};

  iframe {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
  }
`;

const Hint = styled(Typography)`
  color: ${({ theme }) => theme.colors.neutral500};
`;

const ErrorText = styled(Typography)`
  color: ${({ theme }) => theme.colors.danger600};
`;

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="pi" fontWeight="bold" textColor="neutral700">
    {children}
  </Typography>
);

/* ---------------------------------------------------------------------------
 * Modal
 * -------------------------------------------------------------------------*/

export interface EmbedDraft {
  source: 'url' | 'iframe';
  url?: string;
  iframe?: string;
  embedHtml?: string;
  embedSrc?: string;
  provider?: EmbedProvider;
  thumbnail?: string;
  aspectRatio: AspectRatio;
  customAspectRatio?: string;
  alignment: MediaAlignment;
  caption?: string;
  title?: string;
}

/** Everything recomputed from the author's raw input on each keystroke. */
interface DerivedEmbed {
  /** Why the current input can't be embedded, or null when it's fine. */
  error: string | null;
  embedHtml?: string;
  embedSrc?: string;
  provider?: EmbedProvider;
  thumbnail?: string;
  /** `width`/`height` declared by a pasted iframe, used to infer its ratio. */
  width?: string;
  height?: string;
}

interface EmbedEditorModalProps {
  open: boolean;
  element: EmbedElement;
  onSave: (draft: EmbedDraft) => void;
  onRemove: () => void;
  onClose: () => void;
}

const ALIGNMENTS: MediaAlignment[] = ['left', 'center', 'right', 'none'];

export const EmbedEditorModal = ({
  open,
  element,
  onSave,
  onRemove,
  onClose,
}: EmbedEditorModalProps) => {
  const { formatMessage } = useIntl();

  const [draft, setDraft] = React.useState<EmbedDraft>({
    source: element.source ?? 'url',
    url: element.url,
    iframe: element.iframe,
    aspectRatio: element.aspectRatio ?? '16:9',
    customAspectRatio: element.customAspectRatio,
    alignment: element.alignment ?? 'center',
    caption: element.caption,
    title: element.title,
  });

  const patch = (next: Partial<EmbedDraft>) =>
    setDraft((prev) => ({ ...prev, ...next }));

  /**
   * The embed markup is always derived, never typed by hand: URL mode builds it
   * from the provider table, embed-code mode rebuilds it from an attribute
   * allowlist. Either way what gets saved has been through sanitization.
   */
  const derived = React.useMemo<DerivedEmbed>(() => {
    if (draft.source === 'url') {
      const url = (draft.url ?? '').trim();
      if (!url) return { error: null };
      const built = buildUrlEmbed(url, draft.title);
      if (!built) {
        return {
          error: formatMessage({
            id: 'components.Blocks.embed.error.unknownUrl',
            defaultMessage:
              "That URL isn't a provider we can embed automatically. Switch to the Embed code tab and paste the platform's iframe instead.",
          }),
        };
      }
      const provider = detectProvider(url);
      return {
        error: null,
        embedHtml: built.html,
        embedSrc: built.src,
        provider,
        thumbnail: getThumbnail(url) ?? undefined,
      };
    }

    const code = (draft.iframe ?? '').trim();
    if (!code) return { error: null };
    const result = sanitizeIframe(code);
    if (result.error) {
      const messages: Record<string, string> = {
        'no-iframe': formatMessage({
          id: 'components.Blocks.embed.error.noIframe',
          defaultMessage:
            'No <iframe> found in that snippet. Paste the full embed code from the platform.',
        }),
        'no-src': formatMessage({
          id: 'components.Blocks.embed.error.noSrc',
          defaultMessage: 'That iframe has no src attribute.',
        }),
        'insecure-src': formatMessage({
          id: 'components.Blocks.embed.error.insecureSrc',
          defaultMessage:
            'Only https:// embeds are allowed. Scripts and other embed types are stripped for security.',
        }),
      };
      return { error: messages[result.error] };
    }
    return {
      error: null,
      embedHtml: result.html,
      embedSrc: result.src,
      provider: 'generic' as EmbedProvider,
      width: result.width,
      height: result.height,
    };
  }, [draft.source, draft.url, draft.iframe, draft.title, formatMessage]);

  // Adopt the ratio a pasted iframe declares, so the preview matches the
  // platform's own sizing instead of silently forcing 16:9.
  const pastedRatio = React.useMemo(
    () => inferAspectRatio(derived.width, derived.height),
    [derived.width, derived.height]
  );
  const appliedPastedRatio = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!pastedRatio) return;
    const key = `${derived.embedSrc}:${pastedRatio}`;
    if (appliedPastedRatio.current === key) return;
    appliedPastedRatio.current = key;
    setDraft((prev) => ({ ...prev, aspectRatio: pastedRatio }));
  }, [pastedRatio, derived.embedSrc]);

  const cssRatio =
    draft.aspectRatio === 'custom'
      ? draft.customAspectRatio || '16 / 9'
      : toCssAspectRatio(draft.aspectRatio);

  const canSave = !!derived.embedHtml;

  const handleSave = () => {
    if (!derived.embedHtml) return;
    onSave({
      ...draft,
      url: draft.source === 'url' ? draft.url?.trim() : undefined,
      iframe: draft.source === 'iframe' ? draft.iframe?.trim() : undefined,
      embedHtml: derived.embedHtml,
      embedSrc: derived.embedSrc,
      provider: derived.provider,
      thumbnail: derived.thumbnail,
    });
  };

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
              id: 'components.Blocks.embed.modal.title',
              defaultMessage: 'Embed',
            })}
          </Modal.Title>
        </Modal.Header>

        <ModalBody>
          {/* Source tabs */}
          <TabRow>
            <Tab
              type="button"
              $active={draft.source === 'url'}
              onClick={() => patch({ source: 'url' })}
            >
              {formatMessage({
                id: 'components.Blocks.embed.tab.url',
                defaultMessage: 'URL',
              })}
            </Tab>
            <Tab
              type="button"
              $active={draft.source === 'iframe'}
              onClick={() => patch({ source: 'iframe' })}
            >
              {formatMessage({
                id: 'components.Blocks.embed.tab.code',
                defaultMessage: 'Embed code',
              })}
            </Tab>
          </TabRow>

          {draft.source === 'url' ? (
            <Flex direction="column" gap={2} alignItems="stretch">
              <FieldLabel>
                {formatMessage({
                  id: 'components.Blocks.embed.field.url',
                  defaultMessage: 'Video or page URL',
                })}
              </FieldLabel>
              <TextField
                type="url"
                autoFocus
                placeholder="https://www.youtube.com/watch?v=…"
                value={draft.url ?? ''}
                onChange={(e) => patch({ url: e.target.value })}
              />
              <Hint variant="pi">
                {formatMessage({
                  id: 'components.Blocks.embed.hint.url',
                  defaultMessage:
                    'YouTube, Vimeo, Loom, Wistia, Dailymotion and api.video are converted automatically. For anything else, use the Embed code tab.',
                })}
              </Hint>
            </Flex>
          ) : (
            <Flex direction="column" gap={2} alignItems="stretch">
              <FieldLabel>
                {formatMessage({
                  id: 'components.Blocks.embed.field.code',
                  defaultMessage: 'Embed code',
                })}
              </FieldLabel>
              <CodeArea
                autoFocus
                spellCheck={false}
                placeholder={
                  '<iframe src="https://…" allowfullscreen></iframe>'
                }
                value={draft.iframe ?? ''}
                onChange={(e) => patch({ iframe: e.target.value })}
              />
              <Hint variant="pi">
                {formatMessage({
                  id: 'components.Blocks.embed.hint.code',
                  defaultMessage:
                    'Only the <iframe> is kept — scripts, event handlers and unknown attributes are removed before saving.',
                })}
              </Hint>
            </Flex>
          )}

          {derived.error ? (
            <ErrorText variant="pi">{derived.error}</ErrorText>
          ) : null}

          {/* Live preview */}
          {derived.embedHtml ? (
            <Flex direction="column" gap={2} alignItems="stretch">
              <FieldLabel>
                {formatMessage({
                  id: 'components.Blocks.embed.field.preview',
                  defaultMessage: 'Preview',
                })}
              </FieldLabel>
              <PreviewFrameWrapper
                $ratio={cssRatio}
                dangerouslySetInnerHTML={{ __html: derived.embedHtml }}
              />
              <Hint variant="pi">
                {formatMessage(
                  {
                    id: 'components.Blocks.embed.hint.provider',
                    defaultMessage:
                      'Detected: {provider}. The preview only renders if its host is allowed in your admin frame-src CSP.',
                  },
                  { provider: getProviderLabel(derived.provider) }
                )}
              </Hint>
            </Flex>
          ) : null}

          {/* Title */}
          <Flex direction="column" gap={2} alignItems="stretch">
            <FieldLabel>
              {formatMessage({
                id: 'components.Blocks.embed.field.title',
                defaultMessage: 'Title (accessible name, optional)',
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
                id: 'components.Blocks.embed.field.caption',
                defaultMessage: 'Caption (optional)',
              })}
            </FieldLabel>
            <TextField
              type="text"
              value={draft.caption ?? ''}
              onChange={(e) => patch({ caption: e.target.value })}
            />
          </Flex>

          {/* Aspect ratio */}
          <Flex direction="column" gap={2} alignItems="stretch">
            <FieldLabel>
              {formatMessage({
                id: 'components.Blocks.embed.field.aspectRatio',
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
                id: 'components.Blocks.embed.field.alignment',
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
            <Button type="button" disabled={!canSave} onClick={handleSave}>
              {formatMessage({ id: 'global.save', defaultMessage: 'Save' })}
            </Button>
          </Flex>
        </Modal.Footer>
      </ModalContent>
    </Modal.Root>
  );
};

export { isEmbeddableUrl };

export default EmbedEditorModal;
