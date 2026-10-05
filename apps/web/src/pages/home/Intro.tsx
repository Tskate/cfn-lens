import { Check } from 'lucide-react';

const highlights = [
  'Runs entirely in your browser — nothing is uploaded',
  'No AWS account or login needed',
  'YAML or JSON, all short-form tags',
];

export function Intro() {
  return (
    <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
      <span className="self-start rounded-full bg-[#f0f0f0] px-3 py-1 text-[13px] font-medium text-neutral-600">
        For people learning AWS
      </span>
      <h1 className="text-4xl leading-[1.05] font-bold tracking-[-0.03em] sm:text-[52px]">See what your CloudFormation template builds.</h1>
      <p className="max-w-130 text-lg/normal text-neutral-600">
        Paste a template and get an architecture diagram that explains every resource in plain English. Click anything to see what it does
        and where it lives in the file.
      </p>
      <ul className="mt-2 flex flex-col gap-2.5">
        {highlights.map((text) => (
          <li key={text} className="flex items-center gap-2.5">
            <Check className="size-4.5 shrink-0 text-green-700" strokeWidth={2.2} aria-hidden="true" />
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
