<script setup lang="ts">
/**
 * A GitHub-style alert: an accent bar, an octicon, a title, and blocks inside.
 */
import { computed } from 'vue';

import type {
  CalloutNode,
  CalloutVariant,
  CustomBlocksConfig,
  CustomModifiersConfig,
  DiagramTheme,
  VueBlockPlugin,
} from './types';

import Block from './Block.vue';
import { rawComponent } from './utils';

const props = defineProps<{
  node: CalloutNode;
  blocks?: CustomBlocksConfig;
  modifiers?: CustomModifiersConfig;
  diagramTheme?: DiagramTheme;
  codeTheme?: string;
  codeCopyButton?: boolean;
  blockPlugins?: readonly VueBlockPlugin[];
}>();

// GitHub-style alert metadata: default label and octicon path. Accent colors
// live in the stylesheet below (GitHub light palette, matching the other renderers).
const VARIANTS: Record<CalloutVariant, { label: string; icon: string }> = {
  note: {
    label: 'Note',
    icon: 'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  },
  tip: {
    label: 'Tip',
    icon: 'M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z',
  },
  important: {
    label: 'Important',
    icon: 'M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  },
  warning: {
    label: 'Warning',
    icon: 'M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  },
  caution: {
    label: 'Caution',
    icon: 'M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .39.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.39.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  },
};

const CalloutComp = computed(() => rawComponent(props.blocks?.callout));
const variant = computed<CalloutVariant>(() =>
  VARIANTS[props.node.variant] ? props.node.variant : 'note'
);
const meta = computed(() => VARIANTS[variant.value]);
const title = computed(() => (props.node.title?.trim() ? props.node.title : meta.value.label));
</script>

<template>
  <component :is="CalloutComp" v-if="CalloutComp" :variant="variant" :title="node.title">
    <Block
      v-for="(child, index) in node.children"
      :key="index"
      :block="child"
      :blocks="blocks"
      :modifiers="modifiers"
      :diagram-theme="diagramTheme"
      :code-theme="codeTheme"
      :code-copy-button="codeCopyButton"
      :block-plugins="blockPlugins"
      :index="index"
    />
  </component>
  <aside v-else :class="`bb-callout bb-callout-${variant}`" role="note">
    <p class="bb-callout-title">
      <svg class="bb-callout-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path :d="meta.icon" />
      </svg>
      {{ title }}
    </p>
    <div class="bb-callout-body">
      <Block
        v-for="(child, index) in node.children"
        :key="index"
        :block="child"
        :blocks="blocks"
        :modifiers="modifiers"
        :diagram-theme="diagramTheme"
        :code-theme="codeTheme"
        :code-copy-button="codeCopyButton"
        :block-plugins="blockPlugins"
        :index="index"
      />
    </div>
  </aside>
</template>

<style>
.bb-callout {
  border-left: 0.25rem solid var(--bb-callout-accent, #0969da);
  /* Subtle accent-tinted background (~8% opacity) to match the editor preview. */
  background-color: color-mix(in srgb, var(--bb-callout-accent, #0969da) 8%, transparent);
  padding: 0.5rem 1rem;
  margin: 1rem 0;
}
.bb-callout-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  /* GitHub spacing: tight title line with a 1rem gap before the body. */
  line-height: 1;
  margin: 0 0 1rem;
  font-weight: 600;
  /* GitHub's caution variant uses a slightly different title color than its
     accent/border, so allow an optional per-variant title override. */
  color: var(--bb-callout-title-color, var(--bb-callout-accent, #0969da));
}
.bb-callout-icon {
  width: 16px;
  height: 16px;
  flex: none;
  fill: currentColor;
}
/* Collapse the body's outer margins so the content sits flush within the
   callout padding (top/bottom balanced). */
.bb-callout-body > :first-child {
  margin-top: 0;
}
.bb-callout-body > :last-child {
  margin-bottom: 0;
}

/* Accent colors (GitHub light palette) - matches the other renderers. */
.bb-callout-note {
  --bb-callout-accent: #0969da;
}
.bb-callout-tip {
  --bb-callout-accent: #1a7f37;
}
.bb-callout-important {
  --bb-callout-accent: #8250df;
}
.bb-callout-warning {
  --bb-callout-accent: #9a6700;
}
.bb-callout-caution {
  --bb-callout-accent: #cf222e;
  --bb-callout-title-color: #d1242f;
}
</style>
