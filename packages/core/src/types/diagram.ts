import type { SourceRange } from './diagnostics';

// What the diagram shows, without positions: layout belongs to the app.

export type ReferenceFunction = 'Ref' | 'Fn::GetAtt' | 'Fn::Sub';
export type ReferenceKind = ReferenceFunction | 'DependsOn';

export type DiagramNode = {
  // The resource's logical ID
  id: string;
  type: string;
  condition?: string;
  range: SourceRange;
};

// source holds the reference, target is the resource it names (Subnet → Vpc).
export type DiagramEdge = {
  source: string;
  target: string;
  via: readonly ReferenceKind[];
};

export type DiagramModel = {
  nodes: readonly DiagramNode[];
  edges: readonly DiagramEdge[];
};
