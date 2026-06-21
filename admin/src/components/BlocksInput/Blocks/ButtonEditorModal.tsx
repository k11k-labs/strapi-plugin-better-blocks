import * as React from 'react';

import { useStrapiApp } from '@strapi/admin/strapi-admin';
import {
  Button,
  Checkbox,
  Divider,
  Flex,
  Modal,
  SingleSelect,
  SingleSelectOption,
  Typography,
} from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { styled } from 'styled-components';

import {
  type ButtonAlignment,
  type ButtonElement,
  type ButtonFile,
  type ButtonLink,
  type ButtonMode,
  type ButtonPresets,
  type ButtonStyle,
  type ButtonVariant,
} from '../utils/types';

/* ---------------------------------------------------------------------------
 * Shared helpers (also used by the in-editor Button preview)
 * -------------------------------------------------------------------------*/

/** Bytes → human readable, e.g. 5242880 → "5 MB". */
export const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const value = bytes / Math.pow(1024, i);
  return `${parseFloat(value.toFixed(1))} ${units[i]}`;
};

const FILE_ICONS: Record<string, string> = {
  pdf: '📄',
  doc: '📝',
  docx: '📝',
  rtf: '📝',
  txt: '📄',
  xls: '📊',
  xlsx: '📊',
  csv: '📊',
  ppt: '📽️',
  pptx: '📽️',
  zip: '📦',
  rar: '📦',
  '7z': '📦',
  mp3: '🎵',
  wav: '🎵',
  ogg: '🎵',
  mp4: '🎬',
  mov: '🎬',
  avi: '🎬',
  webm: '🎬',
  png: '🖼️',
  jpg: '🖼️',
  jpeg: '🖼️',
  gif: '🖼️',
  svg: '🖼️',
  webp: '🖼️',
};

/** File extension (with or without dot) → emoji icon. */
export const getFileIcon = (ext?: string): string => {
  if (!ext) return '📎';
  const key = ext.replace(/^\./, '').toLowerCase();
  return FILE_ICONS[key] ?? '📎';
};

const prefixFileUrlWithBackendUrl = (fileURL?: string): string | undefined => {
  return !!fileURL && fileURL.startsWith('/')
    ? `${window.strapi.backendURL}${fileURL}`
    : fileURL;
};

const stripExtension = (name: string): string =>
  name.replace(/\.[^./\\]+$/, '');

/* ---------------------------------------------------------------------------
 * Styled form primitives (mirroring the look of the Details/Math editors)
 * -------------------------------------------------------------------------*/

const ModalContent = styled(Modal.Content)`
  width: 95vw;
  height: 95vh;
  max-width: none;
  max-height: none;
`;

const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: ${({ theme }) => theme.spaces[4]} ${({ theme }) => theme.spaces[6]}
    ${({ theme }) => theme.spaces[6]};
`;

const ModalFooter = styled(Modal.Footer)`
  flex: 0 0 auto;
`;

const SplitLayout = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: ${({ theme }) => theme.spaces[6]};
  min-height: 360px;

  @media (max-width: 760px) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto;
  }
`;

const SettingsPane = styled.div`
  min-height: 0;
  overflow: auto;
  padding-right: ${({ theme }) => theme.spaces[2]};
`;

const PreviewBox = styled.div`
  min-height: 0;
  overflow: auto;
  border: 1px solid ${({ theme }) => theme.colors.neutral150};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral100};
  padding: ${({ theme }) => theme.spaces[4]};
`;

const TextField = styled.input`
  width: 100%;
  box-sizing: border-box;
  /* Match Strapi's SingleSelect height (40px) so inputs and dropdowns line up. */
  min-height: 40px;
  padding: 0 ${({ theme }) => theme.spaces[3]};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral0};
  color: ${({ theme }) => theme.colors.neutral800};
  font-size: ${({ theme }) => theme.fontSizes[1]};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary600};
  }
`;

const Segmented = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spaces[1]};
`;

const SegmentButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: ${({ theme }) => theme.spaces[2]};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes[1]};
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.primary600 : theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.primary100 : theme.colors.neutral0};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary600 : theme.colors.neutral700};

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary600};
  }
`;

const ColorSwatchInput = styled.input`
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral0};
  cursor: pointer;
`;

const HexInput = styled(TextField)`
  flex: 1;
`;

const ClearButton = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.neutral500};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes[1]};
  text-decoration: underline;

  &:hover {
    color: ${({ theme }) => theme.colors.danger600};
  }
`;

const FilePill = styled(Flex)`
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral100};
  padding: ${({ theme }) => theme.spaces[2]} ${({ theme }) => theme.spaces[3]};
`;

const PreviewButton = styled.a<{
  $bg?: string;
  $text?: string;
  $hoverBg?: string;
  $hoverText?: string;
  $radius?: string;
  $fontSize?: string;
  $fontWeight?: string;
  $padding?: string;
  $border?: string;
}>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
  background-color: ${({ $bg }) => $bg || '#4945ff'};
  color: ${({ $text }) => $text || '#ffffff'};
  border-radius: ${({ $radius }) => $radius || '4px'};
  font-size: ${({ $fontSize }) => $fontSize || '16px'};
  font-weight: ${({ $fontWeight }) => $fontWeight || '600'};
  padding: ${({ $padding }) => $padding || '12px 24px'};
  border: ${({ $border }) => $border || 'none'};

  &:hover {
    ${({ $hoverBg }) => ($hoverBg ? `background-color: ${$hoverBg};` : '')}
    ${({ $hoverText }) => ($hoverText ? `color: ${$hoverText};` : '')}
  }
`;

/* ---------------------------------------------------------------------------
 * Draft state
 * -------------------------------------------------------------------------*/

interface ButtonDraft {
  buttonType: ButtonMode;
  label: string;
  alignment: ButtonAlignment;
  url: string;
  newTab: boolean;
  ariaLabel: string;
  file?: ButtonFile;
  showFileSize: boolean;
  showFileIcon: boolean;
  /** Selected style preset; flips to "custom" once colors/border are edited. */
  variant: ButtonVariant;
  style: ButtonStyle;
  cssClass: string;
  // Border is stored as a single `style.border` CSS shorthand, but edited here
  // as discrete controls (toggle + width + style + color).
  borderEnabled: boolean;
  borderWidth: string;
  borderStyle: string;
  borderColor: string;
}

const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double'];

interface ParsedBorder {
  enabled: boolean;
  width: string;
  style: string;
  color: string;
}

/** Parse a `border` shorthand (e.g. "2px solid #ccc") into discrete parts. */
const parseBorder = (border?: string): ParsedBorder => {
  const def: ParsedBorder = {
    enabled: false,
    width: '1px',
    style: 'solid',
    color: '#cccccc',
  };
  const value = (border ?? '').trim();
  if (value === '' || value === 'none') return def;

  const parts = value.split(/\s+/);
  const widthPart = parts.find((p) => /^[\d.]+(px|em|rem|%)$/.test(p));
  const stylePart = parts.find((p) => BORDER_STYLES.includes(p));
  const colorPart = parts.find(
    (p) =>
      p !== widthPart &&
      !BORDER_STYLES.includes(p) &&
      /^#|rgb|hsl|[a-z]/i.test(p)
  );

  return {
    enabled: true,
    width: widthPart ?? def.width,
    style: stylePart ?? def.style,
    color: colorPart ?? def.color,
  };
};

/** Compose the discrete border controls back into a CSS shorthand ("" when off). */
const composeBorder = (draft: ButtonDraft): string =>
  draft.borderEnabled
    ? `${draft.borderWidth || '1px'} ${draft.borderStyle || 'solid'} ${
        draft.borderColor || '#cccccc'
      }`
    : '';

const toDraft = (el: ButtonElement): ButtonDraft => {
  // Border + variant are managed separately, so keep them out of the style draft.
  const { border: _border, variant: _variant, ...restStyle } = el.style ?? {};
  const parsedBorder = parseBorder(el.style?.border);
  return {
    buttonType: el.buttonType ?? 'link',
    label: el.label ?? '',
    alignment: el.alignment ?? 'center',
    url: el.link?.url ?? '',
    newTab: el.link?.target === '_blank',
    ariaLabel: el.link?.ariaLabel ?? '',
    file: el.file,
    showFileSize: el.showFileSize ?? true,
    showFileIcon: el.showFileIcon ?? true,
    variant: el.style?.variant ?? 'custom',
    style: { ...restStyle },
    cssClass: el.cssClass ?? '',
    borderEnabled: parsedBorder.enabled,
    borderWidth: parsedBorder.width,
    borderStyle: parsedBorder.style,
    borderColor: parsedBorder.color,
  };
};

const pruneStyle = (style: ButtonStyle): ButtonStyle => {
  const out: Record<string, string> = {};
  (Object.keys(style) as (keyof ButtonStyle)[]).forEach((key) => {
    const value = style[key];
    if (typeof value === 'string' && value.trim() !== '') out[key] = value;
  });
  return out as ButtonStyle;
};

/** Build the (clean) element patch to persist; opposite-mode keys are omitted. */
const draftToPatch = (draft: ButtonDraft): Partial<ButtonElement> => {
  const border = composeBorder(draft);
  const patch: Partial<ButtonElement> = {
    buttonType: draft.buttonType,
    label: draft.label.trim(),
    alignment: draft.alignment,
    style: {
      ...pruneStyle(draft.style),
      variant: draft.variant,
      ...(border ? { border } : {}),
    },
    showFileSize: draft.showFileSize,
    showFileIcon: draft.showFileIcon,
    cssClass: draft.cssClass.trim() || undefined,
  };

  if (draft.buttonType === 'link') {
    const link: ButtonLink = {
      url: draft.url.trim(),
      target: draft.newTab ? '_blank' : '_self',
    };
    if (draft.newTab) link.rel = 'noopener noreferrer';
    if (draft.ariaLabel.trim()) link.ariaLabel = draft.ariaLabel.trim();
    patch.link = link;
  } else {
    patch.file = draft.file;
  }

  return patch;
};

/* ---------------------------------------------------------------------------
 * Presets
 * -------------------------------------------------------------------------*/

/**
 * Built-in style presets. Each applies a background/text/border; everything else
 * (radius, font, padding) is left untouched. Overridable per project via
 * `config/plugins` (`better-blocks.button.presets`).
 */
const DEFAULT_PRESETS: Required<ButtonPresets> = {
  primary: {
    backgroundColor: '#4945ff',
    textColor: '#ffffff',
    border: 'none',
  },
  secondary: {
    backgroundColor: '#dcdce4',
    textColor: '#32324d',
    border: 'none',
  },
  outline: {
    backgroundColor: 'transparent',
    textColor: '#4945ff',
    border: '2px solid #4945ff',
  },
  filled: {
    backgroundColor: '#32324d',
    textColor: '#ffffff',
    border: 'none',
  },
};

const VARIANTS: { value: ButtonVariant; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'outline', label: 'Outline' },
  { value: 'filled', label: 'Filled' },
  { value: 'custom', label: 'Custom' },
];

const PADDING_PRESETS = [
  { value: '8px 16px', labelId: 'small', label: 'Small' },
  { value: '12px 24px', labelId: 'medium', label: 'Medium' },
  { value: '16px 32px', labelId: 'large', label: 'Large' },
];

const FONT_WEIGHTS = [
  { value: '400', label: 'Normal (400)' },
  { value: '500', label: 'Medium (500)' },
  { value: '600', label: 'Semibold (600)' },
  { value: '700', label: 'Bold (700)' },
];

const ALIGNMENTS: ButtonAlignment[] = ['left', 'center', 'right'];

/* ---------------------------------------------------------------------------
 * Small presentational helpers
 * -------------------------------------------------------------------------*/

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <Flex direction="column" gap={1} alignItems="stretch">
    <Typography
      variant="pi"
      fontWeight="bold"
      textColor="neutral700"
      tag="label"
    >
      {label}
    </Typography>
    {children}
    {hint ? (
      <Typography variant="pi" textColor="neutral500">
        {hint}
      </Typography>
    ) : null}
  </Flex>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="delta" tag="h3">
    {children}
  </Typography>
);

const ColorField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (next: string) => void;
}) => (
  <Field label={label}>
    <Flex gap={2} alignItems="center">
      <ColorSwatchInput
        type="color"
        value={value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
      />
      <HexInput
        value={value ?? ''}
        placeholder="—"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <ClearButton type="button" onClick={() => onChange('')}>
          Clear
        </ClearButton>
      ) : null}
    </Flex>
  </Field>
);

/* ---------------------------------------------------------------------------
 * Modal
 * -------------------------------------------------------------------------*/

interface ButtonEditorModalProps {
  open: boolean;
  element: ButtonElement;
  /** Per-project preset overrides (merged over the built-in presets). */
  presets?: ButtonPresets;
  onSave: (patch: Partial<ButtonElement>) => void;
  onRemove: () => void;
  onClose: () => void;
}

const ButtonEditorModal = ({
  open,
  element,
  presets,
  onSave,
  onRemove,
  onClose,
}: ButtonEditorModalProps) => {
  const { formatMessage } = useIntl();
  const components = useStrapiApp(
    'ButtonEditorModal',
    (state) => state.components
  );
  const [draft, setDraft] = React.useState<ButtonDraft>(() => toDraft(element));
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const resolvedPresets: Required<ButtonPresets> = {
    primary: { ...DEFAULT_PRESETS.primary, ...presets?.primary },
    secondary: { ...DEFAULT_PRESETS.secondary, ...presets?.secondary },
    outline: { ...DEFAULT_PRESETS.outline, ...presets?.outline },
    filled: { ...DEFAULT_PRESETS.filled, ...presets?.filled },
  };

  // Re-seed the draft whenever the modal (re)opens for this element.
  React.useEffect(() => {
    if (open) setDraft(toDraft(element));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Plain style edits keep the current variant; color/border edits below use
  // `patchColor`/`markCustom` so the preset selector flips to "Custom".
  const patchStyle = (next: Partial<ButtonStyle>) =>
    setDraft((d) => ({ ...d, style: { ...d.style, ...next } }));

  const patchColor = (next: Partial<ButtonStyle>) =>
    setDraft((d) => ({
      ...d,
      variant: 'custom',
      style: { ...d.style, ...next },
    }));

  const markCustom = (next: Partial<ButtonDraft>) =>
    setDraft((d) => ({ ...d, variant: 'custom', ...next }));

  const applyPreset = (variant: ButtonVariant) => {
    if (variant === 'custom') {
      setDraft((d) => ({ ...d, variant: 'custom' }));
      return;
    }
    const preset = resolvedPresets[variant];
    const pb = parseBorder(preset.border);
    setDraft((d) => ({
      ...d,
      variant,
      style: {
        ...d.style,
        backgroundColor: preset.backgroundColor ?? d.style.backgroundColor,
        textColor: preset.textColor ?? d.style.textColor,
      },
      borderEnabled: pb.enabled,
      borderWidth: pb.width,
      borderStyle: pb.style,
      borderColor: pb.color,
    }));
  };

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
      const file: ButtonFile = {
        id: typeof asset.id === 'number' ? asset.id : undefined,
        url: prefixFileUrlWithBackendUrl(asset.url as string) ?? '',
        name: (asset.name as string) ?? 'file',
        size: sizeKb !== undefined ? Math.round(sizeKb * 1024) : undefined,
        ext: (asset.ext as string) ?? undefined,
        mime: (asset.mime as string) ?? undefined,
      };
      setDraft((d) => ({
        ...d,
        file,
        label: d.label.trim() ? d.label : stripExtension(file.name),
      }));
    }
    setPickerOpen(false);
  };

  const paddingValue = draft.style.padding ?? '';
  const isPresetPadding = PADDING_PRESETS.some((p) => p.value === paddingValue);

  const previewLabel =
    draft.label.trim() ||
    formatMessage({
      id: 'components.Blocks.button.preview.placeholder',
      defaultMessage: 'Button',
    });

  const showIcon = draft.buttonType === 'file' && draft.showFileIcon;
  const showSize =
    draft.buttonType === 'file' && draft.showFileSize && !!draft.file?.size;

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
              id: 'components.Blocks.button.modal.title',
              defaultMessage: 'Edit button',
            })}
          </Modal.Title>
        </Modal.Header>
        <ModalBody>
          <SplitLayout>
            <SettingsPane>
              <Flex direction="column" gap={4} alignItems="stretch">
                {/* --- Type & content --- */}
                <SectionTitle>
                  {formatMessage({
                    id: 'components.Blocks.button.section.content',
                    defaultMessage: 'Content',
                  })}
                </SectionTitle>

                <Field
                  label={formatMessage({
                    id: 'components.Blocks.button.type',
                    defaultMessage: 'Button type',
                  })}
                >
                  <Segmented>
                    {(['link', 'file'] as ButtonMode[]).map((mode) => (
                      <SegmentButton
                        key={mode}
                        type="button"
                        $active={draft.buttonType === mode}
                        onClick={() =>
                          setDraft((d) => ({ ...d, buttonType: mode }))
                        }
                      >
                        {mode === 'link'
                          ? formatMessage({
                              id: 'components.Blocks.button.type.link',
                              defaultMessage: '🔗 Link',
                            })
                          : formatMessage({
                              id: 'components.Blocks.button.type.file',
                              defaultMessage: '📁 File download',
                            })}
                      </SegmentButton>
                    ))}
                  </Segmented>
                </Field>

                <Field
                  label={formatMessage({
                    id: 'components.Blocks.button.text',
                    defaultMessage: 'Text',
                  })}
                >
                  <TextField
                    value={draft.label}
                    placeholder="Click me"
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, label: e.target.value }))
                    }
                  />
                </Field>

                {draft.buttonType === 'link' ? (
                  <>
                    <Field
                      label={formatMessage({
                        id: 'components.Blocks.button.url',
                        defaultMessage: 'URL',
                      })}
                    >
                      <TextField
                        value={draft.url}
                        placeholder="https://example.com"
                        spellCheck={false}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, url: e.target.value }))
                        }
                      />
                    </Field>
                    <Checkbox
                      checked={draft.newTab}
                      onCheckedChange={(checked: boolean) =>
                        setDraft((d) => ({ ...d, newTab: !!checked }))
                      }
                    >
                      {formatMessage({
                        id: 'components.Blocks.button.newTab',
                        defaultMessage:
                          'Open in new tab (adds rel="noopener noreferrer")',
                      })}
                    </Checkbox>
                    <Field
                      label={formatMessage({
                        id: 'components.Blocks.button.ariaLabel',
                        defaultMessage: 'ARIA label (optional)',
                      })}
                    >
                      <TextField
                        value={draft.ariaLabel}
                        placeholder="Accessible description"
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, ariaLabel: e.target.value }))
                        }
                      />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field
                      label={formatMessage({
                        id: 'components.Blocks.button.file',
                        defaultMessage: 'File',
                      })}
                    >
                      {draft.file ? (
                        <FilePill justifyContent="space-between" gap={2}>
                          <Flex gap={2} alignItems="center" overflow="hidden">
                            <span>{getFileIcon(draft.file.ext)}</span>
                            <Flex direction="column" alignItems="flex-start">
                              <Typography
                                variant="pi"
                                fontWeight="bold"
                                ellipsis
                              >
                                {draft.file.name}
                              </Typography>
                              <Typography variant="pi" textColor="neutral500">
                                {formatFileSize(draft.file.size)}
                              </Typography>
                            </Flex>
                          </Flex>
                          <Button
                            variant="tertiary"
                            type="button"
                            disabled={!MediaLibraryDialog}
                            onClick={() => setPickerOpen(true)}
                          >
                            {formatMessage({
                              id: 'components.Blocks.button.file.change',
                              defaultMessage: 'Change',
                            })}
                          </Button>
                        </FilePill>
                      ) : (
                        <Button
                          variant="secondary"
                          type="button"
                          disabled={!MediaLibraryDialog}
                          onClick={() => setPickerOpen(true)}
                        >
                          {formatMessage({
                            id: 'components.Blocks.button.file.select',
                            defaultMessage: 'Select from Media Library',
                          })}
                        </Button>
                      )}
                    </Field>
                    <Flex gap={4} wrap="wrap">
                      <Checkbox
                        checked={draft.showFileSize}
                        onCheckedChange={(checked: boolean) =>
                          setDraft((d) => ({ ...d, showFileSize: !!checked }))
                        }
                      >
                        {formatMessage({
                          id: 'components.Blocks.button.showFileSize',
                          defaultMessage: 'Show file size',
                        })}
                      </Checkbox>
                      <Checkbox
                        checked={draft.showFileIcon}
                        onCheckedChange={(checked: boolean) =>
                          setDraft((d) => ({ ...d, showFileIcon: !!checked }))
                        }
                      >
                        {formatMessage({
                          id: 'components.Blocks.button.showFileIcon',
                          defaultMessage: 'Show file icon',
                        })}
                      </Checkbox>
                    </Flex>
                  </>
                )}

                <Divider />

                {/* --- Layout --- */}
                <SectionTitle>
                  {formatMessage({
                    id: 'components.Blocks.button.section.layout',
                    defaultMessage: 'Layout',
                  })}
                </SectionTitle>
                <Field
                  label={formatMessage({
                    id: 'components.Blocks.button.alignment',
                    defaultMessage: 'Alignment',
                  })}
                >
                  <Segmented>
                    {ALIGNMENTS.map((a) => (
                      <SegmentButton
                        key={a}
                        type="button"
                        $active={draft.alignment === a}
                        onClick={() =>
                          setDraft((d) => ({ ...d, alignment: a }))
                        }
                      >
                        {a.charAt(0).toUpperCase() + a.slice(1)}
                      </SegmentButton>
                    ))}
                  </Segmented>
                </Field>

                <Divider />

                {/* --- Colors --- */}
                <SectionTitle>
                  {formatMessage({
                    id: 'components.Blocks.button.section.colors',
                    defaultMessage: 'Colors',
                  })}
                </SectionTitle>
                <Field
                  label={formatMessage({
                    id: 'components.Blocks.button.preset',
                    defaultMessage: 'Style preset',
                  })}
                  hint={formatMessage({
                    id: 'components.Blocks.button.preset.hint',
                    defaultMessage:
                      'Apply a brand variant, then fine-tune below. Editing colors or the border switches to Custom.',
                  })}
                >
                  <Segmented>
                    {VARIANTS.map((v) => (
                      <SegmentButton
                        key={v.value}
                        type="button"
                        $active={draft.variant === v.value}
                        onClick={() => applyPreset(v.value)}
                      >
                        {v.label}
                      </SegmentButton>
                    ))}
                  </Segmented>
                </Field>
                <Flex gap={4} wrap="wrap" alignItems="flex-start">
                  <ColorField
                    label={formatMessage({
                      id: 'components.Blocks.button.bgColor',
                      defaultMessage: 'Background',
                    })}
                    value={draft.style.backgroundColor}
                    onChange={(v) => patchColor({ backgroundColor: v })}
                  />
                  <ColorField
                    label={formatMessage({
                      id: 'components.Blocks.button.textColor',
                      defaultMessage: 'Text',
                    })}
                    value={draft.style.textColor}
                    onChange={(v) => patchColor({ textColor: v })}
                  />
                  <ColorField
                    label={formatMessage({
                      id: 'components.Blocks.button.hoverBgColor',
                      defaultMessage: 'Hover background',
                    })}
                    value={draft.style.hoverBackgroundColor}
                    onChange={(v) => patchColor({ hoverBackgroundColor: v })}
                  />
                  <ColorField
                    label={formatMessage({
                      id: 'components.Blocks.button.hoverTextColor',
                      defaultMessage: 'Hover text',
                    })}
                    value={draft.style.hoverTextColor}
                    onChange={(v) => patchColor({ hoverTextColor: v })}
                  />
                </Flex>

                <Divider />

                {/* --- Sizing --- */}
                <SectionTitle>
                  {formatMessage({
                    id: 'components.Blocks.button.section.sizing',
                    defaultMessage: 'Sizing & typography',
                  })}
                </SectionTitle>
                <Flex gap={4} wrap="wrap" alignItems="flex-start">
                  <Field
                    label={formatMessage({
                      id: 'components.Blocks.button.borderRadius',
                      defaultMessage: 'Border radius',
                    })}
                  >
                    <TextField
                      value={draft.style.borderRadius ?? ''}
                      placeholder="4px"
                      onChange={(e) =>
                        patchStyle({ borderRadius: e.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label={formatMessage({
                      id: 'components.Blocks.button.fontSize',
                      defaultMessage: 'Font size',
                    })}
                  >
                    <TextField
                      value={draft.style.fontSize ?? ''}
                      placeholder="16px"
                      onChange={(e) => patchStyle({ fontSize: e.target.value })}
                    />
                  </Field>
                </Flex>
                <Field
                  label={formatMessage({
                    id: 'components.Blocks.button.fontWeight',
                    defaultMessage: 'Font weight',
                  })}
                >
                  <SingleSelect
                    value={draft.style.fontWeight || 'inherit'}
                    onChange={(v: string | number) =>
                      patchStyle({
                        fontWeight: v === 'inherit' ? '' : String(v),
                      })
                    }
                  >
                    <SingleSelectOption value="inherit">
                      {formatMessage({
                        id: 'components.Blocks.button.default',
                        defaultMessage: 'Default',
                      })}
                    </SingleSelectOption>
                    {FONT_WEIGHTS.map((w) => (
                      <SingleSelectOption key={w.value} value={w.value}>
                        {w.label}
                      </SingleSelectOption>
                    ))}
                  </SingleSelect>
                </Field>
                <Field
                  label={formatMessage({
                    id: 'components.Blocks.button.padding',
                    defaultMessage: 'Padding',
                  })}
                  hint={formatMessage({
                    id: 'components.Blocks.button.padding.hint',
                    defaultMessage:
                      'Pick a preset or type a custom CSS padding value.',
                  })}
                >
                  <Flex direction="column" gap={2} alignItems="stretch">
                    <SingleSelect
                      value={isPresetPadding ? paddingValue : 'custom'}
                      onChange={(v: string | number) => {
                        if (v !== 'custom') patchStyle({ padding: String(v) });
                      }}
                    >
                      {PADDING_PRESETS.map((p) => (
                        <SingleSelectOption key={p.value} value={p.value}>
                          {p.label} ({p.value})
                        </SingleSelectOption>
                      ))}
                      <SingleSelectOption value="custom">
                        {formatMessage({
                          id: 'components.Blocks.button.padding.custom',
                          defaultMessage: 'Custom…',
                        })}
                      </SingleSelectOption>
                    </SingleSelect>
                    <TextField
                      value={paddingValue}
                      placeholder="12px 24px"
                      onChange={(e) => patchStyle({ padding: e.target.value })}
                    />
                  </Flex>
                </Field>
                <Field
                  label={formatMessage({
                    id: 'components.Blocks.button.border',
                    defaultMessage: 'Border',
                  })}
                >
                  <Flex direction="column" gap={2} alignItems="stretch">
                    <Checkbox
                      checked={draft.borderEnabled}
                      onCheckedChange={(checked: boolean) =>
                        markCustom({ borderEnabled: !!checked })
                      }
                    >
                      {formatMessage({
                        id: 'components.Blocks.button.border.enable',
                        defaultMessage: 'Show border',
                      })}
                    </Checkbox>
                    {draft.borderEnabled ? (
                      <Flex gap={4} wrap="wrap" alignItems="flex-start">
                        <Field
                          label={formatMessage({
                            id: 'components.Blocks.button.border.width',
                            defaultMessage: 'Thickness',
                          })}
                        >
                          <TextField
                            value={draft.borderWidth}
                            placeholder="1px"
                            onChange={(e) =>
                              markCustom({ borderWidth: e.target.value })
                            }
                          />
                        </Field>
                        <Field
                          label={formatMessage({
                            id: 'components.Blocks.button.border.style',
                            defaultMessage: 'Style',
                          })}
                        >
                          <SingleSelect
                            value={draft.borderStyle}
                            onChange={(v: string | number) =>
                              markCustom({ borderStyle: String(v) })
                            }
                          >
                            {BORDER_STYLES.map((s) => (
                              <SingleSelectOption key={s} value={s}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </SingleSelectOption>
                            ))}
                          </SingleSelect>
                        </Field>
                        <ColorField
                          label={formatMessage({
                            id: 'components.Blocks.button.border.color',
                            defaultMessage: 'Color',
                          })}
                          value={draft.borderColor}
                          onChange={(v) => markCustom({ borderColor: v })}
                        />
                      </Flex>
                    ) : null}
                  </Flex>
                </Field>

                <Divider />

                {/* --- Advanced --- */}
                <SectionTitle>
                  {formatMessage({
                    id: 'components.Blocks.button.section.advanced',
                    defaultMessage: 'Advanced',
                  })}
                </SectionTitle>
                <Field
                  label={formatMessage({
                    id: 'components.Blocks.button.cssClass',
                    defaultMessage: 'Custom CSS class',
                  })}
                  hint={formatMessage({
                    id: 'components.Blocks.button.cssClass.hint',
                    defaultMessage:
                      'Applied to the rendered button for frontend theming.',
                  })}
                >
                  <TextField
                    value={draft.cssClass}
                    placeholder="my-cta"
                    spellCheck={false}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, cssClass: e.target.value }))
                    }
                  />
                </Field>
              </Flex>
            </SettingsPane>

            {/* --- Live preview --- */}
            <Flex direction="column" gap={2} alignItems="stretch">
              <Typography variant="pi" textColor="neutral600">
                {formatMessage({
                  id: 'components.Blocks.button.preview',
                  defaultMessage: 'Preview',
                })}
              </Typography>
              <PreviewBox style={{ textAlign: draft.alignment }}>
                <PreviewButton
                  className={draft.cssClass || undefined}
                  $bg={draft.style.backgroundColor}
                  $text={draft.style.textColor}
                  $hoverBg={draft.style.hoverBackgroundColor}
                  $hoverText={draft.style.hoverTextColor}
                  $radius={draft.style.borderRadius}
                  $fontSize={draft.style.fontSize}
                  $fontWeight={draft.style.fontWeight}
                  $padding={draft.style.padding}
                  $border={composeBorder(draft) || 'none'}
                  onClick={(e) => e.preventDefault()}
                >
                  {showIcon ? (
                    <span>{getFileIcon(draft.file?.ext)}</span>
                  ) : null}
                  <span>{previewLabel}</span>
                  {showSize ? (
                    <span>({formatFileSize(draft.file?.size)})</span>
                  ) : null}
                </PreviewButton>
              </PreviewBox>
              <Typography variant="pi" textColor="neutral500">
                {formatMessage({
                  id: 'components.Blocks.button.preview.hoverHint',
                  defaultMessage: 'Hover the button to preview hover colors.',
                })}
              </Typography>
            </Flex>
          </SplitLayout>
        </ModalBody>
        <ModalFooter>
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
            <Button type="button" onClick={() => onSave(draftToPatch(draft))}>
              {formatMessage({ id: 'global.save', defaultMessage: 'Save' })}
            </Button>
          </Flex>
        </ModalFooter>
      </ModalContent>

      {pickerOpen && MediaLibraryDialog ? (
        <MediaLibraryDialog
          allowedTypes={['files', 'images', 'videos', 'audios']}
          onClose={() => setPickerOpen(false)}
          onSelectAssets={handleSelectAssets}
        />
      ) : null}
    </Modal.Root>
  );
};

export { ButtonEditorModal };
