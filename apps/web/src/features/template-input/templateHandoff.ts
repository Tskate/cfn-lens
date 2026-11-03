/** Location state passed from the home page form to the workspace route. */
export interface TemplateHandoff {
  template: string;
}

/**
 * History state survives refreshes and can be anything a previous page put there,
 * so it's validated rather than cast.
 */
export function readTemplateHandoff(state: unknown): string | undefined {
  const isNonEmptyObject = typeof state === 'object' && state !== null;

  if (!isNonEmptyObject) {
    return;
  }

  const hasTemplateProperty = 'template' in state && typeof state.template === 'string';

  return hasTemplateProperty ? String(state.template) : undefined;
}
