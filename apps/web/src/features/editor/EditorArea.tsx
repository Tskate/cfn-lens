import { Area } from '@/components/Area';

export function EditorArea() {
  return (
    <Area title="Template">
      <p className="p-3 text-sm text-muted-foreground">Paste a CloudFormation template (YAML or JSON).</p>
    </Area>
  );
}
