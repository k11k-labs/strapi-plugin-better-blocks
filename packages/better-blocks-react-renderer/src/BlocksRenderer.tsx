import {
  Fragment,
  cloneElement,
  createElement,
  isValidElement,
  type ComponentType,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import katex from 'katex';
import {
  buildTextMarks,
  formatFileSize,
  getBlockStyle as coreGetBlockStyle,
  getDefaultMarkRender,
  getFileIcon,
  getListStyleType,
  getModifierProps,
  getPlainText,
} from '@k11k/better-blocks-core';

import {
  MEDIA_CAPTION_STYLE,
  getAspectRatio,
  getMediaFigureStyle,
  getMediaFrameStyle,
} from './media';
import { CodeBlock } from './CodeBlock';
import { MermaidDiagram } from './MermaidDiagram';
import { SocialEmbed } from './SocialEmbed';
import { Video } from './Video';
import type {
  AudioAlignment,
  AudioNode,
  BlockNode,
  BlocksRendererProps,
  ButtonElement,
  ButtonFile,
  ButtonStyle,
  CalloutNode,
  CalloutVariant,
  CodeNode,
  CustomBlocksConfig,
  CustomModifiersConfig,
  DetailsNode,
  DiagramNode,
  EmbedNode,
  HeadingNode,
  HorizontalLineNode,
  ImageNode,
  InlineNode,
  ListItemNode,
  ListNode,
  MathNode,
  MediaAlignment,
  MediaEmbedNode,
  ParagraphNode,
  QuoteNode,
  SocialEmbedNode,
  TableNode,
  TableRowNode,
  TextNode,
  VideoNode,
} from './types';

// ── Text / Modifier Rendering ────────────────────────────────────────

function renderTextNode(node: TextNode, key: number, modifiers?: CustomModifiersConfig): ReactNode {
  // The core decides which marks are active and in what order they nest; this
  // renderer only turns each one into an element. Marks come back outer → inner,
  // so wrapping from the end inwards reproduces the original nesting exactly.
  const marks = buildTextMarks(node);

  let content: ReactNode = node.text;
  for (let i = marks.length - 1; i >= 0; i -= 1) {
    const mark = marks[i];
    const Comp = modifiers?.[mark.name as keyof CustomModifiersConfig] as
      ComponentType<Record<string, unknown> & { children?: ReactNode }> | undefined;

    if (Comp) {
      content = <Comp {...getModifierProps(mark)}>{content}</Comp>;
      continue;
    }

    const { tag, style } = getDefaultMarkRender(mark);
    content = createElement(tag, { style: style as CSSProperties | undefined }, content);
  }

  return <Fragment key={key}>{content}</Fragment>;
}

// ── Math (KaTeX) Rendering ───────────────────────────────────────────

function renderMath(node: MathNode, key: number, blocks?: CustomBlocksConfig): ReactNode {
  const isBlock = node.format === 'block';
  const MathComp = blocks?.math;
  const formula = node.value ?? '';

  if (MathComp) {
    return <MathComp key={key} formula={formula} inline={!isBlock} />;
  }

  const Tag = isBlock ? 'div' : 'span';
  const className = isBlock ? 'katex-block' : 'katex-inline';

  // KaTeX renders to an HTML string (SSR-friendly). With `throwOnError: false`
  // it renders parse errors inline instead of throwing; the try/catch is a
  // last-resort guard that falls back to the raw LaTeX source.
  try {
    const html = katex.renderToString(formula, {
      displayMode: isBlock,
      throwOnError: false,
    });
    return <Tag key={key} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return (
      <Tag key={key} className={className}>
        {formula}
      </Tag>
    );
  }
}

// ── Inline Rendering ─────────────────────────────────────────────────

function renderInlineContent(
  children: InlineNode[],
  blocks?: CustomBlocksConfig,
  modifiers?: CustomModifiersConfig
): ReactNode {
  return children.map((child, index) => {
    if (child.type === 'text') {
      return renderTextNode(child, index, modifiers);
    }

    if (child.type === 'math') {
      return renderMath(child, index, blocks);
    }

    if (child.type === 'link') {
      const LinkComp = blocks?.link;
      const linkChildren = child.children.map((textNode, i) =>
        renderTextNode(textNode, i, modifiers)
      );

      return LinkComp ? (
        <LinkComp key={index} url={child.url} target={child.target} rel={child.rel}>
          {linkChildren}
        </LinkComp>
      ) : (
        <a key={index} href={child.url} target={child.target} rel={child.rel}>
          {linkChildren}
        </a>
      );
    }

    return null;
  });
}

// ── List Rendering ───────────────────────────────────────────────────

function renderListItem(
  node: ListItemNode,
  key: number,
  isTodo: boolean,
  blocks?: CustomBlocksConfig,
  modifiers?: CustomModifiersConfig
): ReactNode {
  const ListItemComp = blocks?.['list-item'];
  const children = renderInlineContent(node.children, blocks, modifiers);

  if (ListItemComp) {
    return (
      <ListItemComp key={key} checked={isTodo ? node.checked : undefined}>
        {children}
      </ListItemComp>
    );
  }

  if (isTodo) {
    const checked = node.checked ?? false;
    return (
      <li key={key} style={{ listStyle: 'none' }}>
        <input type="checkbox" checked={checked} readOnly style={{ marginRight: '0.5em' }} />
        <span style={checked ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>
          {children}
        </span>
      </li>
    );
  }

  return <li key={key}>{children}</li>;
}

function renderList(
  node: ListNode,
  key: number,
  blocks?: CustomBlocksConfig,
  modifiers?: CustomModifiersConfig
): ReactNode {
  const ListComp = blocks?.list;
  const indentLevel = node.indentLevel || 0;
  const isTodo = node.format === 'todo';
  const children = node.children.map((child, index) => {
    if (child.type === 'list-item') {
      return renderListItem(child, index, isTodo, blocks, modifiers);
    }
    if (child.type === 'list') {
      return renderList(child, index, blocks, modifiers);
    }
    return null;
  });

  if (ListComp) {
    return (
      <ListComp key={key} format={node.format} indentLevel={indentLevel}>
        {children}
      </ListComp>
    );
  }

  if (isTodo) {
    return (
      <ul key={key} style={{ listStyle: 'none', paddingLeft: indentLevel > 0 ? '1.5em' : 0 }}>
        {children}
      </ul>
    );
  }

  const Tag = node.format === 'ordered' ? 'ol' : 'ul';
  const listStyleType = getListStyleType(node.format as 'ordered' | 'unordered', indentLevel);
  return (
    <Tag key={key} style={{ listStyleType }}>
      {children}
    </Tag>
  );
}

// ── Table Rendering ──────────────────────────────────────────────────

function renderTable(
  block: TableNode,
  key: number,
  blocks?: CustomBlocksConfig,
  modifiers?: CustomModifiersConfig
): ReactNode {
  const TableComp = blocks?.table;
  const RowComp = blocks?.['table-row'];
  const CellComp = blocks?.['table-cell'];
  const HeaderCellComp = blocks?.['table-header-cell'];

  // Leading rows made up entirely of header cells are the table's header; they go
  // in <thead> so screen readers announce them. A merged header (a `rowSpan` label
  // above a split sub-header) spans several such rows, so count them all.
  let headerRowCount = 0;
  while (isHeaderRow(block.children[headerRowCount])) headerRowCount++;

  const rows = block.children.map((row, rowIndex) => {
    const inHeader = rowIndex < headerRowCount;

    const cells = row.children.map((cell, cellIndex) => {
      const cellChildren = renderInlineContent(cell.children, blocks, modifiers);
      const isHeader = cell.type === 'table-header-cell';
      // Absent means left / 1 — omit rather than emit a redundant attribute.
      const style = cell.align ? { textAlign: cell.align } : undefined;
      const cellProps = {
        align: cell.align,
        colSpan: cell.colSpan,
        rowSpan: cell.rowSpan,
        style,
      };

      if (isHeader && HeaderCellComp) {
        return (
          <HeaderCellComp key={cellIndex} {...cellProps}>
            {cellChildren}
          </HeaderCellComp>
        );
      }
      if (!isHeader && CellComp) {
        return (
          <CellComp key={cellIndex} {...cellProps}>
            {cellChildren}
          </CellComp>
        );
      }

      return isHeader ? (
        <th
          key={cellIndex}
          // A header cell in the <thead> labels a column; one that appears in a
          // body row is a row header instead.
          scope={inHeader ? 'col' : 'row'}
          colSpan={cell.colSpan}
          rowSpan={cell.rowSpan}
          style={style}
        >
          {cellChildren}
        </th>
      ) : (
        <td key={cellIndex} colSpan={cell.colSpan} rowSpan={cell.rowSpan} style={style}>
          {cellChildren}
        </td>
      );
    });

    return RowComp ? <RowComp key={rowIndex}>{cells}</RowComp> : <tr key={rowIndex}>{cells}</tr>;
  });

  if (TableComp) {
    return <TableComp key={key}>{rows}</TableComp>;
  }

  return (
    <table key={key} className="bb-table">
      {headerRowCount > 0 && <thead>{rows.slice(0, headerRowCount)}</thead>}
      {rows.length > headerRowCount && <tbody>{rows.slice(headerRowCount)}</tbody>}
    </table>
  );
}

function isHeaderRow(row: TableRowNode | undefined): boolean {
  return (
    !!row && row.children.length > 0 && row.children.every((c) => c.type === 'table-header-cell')
  );
}

// ── Block Rendering ──────────────────────────────────────────────────

/**
 * Renderer-wide settings that only some blocks consume. Passed as one object
 * rather than loose parameters so it can be threaded through the blocks that
 * nest others (callout, details) without widening every signature further.
 */
type RenderOptions = {
  codeTheme: string;
  codeCopyButton: boolean;
};

function renderBlock(
  block: BlockNode,
  key: number,
  blocks?: CustomBlocksConfig,
  modifiers?: CustomModifiersConfig,
  options?: RenderOptions
): ReactNode {
  switch (block.type) {
    case 'paragraph':
      return renderParagraph(block, key, blocks, modifiers);
    case 'heading':
      return renderHeading(block, key, blocks, modifiers);
    case 'list':
      return renderList(block, key, blocks, modifiers);
    case 'quote':
      return renderQuote(block, key, blocks, modifiers);
    case 'code':
      return renderCode(block, key, blocks, options);
    case 'image':
      return renderImage(block, key, blocks);
    case 'horizontal-line':
      return renderHorizontalLine(block, key, blocks);
    case 'table':
      return renderTable(block, key, blocks, modifiers);
    case 'media-embed':
      return renderMediaEmbed(block, key, blocks);
    case 'embed':
      return renderEmbed(block, key, blocks);
    case 'video':
      return renderVideo(block, key, blocks);
    case 'math':
      return renderMath(block, key, blocks);
    case 'diagram':
      return renderDiagram(block, key, blocks);
    case 'callout':
      return renderCallout(block, key, blocks, modifiers, options);
    case 'details':
      return renderDetails(block, key, blocks, modifiers, options);
    case 'button':
      return renderButton(block, key, blocks);
    case 'social-embed':
      return renderSocialEmbed(block, key, blocks);
    case 'audio':
      return renderAudio(block, key, blocks);
    default:
      return null;
  }
}

function getBlockStyle(block: {
  textAlign?: string;
  lineHeight?: string;
  indent?: number;
}): CSSProperties | undefined {
  // The core returns a neutral style record; React just needs it typed.
  return coreGetBlockStyle(block) as CSSProperties | undefined;
}

function renderParagraph(
  block: ParagraphNode,
  key: number,
  blocks?: CustomBlocksConfig,
  modifiers?: CustomModifiersConfig
): ReactNode {
  const ParagraphComp = blocks?.paragraph;
  const children = renderInlineContent(block.children, blocks, modifiers);
  const style = getBlockStyle(block);

  return ParagraphComp ? (
    <ParagraphComp key={key} style={style}>
      {children}
    </ParagraphComp>
  ) : (
    <p key={key} style={style}>
      {children}
    </p>
  );
}

function renderHeading(
  block: HeadingNode,
  key: number,
  blocks?: CustomBlocksConfig,
  modifiers?: CustomModifiersConfig
): ReactNode {
  const HeadingComp = blocks?.heading;
  const children = renderInlineContent(block.children, blocks, modifiers);
  const style = getBlockStyle(block);

  if (HeadingComp) {
    return (
      <HeadingComp key={key} level={block.level} style={style}>
        {children}
      </HeadingComp>
    );
  }

  const Tag = `h${block.level}` as const;
  return (
    <Tag key={key} style={style}>
      {children}
    </Tag>
  );
}

function renderQuote(
  block: QuoteNode,
  key: number,
  blocks?: CustomBlocksConfig,
  modifiers?: CustomModifiersConfig
): ReactNode {
  const QuoteComp = blocks?.quote;
  const children = renderInlineContent(block.children, blocks, modifiers);
  const style = getBlockStyle(block);

  return QuoteComp ? (
    <QuoteComp key={key} style={style}>
      {children}
    </QuoteComp>
  ) : (
    <blockquote key={key} className="bb-quote" style={style}>
      {children}
    </blockquote>
  );
}

const DEFAULT_CODE_THEME = 'github-dark';

function renderCode(
  block: CodeNode,
  key: number,
  blocks?: CustomBlocksConfig,
  options?: RenderOptions
): ReactNode {
  const CodeComp = blocks?.code;
  const plainText = getPlainText(block.children);

  if (CodeComp) {
    // Custom renderers get the raw editor value, not the Shiki grammar id, so
    // they can map it to whatever highlighter they use.
    return (
      <CodeComp key={key} plainText={plainText} language={block.language}>
        {plainText}
      </CodeComp>
    );
  }

  return (
    <CodeBlock
      key={key}
      plainText={plainText}
      language={block.language}
      theme={options?.codeTheme ?? DEFAULT_CODE_THEME}
      copyButton={options?.codeCopyButton ?? false}
    />
  );
}

// ── GitHub-style Table / Quote / Code Styling ────────────────────────
//
// Kept in sync with the Astro renderer so one shared theme covers both. These
// are classes rather than inline styles for two reasons: `nth-child` striping
// and `:hover` can't be expressed inline, and inline styles would outrank a
// consumer's own CSS, defeating the `--bb-*` custom properties below.

// Bordered cells, a shaded header, zebra-striped body rows, and horizontal
// scroll on overflow. `display:block` is what makes the table scrollable.
const TABLE_CSS =
  '.bb-table{display:block;width:max-content;max-width:100%;margin:1rem 0;overflow:auto;' +
  'border-collapse:collapse;border-spacing:0;border:1px solid var(--bb-table-border,#d0d7de)}' +
  '.bb-table th,.bb-table td{padding:.375rem .8125rem;' +
  'border:1px solid var(--bb-table-border,#d0d7de);text-align:left}' +
  '.bb-table th{font-weight:600;background:var(--bb-table-header-bg,#f6f8fa)}' +
  '.bb-table tbody tr{background:var(--bb-table-row-bg,#fff)}' +
  '.bb-table tbody tr:nth-child(2n){background:var(--bb-table-stripe-bg,#f6f8fa)}';

// A muted left border with indented, dimmed text — GitHub's markdown quote,
// which has no background fill.
const QUOTE_CSS =
  '.bb-quote{margin:1rem 0;padding:0 1rem;color:var(--bb-quote-fg,#57606a);' +
  'border-left:.25rem solid var(--bb-quote-border,#d0d7de)}';

// Shiki inlines the theme's background and text colors onto the `<pre>` it
// generates, so we only add padding, rounding, and typography around it. The
// pre-highlight fallback `<pre>` has no such inline colors, so it carries its
// own — defaulting to the github-dark values to match DEFAULT_CODE_THEME.
// Retheme them alongside `codeTheme` via --bb-code-fallback-*.
const CODE_CSS =
  '.bb-code{position:relative;margin:1rem 0}' +
  '.bb-code pre{margin:0;padding:1rem;border-radius:6px;font-size:.875rem;' +
  'line-height:1.45;tab-size:2;overflow-x:auto}' +
  '.bb-code-pre{background:var(--bb-code-fallback-bg,#24292e);' +
  'color:var(--bb-code-fallback-fg,#e1e4e8)}' +
  '.bb-code-copy{position:absolute;top:.5rem;right:.5rem;padding:.25rem .5rem;' +
  'font-size:.75rem;line-height:1;color:var(--bb-code-copy-fg,#e1e4e8);' +
  'background:var(--bb-code-copy-bg,rgba(110,118,129,.4));' +
  'border:1px solid var(--bb-code-copy-border,rgba(240,246,252,.1));' +
  'border-radius:6px;cursor:pointer;opacity:0;transition:opacity .15s ease,background .15s ease}' +
  '.bb-code:hover .bb-code-copy,.bb-code-copy:focus-visible{opacity:1}' +
  '.bb-code-copy:hover{background:var(--bb-code-copy-hover-bg,rgba(110,118,129,.6))}';

function renderImage(block: ImageNode, key: number, blocks?: CustomBlocksConfig): ReactNode {
  const ImageComp = blocks?.image;

  if (ImageComp) {
    return (
      <ImageComp
        key={key}
        image={block.image}
        caption={block.caption}
        imageAlign={block.imageAlign}
      />
    );
  }

  const align = block.imageAlign || 'center';
  const alignStyle: CSSProperties = {
    textAlign: align,
  };

  return (
    <figure key={key} style={alignStyle}>
      <img
        src={block.image.url}
        alt={block.image.alternativeText || ''}
        width={block.image.width}
        height={block.image.height}
      />
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  );
}

function renderHorizontalLine(
  _block: HorizontalLineNode,
  key: number,
  blocks?: CustomBlocksConfig
): ReactNode {
  const HrComp = blocks?.['horizontal-line'];
  return HrComp ? <HrComp key={key} /> : <hr key={key} />;
}

function renderMediaEmbed(
  block: MediaEmbedNode,
  key: number,
  blocks?: CustomBlocksConfig
): ReactNode {
  const EmbedComp = blocks?.['media-embed'];

  if (EmbedComp) {
    return <EmbedComp key={key} url={block.url} originalUrl={block.originalUrl} />;
  }

  return (
    <div key={key} style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
      <iframe
        src={block.url}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
        allowFullScreen
        title="Embedded media"
      />
    </div>
  );
}

// ── Embed (Generic iframe) Rendering ─────────────────────────────────

// The sanitized `embedHtml` carries the provider's own width/height, so make
// the iframe fill the aspect-ratio box instead. Inline styles can't reach into
// `dangerouslySetInnerHTML` markup, so this ships as a stylesheet — injected
// only when the content actually renders a default embed.
const EMBED_FRAME_CSS =
  '.bb-embed-frame{overflow:hidden}' +
  '.bb-embed-frame iframe{width:100%;height:100%;border:0;display:block}';

/**
 * Renders an `embed` node from its plugin-sanitized `embedHtml` — rebuilt from
 * an attribute allowlist over an https-only `src`, with scripts, event handlers
 * and inline styles stripped. `url` / `iframe` only round-trip the editor UI and
 * are deliberately ignored. Override the `embed` block to render the parsed
 * parts yourself instead of injecting the stored HTML.
 */
function renderEmbed(block: EmbedNode, key: number, blocks?: CustomBlocksConfig): ReactNode {
  const EmbedComp = blocks?.embed;

  if (EmbedComp) {
    return (
      <EmbedComp
        key={key}
        source={block.source}
        url={block.url}
        iframe={block.iframe}
        embedHtml={block.embedHtml}
        embedSrc={block.embedSrc}
        provider={block.provider}
        thumbnail={block.thumbnail}
        aspectRatio={block.aspectRatio}
        customAspectRatio={block.customAspectRatio}
        alignment={block.alignment}
        caption={block.caption}
        title={block.title}
      />
    );
  }

  const alignment: MediaAlignment = block.alignment ?? 'center';
  const ratio = getAspectRatio(block.aspectRatio, block.customAspectRatio);

  // An embed whose source was cleared has no markup to inject. Fall back to a
  // plain link when there's still a URL, so the block isn't silently lost.
  const body = block.embedHtml ? (
    <div
      className="bb-embed-frame"
      style={getMediaFrameStyle(alignment, ratio)}
      dangerouslySetInnerHTML={{ __html: block.embedHtml }}
    />
  ) : block.url ? (
    <a className="bb-embed-fallback" href={block.url} target="_blank" rel="noopener noreferrer">
      {block.title || block.url}
    </a>
  ) : null;

  if (!body) return null;

  return (
    <figure
      key={key}
      className={`bb-embed align-${alignment}`}
      style={getMediaFigureStyle(alignment)}
      aria-label={block.title}
    >
      {body}
      {block.caption && (
        <figcaption className="bb-embed-caption" style={MEDIA_CAPTION_STYLE}>
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
}

// ── Video (Provider-aware Player) Rendering ──────────────────────────

function renderVideo(block: VideoNode, key: number, blocks?: CustomBlocksConfig): ReactNode {
  const VideoComp = blocks?.video;

  if (VideoComp) {
    return (
      <VideoComp
        key={key}
        provider={block.provider}
        url={block.url ?? ''}
        assetId={block.assetId}
        playbackId={block.playbackId}
        file={block.file}
        poster={block.poster}
        title={block.title}
        caption={block.caption}
        transcript={block.transcript}
        player={block.player}
        alignment={block.alignment}
        aspectRatio={block.aspectRatio}
        customAspectRatio={block.customAspectRatio}
      />
    );
  }

  return (
    <Video
      key={key}
      provider={block.provider}
      url={block.url ?? ''}
      assetId={block.assetId}
      playbackId={block.playbackId}
      file={block.file}
      poster={block.poster}
      title={block.title}
      caption={block.caption}
      transcript={block.transcript}
      player={block.player}
      alignment={block.alignment}
      aspectRatio={block.aspectRatio}
      customAspectRatio={block.customAspectRatio}
      instanceId={block.file?.id ?? key}
    />
  );
}

// ── Social Embed Rendering ───────────────────────────────────────────

function renderSocialEmbed(
  block: SocialEmbedNode,
  key: number,
  blocks?: CustomBlocksConfig
): ReactNode {
  const SocialComp = blocks?.['social-embed'];

  if (SocialComp) {
    return (
      <SocialComp
        key={key}
        platform={block.platform}
        url={block.url}
        embedCode={block.embedCode}
        oembed={block.oembed}
        alignment={block.alignment}
        caption={block.caption}
      />
    );
  }

  return (
    <SocialEmbed
      key={key}
      platform={block.platform}
      url={block.url}
      embedCode={block.embedCode}
      oembed={block.oembed}
      alignment={block.alignment}
      caption={block.caption}
    />
  );
}

// ── Audio (HTML5 Player) Rendering ───────────────────────────────────

// Alignment class → flexbox cross-axis placement of the player within the
// figure. `none` stretches the player to fill the available width.
const AUDIO_ALIGN_ITEMS: Record<AudioAlignment, CSSProperties['alignItems']> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
  none: 'stretch',
};

function renderAudio(block: AudioNode, key: number, blocks?: CustomBlocksConfig): ReactNode {
  const AudioComp = blocks?.audio;

  if (AudioComp) {
    return (
      <AudioComp
        key={key}
        file={block.file}
        title={block.title}
        caption={block.caption}
        player={block.player ?? {}}
        alignment={block.alignment}
      />
    );
  }

  const { file, title, caption } = block;
  const player = block.player ?? {};
  const alignment: AudioAlignment = block.alignment ?? 'center';
  // Stable id linking the caption to the player via aria-describedby. Prefer the
  // Media-Library id, fall back to the file hash, then the block index.
  const capId = caption ? `bb-audio-cap-${file.id ?? file.hash ?? key}` : undefined;

  return (
    <figure
      key={key}
      className={`bb-audio align-${alignment}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        margin: '1rem 0',
        alignItems: AUDIO_ALIGN_ITEMS[alignment],
      }}
    >
      {title && (
        <figcaption className="bb-audio-title" style={{ fontWeight: 600 }}>
          {title}
        </figcaption>
      )}
      <audio
        className="bb-audio-player"
        src={file.url}
        controls={player.controls ?? true}
        autoPlay={player.autoplay ?? false}
        loop={player.loop ?? false}
        preload={player.preload ?? 'metadata'}
        aria-label={title || 'Audio player'}
        aria-describedby={capId}
        style={{ width: '100%', maxWidth: alignment === 'none' ? '100%' : '32rem' }}
      >
        Your browser does not support the audio element. <a href={file.url}>Download the audio</a>.
      </audio>
      {caption && (
        <figcaption
          id={capId}
          className="bb-audio-caption"
          style={{ fontSize: '0.875rem', color: '#6b7280' }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// ── Diagram (Mermaid) Rendering ──────────────────────────────────────

function renderDiagram(block: DiagramNode, key: number, blocks?: CustomBlocksConfig): ReactNode {
  const DiagramComp = blocks?.diagram;
  const code = block.value ?? '';

  if (DiagramComp) {
    return <DiagramComp key={key} code={code} format={block.format} />;
  }

  return <MermaidDiagram key={key} value={code} />;
}

// ── Callout (Admonition) Rendering ───────────────────────────────────

// GitHub-style alert metadata: accent color, default label and octicon path.
const CALLOUT_VARIANTS: Record<CalloutVariant, { color: string; label: string; icon: string }> = {
  note: {
    color: '#0969da',
    label: 'Note',
    icon: 'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  },
  tip: {
    color: '#1a7f37',
    label: 'Tip',
    icon: 'M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z',
  },
  important: {
    color: '#8250df',
    label: 'Important',
    icon: 'M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  },
  warning: {
    color: '#9a6700',
    label: 'Warning',
    icon: 'M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  },
  caution: {
    color: '#d1242f',
    label: 'Caution',
    icon: 'M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .39.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.39.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  },
};

function renderCallout(
  block: CalloutNode,
  key: number,
  blocks?: CustomBlocksConfig,
  modifiers?: CustomModifiersConfig,
  options?: RenderOptions
): ReactNode {
  const variant: CalloutVariant = CALLOUT_VARIANTS[block.variant] ? block.variant : 'note';
  const meta = CALLOUT_VARIANTS[variant];
  const childNodes = block.children.map((child, index) =>
    renderBlock(child, index, blocks, modifiers, options)
  );
  // Collapse the outer block margins (e.g. a paragraph's default top/bottom
  // margin) so the body sits flush within the callout's padding, keeping the
  // vertical spacing balanced instead of leaving a gap below the content.
  const lastIndex = childNodes.length - 1;
  const children = childNodes.map((node, index) => {
    if (!isValidElement(node)) return node;
    const element = node as ReactElement<{ style?: CSSProperties }>;
    const collapsed: CSSProperties = {};
    if (index === 0) collapsed.marginTop = 0;
    if (index === lastIndex) collapsed.marginBottom = 0;
    return cloneElement(element, { style: { ...element.props.style, ...collapsed } });
  });

  const CalloutComp = blocks?.callout;
  if (CalloutComp) {
    return (
      <CalloutComp key={key} variant={variant} title={block.title}>
        {children}
      </CalloutComp>
    );
  }

  const title = block.title?.trim() ? block.title : meta.label;

  return (
    <aside
      key={key}
      className={`bb-callout bb-callout-${variant}`}
      role="note"
      style={{
        borderLeft: `0.25rem solid ${meta.color}`,
        // Subtle accent-tinted background (~8% opacity) to match the editor preview.
        backgroundColor: `${meta.color}14`,
        padding: '0.5rem 1rem',
        margin: '1rem 0',
      }}
    >
      <p
        className="bb-callout-title"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          // GitHub spacing: tight title line with a 1rem gap before the body.
          lineHeight: 1,
          margin: '0 0 1rem',
          fontWeight: 600,
          color: meta.color,
        }}
      >
        <svg
          className="bb-callout-icon"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d={meta.icon} />
        </svg>
        {title}
      </p>
      {children}
    </aside>
  );
}

// ── Details / Summary (Collapsible) Rendering ────────────────────────

function renderDetails(
  block: DetailsNode,
  key: number,
  blocks?: CustomBlocksConfig,
  modifiers?: CustomModifiersConfig,
  options?: RenderOptions
): ReactNode {
  const children = block.children.map((child, index) =>
    renderBlock(child, index, blocks, modifiers, options)
  );

  const DetailsComp = blocks?.details;
  if (DetailsComp) {
    return (
      <DetailsComp key={key} summary={block.summary} defaultOpen={block.defaultOpen}>
        {children}
      </DetailsComp>
    );
  }

  return (
    <details key={key} className="bb-details" open={block.defaultOpen}>
      <summary className="bb-details-summary">{block.summary}</summary>
      {children}
    </details>
  );
}

// ── Button (CTA / File Download) Rendering ───────────────────────────

// Default button styling shipped with the renderer so hover/focus work with
// zero setup (no stylesheet import, no consumer CSS). Hover colors come from the
// `--bb-button-hover-*` custom properties getButtonStyle() sets, falling back to
// the base color props (`--bb-button-*`) so a button without hover colors keeps
// its colors on hover. `!important` lets these win over the inline base colors.
const BUTTON_HOVER_CSS =
  '.bb-button{transition:background-color .15s ease,color .15s ease}' +
  '.bb-button:hover{' +
  'background-color:var(--bb-button-hover-bg,var(--bb-button-bg))!important;' +
  'color:var(--bb-button-hover-color,var(--bb-button-color))!important}' +
  '.bb-button:focus-visible{outline:2px solid currentColor;outline-offset:2px}';

// True if any block in the tree has the given type, so the styles that block
// needs are only injected when it's actually rendered. Recurses into child
// arrays (e.g. a button nested inside a details block).
function contentHasBlock(nodes: BlockNode[], type: BlockNode['type']): boolean {
  for (const node of nodes) {
    if (node.type === type) return true;
    const children = (node as { children?: unknown }).children;
    if (Array.isArray(children) && contentHasBlock(children as BlockNode[], type)) return true;
  }
  return false;
}

function getButtonStyle(style?: ButtonStyle): CSSProperties {
  // Sensible defaults so an unstyled button still looks like a button. Hover
  // colors can't be set inline, so they ride along as CSS custom properties
  // that the default hover rule (see BUTTON_HOVER_CSS) consumes.
  const out: Record<string, string | number> = {
    display: 'inline-block',
    textDecoration: 'none',
    cursor: 'pointer',
  };
  if (!style) return out as CSSProperties;
  // Mirror the base colors into custom properties too, so the `:hover` rule can
  // fall back to them when no hover color is set (otherwise an unset hover var
  // would compute to inherited/transparent on hover and the button would lose
  // its color).
  if (style.backgroundColor) {
    out.backgroundColor = style.backgroundColor;
    out['--bb-button-bg'] = style.backgroundColor;
  }
  if (style.textColor) {
    out.color = style.textColor;
    out['--bb-button-color'] = style.textColor;
  }
  if (style.borderRadius) out.borderRadius = style.borderRadius;
  if (style.fontSize) out.fontSize = style.fontSize;
  if (style.fontWeight) out.fontWeight = style.fontWeight;
  if (style.padding) out.padding = style.padding;
  if (style.border) out.border = style.border;
  if (style.hoverBackgroundColor) out['--bb-button-hover-bg'] = style.hoverBackgroundColor;
  if (style.hoverTextColor) out['--bb-button-hover-color'] = style.hoverTextColor;
  return out as CSSProperties;
}

// Forces a real file download instead of letting the browser preview it.
// The native `download` attribute is ignored for cross-origin URLs (the common
// case for Strapi/CDN assets), so browsers open renderable files (PDF, video,
// images) inline. We fetch the asset as a blob and trigger a download from a
// same-origin object URL. If that fails (e.g. CORS-blocked), we fall back to
// native navigation so the link still does something.
function handleFileDownload(
  event: ReactMouseEvent<HTMLAnchorElement>,
  url: string,
  name: string
): void {
  // Respect modifier clicks (open in new tab, etc.) and non-primary buttons.
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

  void (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // CORS-blocked or offline — fall back to native navigation.
      window.location.href = url;
    }
  })();
}

function renderButton(block: ButtonElement, key: number, blocks?: CustomBlocksConfig): ReactNode {
  const ButtonComp = blocks?.button;
  if (ButtonComp) {
    return (
      <ButtonComp
        key={key}
        label={block.label}
        buttonType={block.buttonType}
        alignment={block.alignment}
        link={block.link}
        file={block.file}
        showFileSize={block.showFileSize}
        showFileIcon={block.showFileIcon}
        filePreview={block.filePreview}
        style={block.style}
        cssClass={block.cssClass}
      />
    );
  }

  const style = getButtonStyle(block.style);
  const className = block.cssClass ? `bb-button ${block.cssClass}` : 'bb-button';

  let control: ReactNode;
  if (block.buttonType === 'file' && block.file) {
    const file = block.file;
    const icon = block.showFileIcon ? getFileIcon(file) : null;
    const size =
      block.showFileSize && typeof file.size === 'number' ? formatFileSize(file.size) : null;
    const filePreview = block.filePreview === true;
    control = filePreview ? (
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Preview ${file.name}`}
        className={className}
        style={style}
      >
        {icon && (
          <span className="bb-button-icon" aria-hidden="true">
            {icon}{' '}
          </span>
        )}
        {block.label}
        {size && <span className="bb-button-size"> ({size})</span>}
      </a>
    ) : (
      <a
        href={file.url}
        download={file.name}
        aria-label={`Download ${file.name}`}
        className={className}
        style={style}
        onClick={(event) => handleFileDownload(event, file.url, file.name)}
      >
        {icon && (
          <span className="bb-button-icon" aria-hidden="true">
            {icon}{' '}
          </span>
        )}
        {block.label}
        {size && <span className="bb-button-size"> ({size})</span>}
      </a>
    );
  } else if (block.link) {
    const link = block.link;
    control = (
      <a
        href={link.url}
        target={link.target}
        rel={link.rel}
        aria-label={link.ariaLabel}
        className={className}
        style={style}
      >
        {block.label}
      </a>
    );
  } else {
    // No link/file payload — render the label as a styled, non-navigating span.
    control = (
      <span className={className} style={style}>
        {block.label}
      </span>
    );
  }

  const alignment = block.alignment ?? 'left';
  if (alignment === 'none') {
    return <Fragment key={key}>{control}</Fragment>;
  }

  return (
    <div
      key={key}
      className="bb-button-wrapper"
      style={{ textAlign: alignment, margin: '0.5rem 0' }}
    >
      {control}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export function BlocksRenderer({
  content,
  blocks,
  modifiers,
  codeTheme = DEFAULT_CODE_THEME,
  codeCopyButton = false,
}: BlocksRendererProps): ReactNode {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return null;
  }

  // Ship the styles the built-in blocks need inline, so there's no stylesheet to
  // import. Skipped when the consumer overrides the block, since their markup
  // won't carry the `.bb-*` classes these rules target.
  const needsButtonCss = !blocks?.button && contentHasBlock(content, 'button');
  const needsEmbedCss = !blocks?.embed && contentHasBlock(content, 'embed');
  const needsTableCss = !blocks?.table && contentHasBlock(content, 'table');
  const needsQuoteCss = !blocks?.quote && contentHasBlock(content, 'quote');
  const needsCodeCss = !blocks?.code && contentHasBlock(content, 'code');

  const options: RenderOptions = { codeTheme, codeCopyButton };

  return (
    <>
      {needsButtonCss && <style>{BUTTON_HOVER_CSS}</style>}
      {needsEmbedCss && <style>{EMBED_FRAME_CSS}</style>}
      {needsTableCss && <style>{TABLE_CSS}</style>}
      {needsQuoteCss && <style>{QUOTE_CSS}</style>}
      {needsCodeCss && <style>{CODE_CSS}</style>}
      {content.map((block, index) => renderBlock(block, index, blocks, modifiers, options))}
    </>
  );
}
