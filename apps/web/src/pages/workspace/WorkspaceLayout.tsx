import { useState, useSyncExternalStore, type ReactNode } from 'react';
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

const subscribeToWidth = (notify: () => void) => {
  const media = window.matchMedia('(min-width: 1100px)');
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
const isWide = () => window.matchMedia('(min-width: 1100px)').matches;

export function WorkspaceLayout({ header, editor, diagram, details }: WorkspaceLayoutProps) {
  const wide = useSyncExternalStore(subscribeToWidth, isWide, () => true);
  const [active, setActive] = useState<'diagram' | 'editor' | 'details'>('diagram');
  const panels = { diagram, editor, details };
  return (
    <div className="flex h-dvh flex-col bg-neutral-50 text-sm/[1.45]">
      {header}
      {!wide && (
        <nav aria-label="Workspace panels" className="flex shrink-0 border-b bg-background p-1 gap-1">
          {(['diagram', 'editor', 'details'] as const).map((panel) => (
            <button
              key={panel}
              type="button"
              aria-pressed={active === panel}
              onClick={() => setActive(panel)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${active === panel ? 'bg-neutral-200 text-neutral-950' : 'text-neutral-600'}`}
            >
              {panel === 'editor' ? 'Template' : panel === 'diagram' ? 'Diagram' : 'Details'}
            </button>
          ))}
        </nav>
      )}
      <main className="min-h-0 min-w-0 flex-1">
        {wide ? (
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel id="editor" defaultSize={500} {...sidePanel}>
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
        ) : (
          panels[active]
        )}
      </main>
    </div>
  );
}
