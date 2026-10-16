import type { DiagnosticSeverity } from '@cfn-lens/core';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { cn } from 'cn';

const severityIcons = {
  error: { Icon: CircleAlert, color: 'text-red-700' },
  warning: { Icon: TriangleAlert, color: 'text-amber-600' },
} as const;

export function DiagnosticIcon({ severity, className }: { severity: DiagnosticSeverity; className?: string }) {
  const { Icon, color } = severityIcons[severity];
  return <Icon aria-hidden="true" className={cn('size-3.5 flex-none', color, className)} />;
}
