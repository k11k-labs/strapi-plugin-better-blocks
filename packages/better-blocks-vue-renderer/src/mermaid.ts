/**
 * Lazy, deduped loader for mermaid.js.
 *
 * mermaid measures text against a real DOM, so it only runs in a browser and
 * cannot render during SSR. It is also large, so it is imported on demand and
 * the initialized instance is cached at module scope: one fetch and one
 * `initialize` per page, however many diagrams that page holds.
 */

type Mermaid = typeof import('mermaid').default;

let mermaidPromise: Promise<Mermaid> | null = null;

export function loadMermaid(): Promise<Mermaid> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      const mermaid = mod.default;
      // `startOnLoad` would make mermaid scan the document for `.mermaid`
      // elements on its own; every diagram here is rendered explicitly.
      mermaid.initialize({ startOnLoad: false });
      return mermaid;
    });
  }
  return mermaidPromise;
}

// mermaid renders into a temporary node keyed by this id, so it has to be
// unique per render across the whole page.
let renderCount = 0;

export function nextDiagramId(): string {
  return `bb-mermaid-${renderCount++}`;
}
