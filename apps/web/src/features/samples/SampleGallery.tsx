import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
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
            <Link
              to={{ pathname: '/app', search: `?sample=${sample.id}` }}
              className="group flex h-full w-full flex-col gap-3 rounded-xl border bg-background p-5 text-left transition-[border-color,box-shadow] outline-none hover:border-neutral-300 hover:shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_rgb(0_0_0/0.06)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex gap-1.5">
                {sample.icons.map((icon) => (
                  <ServiceIcon key={icon} name={icon} />
                ))}
              </span>
              <span className="text-base/normal font-semibold">{sample.title}</span>
              <span className="text-sm/normal text-neutral-500">{sample.description}</span>
              <span className="mt-auto inline-flex items-center gap-1 text-sm/normal font-medium text-neutral-600 underline-offset-4 transition-colors group-hover:text-link group-hover:underline group-focus-visible:text-link group-focus-visible:underline">
                View diagram
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
