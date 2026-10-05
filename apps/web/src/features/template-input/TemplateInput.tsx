import { ArrowRight, FileUp, Upload } from 'lucide-react';
import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '@/components/primitives/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/primitives/tabs';
import { Textarea } from '@/components/primitives/textarea';

type InputMethod = 'paste' | 'upload';

const PLACEHOLDER = `AWSTemplateFormatVersion: '2010-09-09'
Resources:
  MyBucket:
    Type: AWS::S3::Bucket`;

const triggerClass =
  'h-9 flex-none px-3.5 text-sm text-neutral-600 data-active:border-border data-active:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-none';

export function TemplateInput() {
  const textareaId = useId();
  const [method, setMethod] = useState<InputMethod>('paste');
  const [template, setTemplate] = useState('');

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    // TODO: add error handling
    setTemplate(await file.text());
    setMethod('paste');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // TODO: complete implementation
    event.preventDefault();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="min-w-0 flex-[1_1_440px] overflow-hidden rounded-xl border bg-background shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_rgb(0_0_0/0.04)] has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-3 has-[textarea:focus-visible]:ring-ring/50"
    >
      <Tabs value={method} onValueChange={(value: InputMethod) => setMethod(value)} className="gap-0">
        <TabsList
          aria-label="Input method"
          className="w-full justify-start gap-1 rounded-none border-b bg-neutral-50 p-2 group-data-horizontal/tabs:h-auto"
        >
          <TabsTrigger value="paste" className={triggerClass}>
            Paste
          </TabsTrigger>
          <TabsTrigger value="upload" className={triggerClass}>
            Upload file
          </TabsTrigger>
        </TabsList>

        <TabsContent value="paste">
          <label htmlFor={textareaId} className="sr-only">
            Template
          </label>
          <Textarea
            id={textareaId}
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            className="h-55 resize-none rounded-none border-0 px-5 py-4 font-mono text-[13px]/5 shadow-none field-sizing-fixed focus-visible:ring-0 md:text-[13px]/5"
          />
        </TabsContent>

        <TabsContent value="upload" className="grid h-55 place-items-center">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg px-6 py-4 text-sm text-neutral-600 hover:text-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
            <FileUp className="size-6" aria-hidden="true" />
            Choose a .yaml or .json file
            <input type="file" accept=".yaml,.yml,.json,.template" onChange={handleFileChange} className="sr-only" />
          </label>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-neutral-300 bg-neutral-50 px-4 py-3">
        <span className="flex items-center gap-2 text-[13px] text-neutral-500">
          <Upload className="size-4" aria-hidden="true" />
          Or drop a .yaml / .json file anywhere
        </span>
        <Button type="submit" size="lg" className="h-10 gap-2 rounded-md px-4.5 has-data-[icon=inline-end]:pr-4.5">
          Visualize
          <ArrowRight data-icon="inline-end" aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}
