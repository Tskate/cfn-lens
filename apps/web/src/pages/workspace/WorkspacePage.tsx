import { buildDiagram, parseTemplate, type DiagramModel, type ParseResult } from '@cfn-lens/core';
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

/** Editor | diagram | details, served at `/app`. */
export function WorkspacePage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [showAllResources, setShowAllResources] = useState(false);

  const sample = samples.find((candidate) => candidate.id === searchParams.get('sample'));
  const pastedTemplate = sample?.template ?? readTemplateHandoff(location.state);
  const documentName = sample?.title ?? (pastedTemplate ? 'Pasted template' : 'Untitled template');
  const parseResult = pastedTemplate === undefined ? undefined : parseTemplate(pastedTemplate);
  const diagram = toDiagram(parseResult, showAllResources);

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
        editor={<EditorArea template={pastedTemplate} diagnostics={parseResult?.diagnostics ?? []} />}
        diagram={<DiagramArea parseResult={parseResult} diagram={diagram} />}
        details={<DetailsArea />}
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
