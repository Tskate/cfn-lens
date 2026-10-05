import { buttonVariants } from '@/components/primitives/button';
import { siteConfig } from '@/config';

const navLinkClass = 'text-neutral-600 transition-colors hover:text-foreground';

export function SiteHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-15 max-w-300 items-center justify-between gap-4 px-6 whitespace-nowrap">
        <a href="/" className="flex items-center gap-2.5 text-base font-semibold">
          <img src="/logo.svg" alt="" className="size-6" />
          cfn-lens
        </a>
        <nav aria-label="Main" className="flex items-center gap-3 text-sm sm:gap-5">
          <a href="#samples" className={navLinkClass}>
            Samples
          </a>
          <a href="#how" className={navLinkClass}>
            How it works
          </a>
          <a href={siteConfig.githubUrl} aria-label="Source on GitHub" className={buttonVariants({ variant: 'outline', size: 'icon-lg' })}>
            <img src="/github.svg" alt="" className="size-4.5" />
          </a>
        </nav>
      </div>
    </header>
  );
}
