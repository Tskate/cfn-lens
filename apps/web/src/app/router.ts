import { createBrowserRouter } from 'react-router';
import { HomePage } from '@/pages/home/HomePage';
import { ErrorPage } from '@/pages/error/ErrorPage';
import { RootFallback, RootLayout } from './RootLayout';

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    HydrateFallback: RootFallback,
    ErrorBoundary: ErrorPage,
    children: [
      { index: true, Component: HomePage },
      {
        path: 'app',
        // Split into its own chunk: the workspace will carry the editor and diagram libraries.
        lazy: async () => {
          const { WorkspacePage } = await import('@/pages/workspace/WorkspacePage');
          return { Component: WorkspacePage };
        },
      },
    ],
  },
]);
