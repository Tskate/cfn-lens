import { useReactFlow, useStore } from '@xyflow/react';
import { useEffect } from 'react';
import { FIT_VIEW_OPTIONS, MAX_ZOOM, MIN_ZOOM } from './viewport';
import { ZoomControls } from './ZoomControls';

const ZOOM_DURATION = { duration: 150 };

interface CanvasViewportProps {
  // True until the person zooms or pans themselves; then their view wins over refitting
  followsSize: boolean;
  onFollowsSizeChange: (followsSize: boolean) => void;
}

/** Live zoom controls plus refitting when the panel changes size. Rendered inside <ReactFlow>. */
export function CanvasViewport({ followsSize, onFollowsSizeChange }: CanvasViewportProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);

  // React Flow tracks the pane's size; following it is syncing with an outside system, so an effect.
  useEffect(() => {
    if (!followsSize) {
      return;
    }

    void fitView(FIT_VIEW_OPTIONS);
  }, [followsSize, width, height, fitView]);

  const canZoomIn = zoom < MAX_ZOOM;
  const canZoomOut = zoom > MIN_ZOOM;

  const fit = () => {
    onFollowsSizeChange(true);
    void fitView({ ...FIT_VIEW_OPTIONS, ...ZOOM_DURATION });
  };

  const zoomBy = (zoomer: typeof zoomIn) => () => {
    onFollowsSizeChange(false);
    void zoomer(ZOOM_DURATION);
  };

  return (
    <ZoomControls
      zoom={zoom}
      onZoomIn={enabledIf(canZoomIn, zoomBy(zoomIn))}
      onZoomOut={enabledIf(canZoomOut, zoomBy(zoomOut))}
      onFit={fit}
    />
  );
}

// A missing handler disables its button
function enabledIf(isEnabled: boolean, action: () => void): (() => void) | undefined {
  if (!isEnabled) {
    return;
  }

  return action;
}
