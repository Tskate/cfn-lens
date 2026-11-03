import type { ResourceIcon } from '@cfn-lens/core';
import type { ReactNode } from 'react';
import { cn } from 'cn';

type Category = 'network' | 'compute' | 'database' | 'integration' | 'storage' | 'security' | 'unknown';

// Full class names (not built from strings) so Tailwind can find them when scanning the source.
const categoryClasses: Record<Category, string> = {
  network: 'text-category-network bg-category-network-tint',
  compute: 'text-category-compute bg-category-compute-tint',
  database: 'text-category-database bg-category-database-tint',
  integration: 'text-category-integration bg-category-integration-tint',
  storage: 'text-category-storage bg-category-storage-tint',
  security: 'text-category-security bg-category-security-tint',
  unknown: 'text-neutral-600 bg-neutral-100',
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
  network: {
    category: 'network',
    shape: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
      </>
    ),
  },
  natGateway: { category: 'network', shape: <path d="M4 8h14l-3-3M20 16H6l3 3" /> },
  shield: { category: 'security', shape: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /> },
  topic: {
    category: 'integration',
    shape: (
      <>
        <path d="M4 10v4h3l6 4V6l-6 4H4z" />
        <path d="M17 9a4 4 0 0 1 0 6" />
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
  unknown: {
    category: 'unknown',
    shape: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17h.01" />
      </>
    ),
  },
} satisfies Record<ResourceIcon, { category: Category; shape: ReactNode }>;

export type ServiceIconName = ResourceIcon;

/** Decorative service tile: a stroke icon on a category-tinted square. */
export function ServiceIcon({ name, className }: { name: ServiceIconName; className?: string }) {
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
      className={cn('size-8 flex-none rounded-md', categoryClasses[category], className)}
    >
      {shape}
    </svg>
  );
}
