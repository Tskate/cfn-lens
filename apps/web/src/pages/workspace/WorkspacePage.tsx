import { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { DetailsArea } from '@/features/details/DetailsArea';
import { DiagramArea } from '@/features/diagram/DiagramArea';
import { EditorArea } from '@/features/editor/EditorArea';
import { samples } from '@/features/samples/samples';
import { readTemplateHandoff } from '@/features/template-input/templateHandoff';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceLayout } from './WorkspaceLayout';

/** Editor | diagram | details, served at `/app`. */
export function WorkspacePage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  // TODO: feeds the diagram's plumbing collapse (D28) once the diagram model exists.
  const [showAllResources, setShowAllResources] = useState(false);

  const sample = samples.find((candidate) => candidate.id === searchParams.get('sample'));
  const pastedTemplate = readTemplateHandoff(location.state);
  const documentName = sample?.title ?? (pastedTemplate ? 'Pasted template' : 'Untitled template');

  return (
    <>
      <title>{`${documentName} · cfn-lens`}</title>
      <WorkspaceLayout
        header={
          <WorkspaceHeader documentName={documentName} showAllResources={showAllResources} onShowAllResourcesChange={setShowAllResources} />
        }
        editor={<EditorArea template={pastedTemplate} />}
        diagram={<DiagramArea />}
        details={<DetailsArea />}
      />
    </>
  );
}
