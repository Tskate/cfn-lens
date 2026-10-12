import { describe, expect, it } from 'vitest';

import { findCycles, type Edge } from './findCycles.ts';

// 'A>B,C' style shorthand: each node with its targets.
const graph = (spec: Record<string, string>) =>
  new Map<string, Edge[]>(
    Object.entries(spec).map(([name, targets]) => [name, targets ? targets.split(',').map((target) => ({ target })) : []]),
  );
const paths = (spec: Record<string, string>) => findCycles(graph(spec)).map((cycle) => cycle.path.join(' → '));

describe('findCycles', () => {
  it('finds nothing in an acyclic graph', () => {
    expect(paths({ A: 'B,C', B: 'D', C: 'D', D: '' })).toEqual([]);
  });

  it('finds a self-reference', () => {
    expect(paths({ A: 'A' })).toEqual(['A → A']);
  });

  it('reports a longer cycle once, with its full path', () => {
    expect(paths({ A: 'B', B: 'C', C: 'A' })).toEqual(['A → B → C → A']);
  });

  it('finds separate cycles', () => {
    expect(paths({ A: 'B', B: 'A', C: 'D', D: 'C' })).toEqual(['A → B → A', 'C → D → C']);
  });

  it('starts the path at the node the cycle returns to', () => {
    expect(paths({ Start: 'A', A: 'B', B: 'A' })).toEqual(['A → B → A']);
  });

  it('ignores edges to nodes that are not in the graph', () => {
    expect(paths({ A: 'Missing' })).toEqual([]);
  });

  it('returns the edge that closes the cycle', () => {
    const range = { start: { offset: 0, line: 1, column: 1 }, end: { offset: 1, line: 1, column: 2 } };
    const cycles = findCycles(new Map([['A', [{ target: 'A', range }]]]));

    expect(cycles).toEqual([{ path: ['A', 'A'], edge: { target: 'A', range } }]);
  });
});
