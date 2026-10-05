import { Outlet, ScrollRestoration } from 'react-router';

export function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

/** Shown on first load while a lazy route's chunk downloads (e.g. opening `/app` directly). */
export function RootFallback() {
  return <div aria-busy="true" className="min-h-dvh bg-neutral-50" />;
}
