import type { DiagramModel } from '@cfn-lens/core';

/** Resources not drawn as their own node: folded into an owner or absorbed by the boxes. */
export function countFolded(model: DiagramModel | undefined): number {
  if (!model) {
    return 0;
  }

  const folded = model.nodes.reduce((total, node) => total + node.folded.length, 0);
  return folded + model.absorbed.length;
}
