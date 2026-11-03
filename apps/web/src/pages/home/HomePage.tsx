import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { SampleGallery } from '@/features/samples/SampleGallery';
import { TemplateInput } from '@/features/template-input/TemplateInput';
import { HowItWorks } from './HowItWorks';
import { Intro } from './Intro';

export function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50 text-[15px]/normal">
      <title>cfn-lens — see what your CloudFormation template builds</title>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-300 flex-1 flex-col gap-16 px-6 pt-16 pb-12">
        <section className="flex flex-wrap items-center gap-12">
          <Intro />
          <TemplateInput />
        </section>
        <SampleGallery />
        <HowItWorks />
      </main>
      <SiteFooter />
    </div>
  );
}
