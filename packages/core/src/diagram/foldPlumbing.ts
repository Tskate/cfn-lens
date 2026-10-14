import type { Plumbing } from './catalog';

export type Folding = {
  // Owned plumbing → the visible resource it folds into
  ownerOf: ReadonlyMap<string, string>;
  // Routing plumbing, which the VPC and subnet boxes already show
  absorbed: ReadonlySet<string>;
};

/**
 * D28: owned plumbing folds into its owner only when it has exactly one candidate (see
 * ResourceDescription.attachedBy). Chains resolve step by step: once a role folds into a function,
 * a policy on that role sees the function as its candidate. Plumbing without a single owner stays visible.
 */
export function foldPlumbing(
  ids: readonly string[],
  plumbingOf: (id: string) => Plumbing | undefined,
  ownerCandidatesOf: (id: string) => readonly string[],
): Folding {
  const absorbed = new Set(ids.filter((id) => plumbingOf(id) === 'network'));
  const owned = ids.filter((id) => plumbingOf(id) === 'owned');
  const ownerOf = new Map<string, string>();

  // Folded plumbing counts as its owner. Plumbing that hasn't folded yet doesn't count: it may fold later.
  const resolve = (id: string): string | undefined => {
    if (plumbingOf(id) !== 'owned') {
      return id;
    }

    return ownerOf.get(id);
  };

  const candidatesOf = (id: string): Set<string> => {
    const candidates = new Set<string>();

    for (const neighbour of ownerCandidatesOf(id)) {
      const candidate = resolve(neighbour);
      const isCandidate = candidate !== undefined && candidate !== id && !absorbed.has(candidate);

      if (isCandidate) {
        candidates.add(candidate);
      }
    }

    return candidates;
  };

  let changed = true;

  while (changed) {
    changed = false;

    for (const id of owned) {
      if (ownerOf.has(id)) {
        continue;
      }

      const [owner, ...others] = candidatesOf(id);
      const hasSingleOwner = owner !== undefined && others.length === 0;

      if (hasSingleOwner) {
        ownerOf.set(id, owner);
        changed = true;
      }
    }
  }

  return { ownerOf, absorbed };
}
