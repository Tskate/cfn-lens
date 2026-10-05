import { samples } from './samples';
import { ServiceIcon } from '@/components/ServiceIcon';

export function SampleGallery() {
  return (
    <section id="samples" aria-labelledby="samples-heading" className="flex scroll-mt-6 flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="samples-heading" className="text-xl/normal font-semibold tracking-[-0.01em]">
          Start from a sample
        </h2>
        <span className="text-sm/normal text-neutral-500">One click — opens straight into the diagram</span>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {samples.map((sample) => (
          <li key={sample.id}>
            {/* Becomes a link to the workspace once routing exists. */}
            <button
              type="button"
              className="flex h-full w-full flex-col gap-3 rounded-xl border bg-background p-5 text-left transition-colors outline-none hover:border-neutral-300 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex gap-1.5">
                {sample.icons.map((icon) => (
                  <ServiceIcon key={icon} name={icon} />
                ))}
              </span>
              <span className="text-base/normal font-semibold">{sample.title}</span>
              <span className="text-sm/normal text-neutral-500">{sample.description}</span>
              <span className="mt-auto text-sm/normal font-medium">View diagram →</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
