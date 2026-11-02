import { buildDiagram, parseTemplate, type Template } from '@cfn-lens/core';
import { describe, expect, it } from 'vitest';
import { samples } from './samples';

describe.each(samples)('sample $id', ({ template }) => {
  it('parses without problems', () => {
    expect(parseTemplate(template).diagnostics).toEqual([]);
  });

  // The gallery is where people first see plumbing fold into its owner
  it('folds plumbing into its owner', () => {
    const { nodes } = buildDiagram(parseTemplate(template).template as Template);

    expect(nodes.some((node) => node.folded.length > 0)).toBe(true);
  });
});

it('gives every sample its own id', () => {
  const ids = samples.map(({ id }) => id);

  expect(new Set(ids).size).toBe(ids.length);
});
