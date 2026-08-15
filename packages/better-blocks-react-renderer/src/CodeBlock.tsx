'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import type { BundledLanguage } from 'shiki';

import { normalizeCodeLang } from './code';

type Highlighter = Awaited<ReturnType<typeof import('shiki').createHighlighter>>;

// Shiki resolves grammars and themes asynchronously, so it cannot highlight
// synchronously during SSR the way KaTeX does. We lazy-load it once on the
// client and cache a highlighter per theme, so the heavy library stays out of
// the server bundle and is only fetched when a code block is actually rendered.
const highlighters = new Map<string, Promise<Highlighter>>();

function loadHighlighter(theme: string, lang: string): Promise<Highlighter> {
  let highlighter = highlighters.get(theme);

  if (!highlighter) {
    highlighter = import('shiki').then((shiki) =>
      shiki.createHighlighter({ themes: [theme], langs: [lang] })
    );
    highlighters.set(theme, highlighter);
    return highlighter;
  }

  // A second block on the page may use a different language than the one the
  // highlighter was built with; load it into the existing instance rather than
  // spinning up another highlighter for the same theme.
  return highlighter.then(async (instance) => {
    if (!instance.getLoadedLanguages().includes(lang)) {
      // normalizeCodeLang only ever returns a bundled grammar id, but it can't
      // be typed as one without leaking Shiki's types into ./code.
      await instance.loadLanguage(lang as BundledLanguage);
    }
    return instance;
  });
}

function CopyButton({ plainText }: { plainText: string }): ReactNode {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleCopy = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(plainText).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button className="bb-code-copy" type="button" onClick={handleCopy} aria-label="Copy code">
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

/**
 * Renders a code block, syntax-highlighted with Shiki on the client.
 *
 * SSR / static export and the first client render both emit the raw source in a
 * plain `<pre>` (so hydration matches), then swap in the highlighted markup
 * after mount. If Shiki fails to load or the grammar is unavailable, the plain
 * `<pre>` remains as a graceful fallback instead of crashing the page.
 */
export function CodeBlock({
  plainText,
  language,
  theme,
  copyButton,
}: {
  plainText: string;
  language?: string;
  theme: string;
  copyButton: boolean;
}): ReactNode {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);

    if (!plainText) return;

    const lang = normalizeCodeLang(language);

    loadHighlighter(theme, lang)
      .then((highlighter) => highlighter.codeToHtml(plainText, { lang, theme }))
      .then((highlighted) => {
        if (!cancelled) setHtml(highlighted);
      })
      .catch(() => {
        // Leave the plain-source fallback in place on load/parse errors.
        if (!cancelled) setHtml(null);
      });

    return () => {
      cancelled = true;
    };
  }, [plainText, language, theme]);

  return (
    <div className="bb-code">
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="bb-code-pre">
          <code>{plainText}</code>
        </pre>
      )}
      {copyButton && <CopyButton plainText={plainText} />}
    </div>
  );
}
