import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { buttonVariants } from '@/components/primitives/button';

export function ErrorPage() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const title = notFound ? 'Page not found' : 'Something went wrong';

  return (
    <main className="grid min-h-dvh place-content-center gap-4 bg-neutral-50 px-6 text-center">
      <title>{`${title} · cfn-lens`}</title>
      <h1 className="text-3xl font-bold tracking-[-0.02em]">{title}</h1>
      <p className="text-neutral-600">
        {notFound ? "This page doesn't exist." : 'An unexpected error occurred. Reloading the page may help.'}
      </p>
      <Link to="/" className={buttonVariants({ className: 'justify-self-center' })}>
        Back to home
      </Link>
    </main>
  );
}
