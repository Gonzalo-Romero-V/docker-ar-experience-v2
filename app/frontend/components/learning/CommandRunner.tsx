'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface CommandRunnerProps {
  command: string;
  description: string;
  flags?: { flag: string; description: string }[];
}

function CommandRunner({ command, description, flags = [] }: CommandRunnerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-lg border bg-muted/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/60 border-b">
        <span className="text-xs text-muted-foreground">{description}</span>
        <Button variant="ghost" size="xs" onClick={handleCopy} aria-label="Copy command">
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <pre className="px-4 py-3 text-sm font-mono overflow-x-auto">
        <code>{command}</code>
      </pre>
      {flags.length > 0 && (
        <Accordion type="single" collapsible className="px-4 pb-2">
          <AccordionItem value="flags" className="border-0">
            <AccordionTrigger className="text-xs text-muted-foreground py-2">
              Flags ({flags.length})
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1">
                {flags.map(({ flag, description: desc }) => (
                  <li key={flag} className="grid grid-cols-[auto_1fr] gap-2 text-xs">
                    <code className="text-primary font-mono">{flag}</code>
                    <span className="text-muted-foreground">{desc}</span>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}

export { CommandRunner };
export type { CommandRunnerProps };
