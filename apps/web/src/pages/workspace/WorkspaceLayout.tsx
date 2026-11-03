import type { ReactNode } from 'react';
import { ResizablePanel, ResizablePanelGroup } from '@/components/primitives/resizable';
import { WorkspaceSplitter } from './WorkspaceSplitter';

interface WorkspaceLayoutProps {
  header: ReactNode;
  editor: ReactNode;
  diagram: ReactNode;
  details: ReactNode;
}

// Plain numbers are pixels in react-resizable-panels v4. Side panels keep their pixel width
// when the window resizes, so only the diagram grows and shrinks.
const sidePanel = { minSize: 240, maxSize: 640, groupResizeBehavior: 'preserve-pixel-size' } as const;

export function WorkspaceLayout({ header, editor, diagram, details }: WorkspaceLayoutProps) {
  return (
    <div className="flex h-dvh flex-col bg-neutral-50 text-sm/[1.45]">
      {header}
      <main className="min-h-0 flex-1">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel id="editor" defaultSize={340} {...sidePanel}>
            {editor}
          </ResizablePanel>
          <WorkspaceSplitter label="Resize template panel" />
          <ResizablePanel id="diagram" minSize={320}>
            {diagram}
          </ResizablePanel>
          <WorkspaceSplitter label="Resize details panel" />
          <ResizablePanel id="details" defaultSize={360} {...sidePanel}>
            {details}
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  );
}
