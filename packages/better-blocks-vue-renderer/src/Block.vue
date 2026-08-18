<script setup lang="ts">
/**
 * One block, dispatched on its type.
 *
 * Registered types (`blockPlugins`) are checked first and cannot shadow a
 * built-in - the core registry rejects that at construction - so everything
 * after the first branch dispatches over the closed built-in union.
 */
import { computed } from 'vue';

import type {
  AnyBlockNode,
  BlockNode,
  ButtonElement,
  CustomBlockNode,
  CustomBlocksConfig,
  CustomModifiersConfig,
  DiagramTheme,
  HeadingNode,
  ImageNode,
  InlineNode,
  MediaEmbedNode,
  VueBlockPlugin,
} from './types';

import Audio from './Audio.vue';
import Button from './Button.vue';
import Callout from './Callout.vue';
import Code from './Code.vue';
import Details from './Details.vue';
import Diagram from './Diagram.vue';
import Embed from './Embed.vue';
import Inline from './Inline.vue';
import List from './List.vue';
import Math from './Math.vue';
import Quote from './Quote.vue';
import SocialEmbed from './SocialEmbed.vue';
import Table from './Table.vue';
import Video from './Video.vue';
import { getBlockStyle, rawComponent } from './utils';

const props = defineProps<{
  block: AnyBlockNode;
  blocks?: CustomBlocksConfig;
  modifiers?: CustomModifiersConfig;
  diagramTheme?: DiagramTheme;
  /** Shiki theme for default `code` blocks. */
  codeTheme?: string;
  /** Whether default `code` blocks render an opt-in copy button. */
  codeCopyButton?: boolean;
  /** Position among sibling blocks - forwarded to blocks that need a stable key. */
  index?: number;
  /** Block types from other packages. Threaded down so they work at any depth. */
  blockPlugins?: readonly VueBlockPlugin[];
}>();

const plugin = computed(() =>
  props.blockPlugins?.find((candidate) => candidate.type === props.block.type)
);
const PluginComp = computed(() => rawComponent(plugin.value?.component));
const pluginContent = computed(() => plugin.value?.content ?? 'void');
const customBlock = computed(() => props.block as CustomBlockNode);
// The children of a registered block, cast once here to keep the template free
// of type assertions. Which of the two the template uses follows `content`.
const pluginChildren = computed<unknown[]>(() =>
  Array.isArray(customBlock.value.children) ? customBlock.value.children : []
);
const pluginBlocks = computed(() => pluginChildren.value as AnyBlockNode[]);
const pluginInlines = computed(() => pluginChildren.value as InlineNode[]);

// Narrowed views of the node, one per branch that needs more than `type`.
const block = computed(() => props.block as BlockNode);
const heading = computed(() => props.block as HeadingNode);
const image = computed(() => props.block as ImageNode);
const mediaEmbed = computed(() => props.block as MediaEmbedNode);
const button = computed(() => props.block as ButtonElement);

// The custom renderers, hoisted so each branch tests and passes one value.
const ParagraphComp = computed(() => rawComponent(props.blocks?.paragraph));
const HeadingComp = computed(() => rawComponent(props.blocks?.heading));
const ImageComp = computed(() => rawComponent(props.blocks?.image));
const HrComp = computed(() => rawComponent(props.blocks?.['horizontal-line']));
const MediaEmbedComp = computed(() => rawComponent(props.blocks?.['media-embed']));

// `getBlockStyle` only reads alignment/line-height/indent, which every block
// may carry, so one cast serves the paragraph and heading branches.
const blockStyle = computed(() =>
  getBlockStyle(props.block as { textAlign?: string; lineHeight?: string; indent?: number })
);
// Bound as a whole object rather than `:style`, so a block with no alignment,
// line-height or indent renders with no `style` attribute at all - a bare
// `:style="undefined"` would still emit an empty one on the server.
const styleAttrs = computed(() => (blockStyle.value ? { style: blockStyle.value } : {}));
const headingTag = computed(() => `h${heading.value.level}`);
const imageAlign = computed(() => image.value.imageAlign || 'center');
</script>

<template>
  <!-- A registered block type: its own component draws it, and this renderer
       only decides what to hand it as children. -->
  <component :is="PluginComp" v-if="plugin && pluginContent === 'void'" :node="customBlock" />
  <component :is="PluginComp" v-else-if="plugin && pluginContent === 'inline'" :node="customBlock">
    <Inline :nodes="pluginInlines" :blocks="blocks" :modifiers="modifiers" />
  </component>
  <component :is="PluginComp" v-else-if="plugin" :node="customBlock">
    <Block
      v-for="(child, childIndex) in pluginBlocks"
      :key="childIndex"
      :block="child"
      :blocks="blocks"
      :modifiers="modifiers"
      :diagram-theme="diagramTheme"
      :code-theme="codeTheme"
      :code-copy-button="codeCopyButton"
      :block-plugins="blockPlugins"
      :index="childIndex"
    />
  </component>

  <component
    :is="ParagraphComp"
    v-else-if="block.type === 'paragraph' && ParagraphComp"
    v-bind="styleAttrs"
  >
    <Inline :nodes="block.children" :blocks="blocks" :modifiers="modifiers" />
  </component>
  <p v-else-if="block.type === 'paragraph'" v-bind="styleAttrs">
    <Inline :nodes="block.children" :blocks="blocks" :modifiers="modifiers" />
  </p>

  <component
    :is="HeadingComp"
    v-else-if="block.type === 'heading' && HeadingComp"
    :level="heading.level"
    v-bind="styleAttrs"
  >
    <Inline :nodes="heading.children" :blocks="blocks" :modifiers="modifiers" />
  </component>
  <component :is="headingTag" v-else-if="block.type === 'heading'" v-bind="styleAttrs">
    <Inline :nodes="heading.children" :blocks="blocks" :modifiers="modifiers" />
  </component>

  <List v-else-if="block.type === 'list'" :node="block" :blocks="blocks" :modifiers="modifiers" />

  <Quote v-else-if="block.type === 'quote'" :node="block" :blocks="blocks" :modifiers="modifiers" />

  <Code
    v-else-if="block.type === 'code'"
    :node="block"
    :blocks="blocks"
    :code-theme="codeTheme"
    :code-copy-button="codeCopyButton"
  />

  <component
    :is="ImageComp"
    v-else-if="block.type === 'image' && ImageComp"
    :image="image.image"
    :caption="image.caption"
    :image-align="image.imageAlign"
  />
  <figure v-else-if="block.type === 'image'" :style="{ textAlign: imageAlign }">
    <img
      :src="image.image.url"
      :alt="image.image.alternativeText || ''"
      :width="image.image.width"
      :height="image.image.height"
    />
    <figcaption v-if="image.caption">{{ image.caption }}</figcaption>
  </figure>

  <component :is="HrComp" v-else-if="block.type === 'horizontal-line' && HrComp" />
  <hr v-else-if="block.type === 'horizontal-line'" />

  <Table v-else-if="block.type === 'table'" :node="block" :blocks="blocks" :modifiers="modifiers" />

  <component
    :is="MediaEmbedComp"
    v-else-if="block.type === 'media-embed' && MediaEmbedComp"
    :url="mediaEmbed.url"
    :original-url="mediaEmbed.originalUrl"
  />
  <div
    v-else-if="block.type === 'media-embed'"
    :style="{ position: 'relative', paddingBottom: '56.25%', height: '0' }"
  >
    <iframe
      :src="mediaEmbed.url"
      :style="{
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        border: '0',
      }"
      allowfullscreen
      title="Embedded media"
    ></iframe>
  </div>

  <Math v-else-if="block.type === 'math'" :node="block" :blocks="blocks" />

  <Diagram
    v-else-if="block.type === 'diagram'"
    :node="block"
    :blocks="blocks"
    :diagram-theme="diagramTheme"
  />

  <Callout
    v-else-if="block.type === 'callout'"
    :node="block"
    :blocks="blocks"
    :modifiers="modifiers"
    :diagram-theme="diagramTheme"
    :code-theme="codeTheme"
    :code-copy-button="codeCopyButton"
    :block-plugins="blockPlugins"
  />

  <Details
    v-else-if="block.type === 'details'"
    :node="block"
    :blocks="blocks"
    :modifiers="modifiers"
    :diagram-theme="diagramTheme"
    :code-theme="codeTheme"
    :code-copy-button="codeCopyButton"
    :block-plugins="blockPlugins"
  />

  <Button v-else-if="block.type === 'button'" :node="button" :blocks="blocks" />

  <SocialEmbed v-else-if="block.type === 'social-embed'" :node="block" :blocks="blocks" />

  <Audio v-else-if="block.type === 'audio'" :node="block" :blocks="blocks" :index="index" />

  <Embed v-else-if="block.type === 'embed'" :node="block" :blocks="blocks" />

  <Video v-else-if="block.type === 'video'" :node="block" :blocks="blocks" :index="index" />
</template>
