<script setup lang="ts">
/**
 * The button itself: a download/preview link for a file, a link for a URL, or a
 * styled span when the node carries neither.
 */
import { computed } from 'vue';

import type { ButtonElement } from './types';

import { formatFileSize, getButtonStyle, getFileIcon } from './utils';

const props = defineProps<{
  node: ButtonElement;
}>();

const style = computed(() => getButtonStyle(props.node.style));
const className = computed(() =>
  props.node.cssClass ? `bb-button ${props.node.cssClass}` : 'bb-button'
);

const file = computed(() => props.node.file);
const isFile = computed(() => props.node.buttonType === 'file' && !!file.value);
const filePreview = computed(() => isFile.value && props.node.filePreview === true);
const icon = computed(() =>
  isFile.value && props.node.showFileIcon && file.value ? getFileIcon(file.value) : null
);
const size = computed(() =>
  isFile.value && props.node.showFileSize && file.value && typeof file.value.size === 'number'
    ? formatFileSize(file.value.size)
    : null
);

/**
 * Force-downloads a cross-origin file.
 *
 * The native `download` attribute is ignored for cross-origin URLs (the common
 * case for Strapi/CDN assets), so browsers open renderable files (PDF, video,
 * images) inline instead of saving them. Fetching the asset and downloading it
 * from a same-origin object URL is what makes the button do what it says. A
 * CORS-blocked fetch falls back to plain navigation, and modifier clicks (open
 * in a new tab, …) are left to the browser.
 */
function download(event: MouseEvent): void {
  const url = file.value?.url;
  if (!url) return;
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  event.preventDefault();
  const name = file.value?.name ?? '';
  fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return response.blob();
    })
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      const temp = document.createElement('a');
      temp.href = objectUrl;
      temp.download = name;
      document.body.appendChild(temp);
      temp.click();
      temp.remove();
      URL.revokeObjectURL(objectUrl);
    })
    .catch(() => {
      window.location.href = url;
    });
}
</script>

<template>
  <!-- Preview mode - open the file in a new tab instead of downloading. -->
  <a
    v-if="isFile && file && filePreview"
    :href="file.url"
    target="_blank"
    rel="noopener noreferrer"
    :aria-label="`Preview ${file.name}`"
    :class="className"
    :style="style"
    ><span v-if="icon" class="bb-button-icon" aria-hidden="true">{{ icon }} </span>{{ node.label
    }}<span v-if="size" class="bb-button-size"> ({{ size }})</span></a
  >
  <!-- Download mode - the `download` attribute handles same-origin assets; the
       click handler force-downloads cross-origin ones. -->
  <a
    v-else-if="isFile && file"
    :href="file.url"
    :download="file.name"
    :aria-label="`Download ${file.name}`"
    :class="className"
    :style="style"
    @click="download"
    ><span v-if="icon" class="bb-button-icon" aria-hidden="true">{{ icon }} </span>{{ node.label
    }}<span v-if="size" class="bb-button-size"> ({{ size }})</span></a
  >
  <a
    v-else-if="node.link"
    :href="node.link.url"
    :target="node.link.target"
    :rel="node.link.rel"
    :aria-label="node.link.ariaLabel"
    :class="className"
    :style="style"
    >{{ node.label }}</a
  >
  <!-- No link/file payload - render the label as a styled, non-navigating span. -->
  <span v-else :class="className" :style="style">{{ node.label }}</span>
</template>

<style>
/* Smooth hover + visible keyboard focus. Hover colors come from the
   `--bb-button-hover-*` custom properties the renderer sets from
   `style.hoverBackgroundColor` / `hoverTextColor`; they fall back to the base
   color props so a button without hover colors doesn't change on hover.
   `!important` lets the rule win over the inline base colors. */
.bb-button {
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
.bb-button:hover {
  background-color: var(--bb-button-hover-bg, var(--bb-button-bg)) !important;
  color: var(--bb-button-hover-color, var(--bb-button-color)) !important;
}
.bb-button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
</style>
