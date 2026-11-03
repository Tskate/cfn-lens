import { Component, type ErrorInfo, type ReactNode } from 'react';

interface DiagramErrorBoundaryProps {
  // A new value (a new diagram) clears the error and tries again
  resetKey: unknown;
  fallback: (error: Error) => ReactNode;
  children: ReactNode;
}

interface DiagramErrorBoundaryState {
  error: Error | undefined;
}

/**
 * Keeps a failure while laying out or drawing the diagram inside the diagram panel (D30),
 * so the editor and details stay usable. React only supports error boundaries as classes.
 */
export class DiagramErrorBoundary extends Component<DiagramErrorBoundaryProps, DiagramErrorBoundaryState> {
  override state: DiagramErrorBoundaryState = { error: undefined };

  static getDerivedStateFromError(error: unknown): DiagramErrorBoundaryState {
    return { error: toError(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('The diagram failed to render', error, info.componentStack);
  }

  override componentDidUpdate(previous: DiagramErrorBoundaryProps) {
    const hasNewDiagram = previous.resetKey !== this.props.resetKey;

    if (hasNewDiagram && this.state.error) {
      this.setState({ error: undefined });
    }
  }

  override render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error);
    }

    return this.props.children;
  }
}

// Anything can be thrown; the fallback wants a message
function toError(thrown: unknown): Error {
  if (thrown instanceof Error) {
    return thrown;
  }

  return new Error(String(thrown));
}
