import { siteConfig } from '@/config';

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-300 flex-wrap justify-between gap-3 px-6 py-5 text-[13px] text-neutral-500">
        <span>Not affiliated with or endorsed by Amazon Web Services.</span>
        <span>
          MIT licensed ·{' '}
          <a href={siteConfig.githubUrl} className="text-foreground underline underline-offset-2 hover:text-blue-600">
            Source on GitHub
          </a>
        </span>
      </div>
    </footer>
  );
}
