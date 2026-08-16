import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import type { ChartSpec } from '@qkix/chartkit-core';

import { useDraftSpec } from '../src/useDraftSpec';

const spec = (title: string): ChartSpec => ({
  version: 2,
  type: 'bar',
  title,
  data: { source: 'inline', labels: ['Q1'], series: [{ name: 'North', values: [10] }] },
});

describe('the draft a dialog edits', () => {
  it('starts from the spec it was given', () => {
    const { result } = renderHook(() => useDraftSpec(spec('Stored'), true));

    expect(result.current[0].title).toBe('Stored');
  });

  it('keeps edits while the dialog stays open', () => {
    const { result, rerender } = renderHook(({ s, open }) => useDraftSpec(s, open), {
      initialProps: { s: spec('Stored'), open: true },
    });

    act(() => result.current[1](spec('Being edited')));
    rerender({ s: spec('Stored'), open: true });

    // A new `spec` object with the same contents arrives on every render of a
    // host that builds it inline. That must not count as a change.
    expect(result.current[0].title).toBe('Being edited');
  });

  it('keeps edits even when the stored spec genuinely changes underneath', () => {
    const { result, rerender } = renderHook(({ s, open }) => useDraftSpec(s, open), {
      initialProps: { s: spec('Stored'), open: true },
    });

    act(() => result.current[1](spec('Being edited')));
    rerender({ s: spec('Changed elsewhere'), open: true });

    // Someone is mid-edit. Whatever moved underneath them, taking their work
    // away without asking is the wrong answer.
    expect(result.current[0].title).toBe('Being edited');
  });

  it('starts over from the stored spec when reopened', () => {
    // The point of Cancel: an abandoned edit must not come back next time.
    const { result, rerender } = renderHook(({ s, open }) => useDraftSpec(s, open), {
      initialProps: { s: spec('Stored'), open: true },
    });

    act(() => result.current[1](spec('Abandoned')));
    rerender({ s: spec('Stored'), open: false });
    rerender({ s: spec('Stored'), open: true });

    expect(result.current[0].title).toBe('Stored');
  });
});
