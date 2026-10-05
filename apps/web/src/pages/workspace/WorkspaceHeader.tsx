import { File, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/primitives/button';
import { Switch } from '@/components/primitives/switch';

interface WorkspaceHeaderProps {
  documentName: string;
  showAllResources: boolean;
  onShowAllResourcesChange: (checked: boolean) => void;
}

export function WorkspaceHeader({ documentName, showAllResources, onShowAllResourcesChange }: WorkspaceHeaderProps) {
  return (
    <header className="flex flex-none flex-wrap items-center gap-x-4 gap-y-3 border-b bg-background px-4 py-2.5">
      <h1 className="sr-only">Workspace</h1>
      <Link to="/" className="flex items-center gap-2 text-[15px] font-semibold">
        <img src="/logo.svg" alt="" className="size-5.5" />
        cfn-lens
      </Link>
      <span aria-hidden="true" className="h-5 w-px bg-border" />
      <span className="flex min-w-0 items-center gap-2">
        <File className="size-4 shrink-0 text-neutral-500" aria-hidden="true" />
        <span className="truncate font-medium">{documentName}</span>
      </span>

      <span className="flex-1" />

      <label className="flex cursor-pointer items-center gap-2.5">
        <Switch checked={showAllResources} onCheckedChange={onShowAllResourcesChange} />
        Show all resources
      </label>
      <Link to="/" className={buttonVariants({ variant: 'outline', className: 'h-8.5 gap-1.5 px-3' })}>
        <Plus aria-hidden="true" />
        New template
      </Link>
    </header>
  );
}
