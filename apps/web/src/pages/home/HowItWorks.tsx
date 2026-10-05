const steps = [
  {
    title: 'Groups by network',
    description: 'Resources sit inside their VPC, Availability Zone and subnet — the way AWS actually places them.',
  },
  {
    title: 'Folds the plumbing',
    description: 'Policies, routes and attachments tuck into the resource they serve. One toggle shows them all.',
  },
  {
    title: 'Explains each piece',
    description: 'Click a resource for what it does, its key settings, and the exact lines that define it.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-heading" className="flex scroll-mt-6 flex-col gap-5">
      <h2 id="how-heading" className="text-xl/normal font-semibold tracking-[-0.01em]">
        How it reads your template
      </h2>
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-1.5 border-t-2 border-foreground p-5">
            <span className="font-mono text-[13px] text-neutral-500">{String(index + 1).padStart(2, '0')}</span>
            <span className="font-semibold">{step.title}</span>
            <span className="text-sm/normal text-neutral-600">{step.description}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
