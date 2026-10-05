import type { ReactNode } from 'react';
import { cn } from 'cn';

type Category = 'network' | 'compute' | 'database' | 'integration' | 'storage';

// Full class names (not built from strings) so Tailwind can find them when scanning the source.
const categoryClasses: Record<Category, string> = {
  network: 'text-category-network bg-category-network-tint',
  compute: 'text-category-compute bg-category-compute-tint',
  database: 'text-category-database bg-category-database-tint',
  integration: 'text-category-integration bg-category-integration-tint',
  storage: 'text-category-storage bg-category-storage-tint',
};

const icons = {
  loadBalancer: {
    category: 'network',
    shape: (
      <>
        <circle cx="5" cy="12" r="2" />
        <path d="M7 12h4M11 12l7-6M11 12l7 6M11 12h8" />
      </>
    ),
  },
  server: {
    category: 'compute',
    shape: (
      <>
        <rect x="6" y="6" width="12" height="12" rx="2" />
        <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
      </>
    ),
  },
  database: {
    category: 'database',
    shape: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
      </>
    ),
  },
  api: {
    category: 'integration',
    shape: (
      <>
        <path d="M4 7h16M4 12h16M4 17h10" />
        <circle cx="18" cy="17" r="2" />
      </>
    ),
  },
  function: { category: 'compute', shape: <path d="M6 20l5-10M11 10L8 4H5M11 10l4 10h4" /> },
  table: {
    category: 'database',
    shape: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M4 10h16M10 10v10" />
      </>
    ),
  },
  cdn: {
    category: 'network',
    shape: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
      </>
    ),
  },
  bucket: {
    category: 'storage',
    shape: (
      <>
        <path d="M4 6h16l-2 14H6L4 6z" />
        <ellipse cx="12" cy="6" rx="8" ry="2" />
      </>
    ),
  },
  queue: {
    category: 'integration',
    shape: (
      <>
        <rect x="3" y="7" width="18" height="10" rx="2" />
        <path d="M7 7v10M11 7v10M15 7v10" />
      </>
    ),
  },
} satisfies Record<string, { category: Category; shape: ReactNode }>;

export type ServiceIconName = keyof typeof icons;

/** Decorative service tile: a stroke icon on a category-tinted square. */
export function ServiceIcon({ name }: { name: ServiceIconName }) {
  const { category, shape } = icons[name];
  return (
    <svg
      viewBox="-4 -4 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('size-8 rounded-md', categoryClasses[category])}
    >
      {shape}
    </svg>
  );
}
