import type { ButtonFile } from './types';

// ── File Icons & Sizes ───────────────────────────────────────────────

// Emoji icons keyed by file extension (falls back to a MIME-type group, then a
// generic paperclip). Mirrors the icon mapping in the editor's button modal.
const FILE_ICONS: Record<string, string> = {
  pdf: '📄',
  doc: '📝',
  docx: '📝',
  txt: '📃',
  md: '📃',
  rtf: '📃',
  xls: '📊',
  xlsx: '📊',
  csv: '📊',
  ppt: '📽️',
  pptx: '📽️',
  zip: '🗜️',
  rar: '🗜️',
  '7z': '🗜️',
  gz: '🗜️',
  tar: '🗜️',
  png: '🖼️',
  jpg: '🖼️',
  jpeg: '🖼️',
  gif: '🖼️',
  svg: '🖼️',
  webp: '🖼️',
  mp3: '🎵',
  wav: '🎵',
  ogg: '🎵',
  mp4: '🎬',
  mov: '🎬',
  avi: '🎬',
  webm: '🎬',
};

/** Emoji icon for a file, by extension then MIME group, with a generic fallback. */
export function getFileIcon(file: ButtonFile): string {
  const ext = (file.ext ?? '').replace(/^\./, '').toLowerCase();
  if (ext && FILE_ICONS[ext]) return FILE_ICONS[ext];

  const mime = file.mime ?? '';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.startsWith('video/')) return '🎬';
  if (mime === 'application/pdf') return '📄';
  return '📎';
}

/** Human-readable byte size, e.g. 5242880 → "5 MB". */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  const rounded = i === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[i]}`;
}
