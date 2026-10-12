import type { SourceRange } from '../types';

// A reference from one node to another, e.g. `!Condition B` inside A, or `DependsOn: B` on A.
export type Edge = { target: string; range?: SourceRange };
// path is closed: it starts and ends with the same node, e.g. ['A', 'B', 'A']; edge is the one that closes it.
export type Cycle = { path: readonly string[]; edge: Edge };

// Depth-first search: reaching a node that is still on the current path means a cycle.
// A target missing from the graph has no edges, so it can't be part of a cycle (callers report it as unknown).
export function findCycles(graph: ReadonlyMap<string, readonly Edge[]>): Cycle[] {
  const cycles: Cycle[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const path: string[] = [];

  const visit = (name: string): void => {
    state.set(name, 'visiting');
    path.push(name);

    for (const edge of graph.get(name) ?? []) {
      const targetState = state.get(edge.target);
      if (targetState === 'visiting') {
        cycles.push({ path: [...path.slice(path.indexOf(edge.target)), edge.target], edge });
      } else if (targetState === undefined) {
        visit(edge.target);
      }
    }

    path.pop();
    state.set(name, 'done');
  };

  for (const name of graph.keys()) {
    if (!state.has(name)) {
      visit(name);
    }
  }

  return cycles;
}
