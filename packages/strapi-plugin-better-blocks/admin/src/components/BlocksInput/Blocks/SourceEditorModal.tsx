import * as React from 'react';

import {
  Button,
  Flex,
  IconButton,
  Modal,
  Typography,
} from '@strapi/design-system';
import { ArrowClockwise, Minus, Plus } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { styled } from 'styled-components';

/* ---------------------------------------------------------------------------
 * Shared "edit source" modal used by the Math and Diagram blocks.
 *
 * Replaces the previous anchored popover: a long source no longer overflows,
 * and because this is a real modal (own overlay + focus trap) it no longer
 * dismisses — losing unsaved edits — when the page is scrolled. See issue #46.
 * -------------------------------------------------------------------------*/

// Near full-screen: a small margin keeps the overlay visible around the edges.
const ModalContent = styled(Modal.Content)`
  width: 95vw;
  height: 95vh;
  max-width: none;
  max-height: none;
`;

// We deliberately do NOT use Modal.Body: it wraps its children in a Radix
// ScrollArea whose inner viewport stays content-sized, so the editor/preview
// could never fill the dialog height. Instead we render our own body region
// directly inside Modal.Content (a flex column) and let it grow with `flex: 1`.
const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  /* Scroll the whole body if the viewport is too short to hold the panes. */
  overflow: auto;
  padding: ${({ theme }) => theme.spaces[4]} ${({ theme }) => theme.spaces[6]}
    ${({ theme }) => theme.spaces[6]};
`;

// Modal.Footer ships with `flex: 1`, which would split the leftover height with
// the body. Reset it so the body alone fills the dialog.
const ModalFooter = styled(Modal.Footer)`
  flex: 0 0 auto;
`;

// Source editor (left) and live preview (right); stacks on narrow screens.
// `flex: 1` makes it fill the (flex-column) modal body so the panes stay full
// height even when their content is small. `min-height: 0` lets children scroll.
const SplitLayout = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: ${({ theme }) => theme.spaces[4]};
  min-height: 360px;

  @media (max-width: 700px) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  }
`;

const Pane = styled(Flex)`
  min-height: 0;
  min-width: 0;
`;

const SourceTextarea = styled.textarea`
  flex: 1;
  width: 100%;
  min-height: 200px;
  resize: none;
  font-family:
    'SF Mono', SFMono-Regular, ui-monospace, Menlo, Consolas, monospace;
  font-size: ${({ theme }) => theme.fontSizes[1]};
  line-height: 1.5;
  padding: ${({ theme }) => theme.spaces[2]};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral0};
  color: ${({ theme }) => theme.colors.neutral800};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary600};
  }
`;

const PreviewBox = styled.div`
  flex: 1;
  overflow: auto;
  border: 1px solid ${({ theme }) => theme.colors.neutral150};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral100};
`;

// Centers the preview, and applies the zoom level. We use the CSS `zoom`
// property (not transform: scale) because zoom affects layout size, so the
// scroll container can pan to off-screen parts when zoomed in.
const PreviewInner = styled.div<{ $scale: number }>`
  zoom: ${({ $scale }) => $scale};
  display: flex;
  /* The safe keyword keeps the start edge reachable (not clipped) when content
     overflows and the parent scrolls. */
  align-items: safe center;
  justify-content: safe center;
  min-height: 100%;
  padding: ${({ theme }) => theme.spaces[3]};
  text-align: center;

  /* The rendered output is wrapped in a single span (Mermaid SVG or KaTeX).
     Let it fill the pane width so diagrams aren't tiny by default. */
  > span {
    width: 100%;
  }

  /* Size ONLY the Mermaid diagram SVG (rendered as a direct span > svg).
     KaTeX renders radicals (e.g. √) as inline <svg> deep inside .katex; forcing
     a size on those collapses them, so they must keep their intrinsic size. */
  > span > svg {
    width: 100%;
    max-width: 100%;
    height: auto;
  }

  /* Enlarge math so integrals/fractions are clearly legible in the preview.
     Scoped to KaTeX so diagram SVGs are unaffected. */
  .katex {
    font-size: 2.4rem;
  }
`;

interface SourceEditorModalProps {
  open: boolean;
  /** Modal heading, e.g. "Edit Mermaid diagram". */
  title: string;
  /** Label shown above the source textarea, e.g. "Mermaid". */
  label: string;
  placeholder?: string;
  /** The committed source value (used to detect the initial empty state). */
  source: string;
  onSourceChange: (value: string) => void;
  /** Renders the live preview for the current (uncommitted) source. */
  renderPreview: (source: string) => React.ReactNode;
  onSave: () => void;
  onRemove: () => void;
  onClose: () => void;
}

const SourceEditorModal = ({
  open,
  title,
  label,
  placeholder,
  source,
  onSourceChange,
  renderPreview,
  onSave,
  onRemove,
  onClose,
}: SourceEditorModalProps) => {
  const { formatMessage } = useIntl();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [scale, setScale] = React.useState(1);

  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 4;
  const ZOOM_STEP = 1.25;
  const clampZoom = (value: number) =>
    Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
  const zoomIn = () => setScale((s) => clampZoom(s * ZOOM_STEP));
  const zoomOut = () => setScale((s) => clampZoom(s / ZOOM_STEP));
  const zoomReset = () => setScale(1);

  React.useEffect(() => {
    if (open) {
      // Reset zoom each time the editor is opened.
      setScale(1);
      // Defer so the modal is mounted before focusing.
      const id = window.setTimeout(() => textareaRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  return (
    <Modal.Root
      open={open}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) onClose();
      }}
    >
      <ModalContent>
        <Modal.Header>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <ModalBody>
          <SplitLayout>
            <Pane direction="column" gap={1} alignItems="stretch">
              <Typography variant="pi" textColor="neutral600" tag="label">
                {label}
              </Typography>
              <SourceTextarea
                ref={textareaRef}
                value={source}
                spellCheck={false}
                placeholder={placeholder}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  onSourceChange(e.target.value)
                }
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                  // Cmd/Ctrl+Enter saves; plain Enter stays multiline.
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    onSave();
                  }
                }}
              />
            </Pane>
            <Pane direction="column" gap={1} alignItems="stretch">
              <Flex justifyContent="space-between" alignItems="center">
                <Typography variant="pi" textColor="neutral600">
                  {formatMessage({
                    id: 'components.Blocks.sourceEditor.preview',
                    defaultMessage: 'Preview',
                  })}
                </Typography>
                {source.trim() ? (
                  <Flex gap={1} alignItems="center">
                    <IconButton
                      variant="ghost"
                      onClick={zoomOut}
                      disabled={scale <= ZOOM_MIN}
                      label={formatMessage({
                        id: 'components.Blocks.sourceEditor.zoomOut',
                        defaultMessage: 'Zoom out',
                      })}
                    >
                      <Minus />
                    </IconButton>
                    <Typography
                      variant="pi"
                      textColor="neutral600"
                      style={{ minWidth: '4ch', textAlign: 'center' }}
                    >
                      {Math.round(scale * 100)}%
                    </Typography>
                    <IconButton
                      variant="ghost"
                      onClick={zoomIn}
                      disabled={scale >= ZOOM_MAX}
                      label={formatMessage({
                        id: 'components.Blocks.sourceEditor.zoomIn',
                        defaultMessage: 'Zoom in',
                      })}
                    >
                      <Plus />
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      onClick={zoomReset}
                      disabled={scale === 1}
                      label={formatMessage({
                        id: 'components.Blocks.sourceEditor.zoomReset',
                        defaultMessage: 'Reset zoom',
                      })}
                    >
                      <ArrowClockwise />
                    </IconButton>
                  </Flex>
                ) : null}
              </Flex>
              <PreviewBox>
                <PreviewInner $scale={scale}>
                  {source.trim() ? (
                    renderPreview(source)
                  ) : (
                    <Typography variant="pi" textColor="neutral400">
                      —
                    </Typography>
                  )}
                </PreviewInner>
              </PreviewBox>
            </Pane>
          </SplitLayout>
        </ModalBody>
        <ModalFooter>
          <Button variant="danger-light" onClick={onRemove}>
            {formatMessage({
              id: 'components.Blocks.popover.remove',
              defaultMessage: 'Remove',
            })}
          </Button>
          <Flex gap={2} marginLeft="auto">
            <Button variant="tertiary" onClick={onClose}>
              {formatMessage({ id: 'global.cancel', defaultMessage: 'Cancel' })}
            </Button>
            <Button onClick={onSave}>
              {formatMessage({ id: 'global.save', defaultMessage: 'Save' })}
            </Button>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal.Root>
  );
};

export { SourceEditorModal };
