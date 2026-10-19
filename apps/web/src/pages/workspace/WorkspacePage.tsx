import {
  buildDiagram,
  parseTemplate,
  summarizeProperties,
  type DiagramModel,
  type DiagramNode,
  type ParseResult,
  type SourceRange,
} from '@cfn-lens/core';
import { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { DetailsArea } from '@/features/details/DetailsArea';
import { DiagramArea } from '@/features/diagram/DiagramArea';
import { countFolded } from '@/features/diagram/countFolded';
import { EditorArea } from '@/features/editor/EditorArea';
import { samples } from '@/features/samples/samples';
import { readTemplateHandoff } from '@/features/template-input/templateHandoff';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceLayout } from './WorkspaceLayout';

// The selected resource, and the lines the editor highlights: the resource itself unless a
// line link in the panel pointed somewhere else (e.g. a resource folded into it).
type Selection = { id: string; range?: SourceRange };

/** Editor | diagram | details, served at `/app`. */
export function WorkspacePage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [showAllResources, setShowAllResources] = useState(false);
  const [selection, setSelection] = useState<Selection>();

  const sample = samples.find((candidate) => candidate.id === searchParams.get('sample'));
  const pastedTemplate = sample?.template ?? readTemplateHandoff(location.state);
  const documentName = sample?.title ?? (pastedTemplate ? 'Pasted template' : 'Untitled template');
  const parseResult = pastedTemplate === undefined ? undefined : parseTemplate(pastedTemplate);
  const diagram = toDiagram(parseResult, showAllResources);
  // A resource can disappear from the diagram, e.g. folded again when "Show all resources" turns off
  const selectedNode = diagram?.nodes.find((node) => node.id === selection?.id);
  const highlight = highlightOf(selectedNode, selection);

  const select = (id: string | undefined) => setSelection(toSelection(id));
  const showRange = (range: SourceRange) => setSelection((current) => withRange(current, range));

  return (
    <>
      <title>{`${documentName} · cfn-lens`}</title>
      <WorkspaceLayout
        header={
          <WorkspaceHeader
            documentName={documentName}
            foldedCount={countFolded(diagram)}
            showAllResources={showAllResources}
            onShowAllResourcesChange={setShowAllResources}
          />
        }
        editor={<EditorArea template={pastedTemplate} diagnostics={parseResult?.diagnostics ?? []} highlight={highlight} />}
        diagram={<DiagramArea parseResult={parseResult} diagram={diagram} selectedId={selectedNode?.id} onSelect={select} />}
        details={
          <DetailsArea
            node={selectedNode}
            edges={diagram?.edges ?? []}
            properties={toProperties(parseResult, selectedNode?.id)}
            selectableIds={new Set(diagram?.nodes.map(({ id }) => id))}
            onSelect={select}
            onShowRange={showRange}
          />
        }
      />
    </>
  );
}

function toDiagram(parseResult: ParseResult | undefined, showAllResources: boolean): DiagramModel | undefined {
  const template = parseResult?.template;

  if (!template) {
    return;
  }

  return buildDiagram(template, { foldPlumbing: !showAllResources });
}

function toProperties(parseResult: ParseResult | undefined, id: string | undefined) {
  const template = parseResult?.template;

  if (!template || id === undefined) {
    return [];
  }

  return summarizeProperties(template, id);
}

function toSelection(id: string | undefined): Selection | undefined {
  if (id === undefined) {
    return;
  }

  return { id };
}

function withRange(selection: Selection | undefined, range: SourceRange): Selection | undefined {
  if (!selection) {
    return;
  }

  return { ...selection, range };
}

function highlightOf(node: DiagramNode | undefined, selection: Selection | undefined): SourceRange | undefined {
  if (!node) {
    return;
  }

  return selection?.range ?? node.range;
}
