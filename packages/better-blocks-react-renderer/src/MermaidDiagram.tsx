'use client';

import { useEffect, useState, type ReactNode } from 'react';

// Mermaid needs a real DOM to measure text, so it cannot render synchronously
// during SSR the way KaTeX does. We lazy-load it once on the client and cache
// the initialized instance so the heavy library stays out of the server bundle
// and is only fetched when a diagram is actually rendered.
let mermaidPromise: Promise<typeof import('mermaid').default> | null = null;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({ startOnLoad: false });
      return mermaid;
    });
  }
  return mermaidPromise;
}

// Unique, deterministic-per-render id for mermaid's temporary render node.
let renderCount = 0;

/**
 * Renders a Mermaid diagram to inline SVG on the client.
 *
 * SSR / static export and the first client render both emit the raw Mermaid
 * source inside a `<pre>` (so hydration matches), then swap in the SVG after
 * mount. If Mermaid fails to parse the diagram, the raw source remains as a
 * graceful fallback instead of crashing the page.
 */
export function MermaidDiagram({ value }: { value: string }): ReactNode {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);

    if (!value) return;

    loadMermaid()
      .then((mermaid) => mermaid.render(`bb-mermaid-${renderCount++}`, value))
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg);
      })
      .catch(() => {
        // Leave the raw-source fallback in place on parse/render errors.
        if (!cancelled) setSvg(null);
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  if (svg) {
    return <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
  }

  return <pre className="mermaid-source">{value}</pre>;
}
