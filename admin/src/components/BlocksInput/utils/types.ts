import type { BaseElement, BaseText, Node, Descendant } from 'slate';

// Common interfaces
export interface Option {
  label: string;
  value: string;
  isDefault?: boolean;
}

export interface FontSetting {
  breakpoint: string;
  fontSize: string | null;
  fontLeading: string | null;
  fontAlignment: string | null;
  fontTracking: string | null;
}

export interface SeparatorSetting {
  breakpoint: string;
  separatorSize: number | null;
  separatorOrientation: 'horizontal' | 'vertical' | null;
  separatorLength: number | null;
}

export interface ImageSetting {
  breakpoint: string;
  imageWidth: string | null;
  imageHeight: string | null;
  imageAspectRatioLocked?: boolean;
}

// Base element types
export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface CustomElement extends BaseElement {
  type: string;
  fontFamily?: string;
  fontColor?: string;
  fontSettings?: FontSetting[];
  textAlign?: TextAlign;
  separatorStyle?: string;
  separatorColor?: string;
  separatorSettings?: SeparatorSetting[];
  imageSettings?: ImageSetting[];
  [key: string]: unknown;
}

export interface CustomText extends BaseText {
  type: 'text';
  text: string;
  color?: string;
  backgroundColor?: string;
}

// Specific element types
export interface LinkNode extends CustomElement {
  type: 'link';
  url: string;
  target?: '_blank' | '_self';
  rel?: string;
  children: Descendant[];
}

export interface ListNode extends CustomElement {
  type: 'list';
  format: 'ordered' | 'unordered' | 'todo';
  indentLevel: number;
  children: Descendant[];
}

export interface HeadingElement extends CustomElement {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: CustomText[];
}

export interface ImageElement extends CustomElement {
  type: 'image';
  image: {
    url: string;
    alternativeText?: string;
    width?: number;
    height?: number;
    formats?: Record<string, any>;
    hash?: string;
    ext?: string;
    mime?: string;
    size?: number;
    previewUrl?: string;
  };
  imageSettings?: ImageSetting[];
  children: CustomText[];
}

export interface MathElement extends CustomElement {
  type: 'math';
  format: 'inline' | 'block';
  value: string;
  children: CustomText[];
}

export interface DiagramElement extends CustomElement {
  type: 'diagram';
  format: 'mermaid';
  value: string;
  children: CustomText[];
}

export type CalloutVariant =
  | 'note'
  | 'tip'
  | 'important'
  | 'warning'
  | 'caution';

export interface CalloutElement extends CustomElement {
  type: 'callout';
  variant: CalloutVariant;
  title?: string;
  children: Descendant[];
}

export interface DetailsElement extends CustomElement {
  type: 'details';
  /** Plain-text label shown in the disclosure header (the <summary>) */
  summary: string;
  /** When true the section is expanded by default (maps to the HTML `open` attribute) */
  defaultOpen?: boolean;
  /** Per-block style override; falls back to the field/global config when unset */
  style?: 'github' | 'custom';
  /** Block-level content shown when the section is expanded */
  children: Descendant[];
}

export type ButtonAlignment = 'left' | 'center' | 'right';
export type ButtonMode = 'link' | 'file';
export type ButtonLinkTarget = '_self' | '_blank' | '_parent' | '_top';
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'filled'
  | 'custom';

export interface ButtonStyle {
  /**
   * Selected style preset. Switches to "custom" once the author overrides the
   * preset's colors or border. Frontend renderers can ignore this.
   */
  variant?: ButtonVariant;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
  fontSize?: string;
  fontWeight?: string;
  padding?: string;
  border?: string;
  hoverBackgroundColor?: string;
  hoverTextColor?: string;
}

/** Color/border values a preset applies (the rest of the styling stays as-is). */
export interface ButtonPreset {
  backgroundColor?: string;
  textColor?: string;
  border?: string;
}

export type ButtonPresets = Partial<
  Record<Exclude<ButtonVariant, 'custom'>, ButtonPreset>
>;

export interface ButtonLink {
  url: string;
  target?: ButtonLinkTarget;
  /** Auto-set to "noopener noreferrer" when target is "_blank". */
  rel?: string;
  ariaLabel?: string;
}

export interface ButtonFile {
  /** Strapi Media Library file id (when picked from the library). */
  id?: number;
  url: string;
  name: string;
  /** File size in bytes. */
  size?: number;
  /** File extension, e.g. ".pdf". */
  ext?: string;
  mime?: string;
}

/**
 * WordPress-style call-to-action button. A void block: its visual form is the
 * stored data (text + link/file + inline style), not editable rich text.
 */
export interface ButtonElement extends CustomElement {
  type: 'button';
  /** "link" → hyperlink, "file" → Media Library download. */
  buttonType: ButtonMode;
  /**
   * Visible button label. NOTE: must not be named `text` — Slate treats any node
   * with a string `text` property as a Text leaf, which would break this element.
   */
  label: string;
  alignment: ButtonAlignment;
  link?: ButtonLink;
  file?: ButtonFile;
  /** File mode: show the human-readable file size next to the label. */
  showFileSize?: boolean;
  /** File mode: show a file-type icon next to the label. */
  showFileIcon?: boolean;
  /**
   * File mode: when true, open the file in a new tab (preview) instead of
   * forcing a download. Renderers map this to `target="_blank"` vs `download`.
   */
  filePreview?: boolean;
  style?: ButtonStyle;
  /** Optional custom CSS class for frontend theming. */
  cssClass?: string;
  children: CustomText[];
}

export type Block<T extends string> = Extract<Node, { type: T }>;

// Utility functions
export const getEntries = <T extends object>(object: T) =>
  Object.entries(object) as [keyof T, T[keyof T]][];

export const getKeys = <T extends object>(object: T) =>
  Object.keys(object) as (keyof T)[];

export const isLinkNode = (element: CustomElement): element is LinkNode => {
  return element.type === 'link';
};

export const isListNode = (element: CustomElement): element is ListNode => {
  return element.type === 'list';
};

export const isMathNode = (element: CustomElement): element is MathElement => {
  return element.type === 'math';
};

export const isDiagramNode = (
  element: CustomElement
): element is DiagramElement => {
  return element.type === 'diagram';
};

export const isCalloutNode = (
  element: CustomElement
): element is CalloutElement => {
  return element.type === 'callout';
};

export const isDetailsNode = (
  element: CustomElement
): element is DetailsElement => {
  return element.type === 'details';
};

export const isButtonNode = (
  element: CustomElement
): element is ButtonElement => {
  return element.type === 'button';
};
