import { Option } from './types';

export const COLORS_OPTIONS = [
  { label: 'Teal', value: '#57BAA2' },
  { label: 'Dark', value: '#1D1D1D' },
  { label: 'Gray', value: '#757575' },
  { label: 'Light Gray', value: '#f5f5f5' },
  { label: 'Silver', value: '#e0e0e0' },
  { label: 'Medium Gray', value: '#878787' },
  { label: 'White', value: '#FFFFFF' },
];

export const BG_COLORS_OPTIONS = [
  { label: 'Yellow', value: '#FFE066' },
  { label: 'Green', value: '#8CE99A' },
  { label: 'Blue', value: '#74C0FC' },
  { label: 'Pink', value: '#FFA8B8' },
  { label: 'Purple', value: '#B197FC' },
  { label: 'Orange', value: '#FFC078' },
  { label: 'Gray', value: '#CED4DA' },
  { label: 'Teal', value: '#63E6BE' },
  { label: 'Red', value: '#FF8787' },
  { label: 'Cyan', value: '#66D9E8' },
];

// Font Family Options
export const FONT_FAMILY_OPTIONS: Option[] = [
  { label: 'Arial', value: 'arial' },
  { label: 'Open Sans', value: 'open-sans' },
  { label: 'Times New Roman', value: 'times-new-roman' },
  { label: 'Georgia', value: 'georgia' },
];

// Font Size Options
export const FONT_SIZE_OPTIONS: Option[] = [
  { label: '6', value: '6' },
  { label: '8', value: '8' },
  { label: '9', value: '9' },
  { label: '10', value: '10' },
  { label: '11', value: '11' },
  { label: '12', value: '12', isDefault: true },
  { label: '14', value: '14' },
  { label: '16', value: '16' },
  { label: '18', value: '18' },
  { label: '24', value: '24' },
  { label: '30', value: '30' },
  { label: '48', value: '48' },
  { label: '60', value: '60' },
  { label: '72', value: '72' },
  { label: '150', value: '150' },
  { label: '300', value: '300' },
];

// Font Leading Options
export const FONT_LEADING_OPTIONS: Option[] = [
  { label: '6', value: '6' },
  { label: '8', value: '8' },
  { label: '9', value: '9' },
  { label: '10', value: '10' },
  { label: '11', value: '11' },
  { label: '12', value: '12' },
  { label: '14', value: '14' },
  { label: '16', value: '16' },
  { label: '18', value: '18' },
  { label: '24', value: '24', isDefault: true },
  { label: '30', value: '30' },
  { label: '48', value: '48' },
  { label: '60', value: '60' },
  { label: '72', value: '72' },
  { label: '150', value: '150' },
  { label: '300', value: '300' },
];

// Font Tracking Options
export const FONT_TRACKING_OPTIONS: Option[] = [
  { value: '-100', label: '-100' },
  { value: '-75', label: '-75' },
  { value: '-50', label: '-50' },
  { value: '-25', label: '-25' },
  { value: '-10', label: '-10' },
  { value: '-5', label: '-5' },
  { value: '0', label: '0', isDefault: true },
  { value: '5', label: '5' },
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '75', label: '75' },
  { value: '100', label: '100' },
  { value: '200', label: '200' },
];

// Font Alignment Options
export const FONT_ALIGNMENT_OPTIONS: Option[] = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
  { label: 'Justify', value: 'justify' },
];

// Viewport Options
export const VIEWPORT_OPTIONS: Option[] = [
  { label: 'Mobile', value: 'mobile' },
  { label: 'Tablet', value: 'tablet' },
  { label: 'Desktop', value: 'desktop' },
];

// Separator Style Options
export const SEPARATOR_STYLE_OPTIONS: Option[] = [
  { label: 'Solid', value: 'solid', isDefault: true },
  { label: 'Dashed', value: 'dashed' },
  { label: 'Dotted', value: 'dotted' },
  { label: 'Double', value: 'double' },
];

// Separator Orientation Options
export const SEPARATOR_ORIENTATION_OPTIONS: Option[] = [
  { label: 'Horizontal', value: 'horizontal', isDefault: true },
  { label: 'Vertical', value: 'vertical' },
];

// Default global values
export const DEFAULT_COLOR = COLORS_OPTIONS[0].value;

// Default fonts values
export const DEFAULT_FONT_FAMILY = FONT_FAMILY_OPTIONS[0].value;
export const DEFAULT_FONT_SIZE = FONT_SIZE_OPTIONS[0].value;
export const DEFAULT_FONT_LEADING = FONT_LEADING_OPTIONS[0].value;
export const DEFAULT_FONT_ALIGNMENT = FONT_ALIGNMENT_OPTIONS[0].value;
export const DEFAULT_FONT_TRACKING = FONT_TRACKING_OPTIONS[6].value;
export const DEFAULT_VIEWPORT = VIEWPORT_OPTIONS[0].value;

// Default separator values
export const DEFAULT_SEPARATOR_SIZE = 1;
export const DEFAULT_SEPARATOR_STYLE = SEPARATOR_STYLE_OPTIONS[0].value;
export const DEFAULT_SEPARATOR_ORIENTATION =
  SEPARATOR_ORIENTATION_OPTIONS[0].value;
export const DEFAULT_SEPARATOR_LENGTH = 100;
