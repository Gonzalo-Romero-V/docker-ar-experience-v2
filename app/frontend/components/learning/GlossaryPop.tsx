import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface GlossaryPopProps {
  terms: { term: string; definition: string }[];
}

function GlossaryPop({ terms }: GlossaryPopProps) {
  return (
    <Accordion type="single" collapsible>
      {terms.map(({ term, definition }) => (
        <AccordionItem key={term} value={term}>
          <AccordionTrigger className="text-sm font-medium">{term}</AccordionTrigger>
          <AccordionContent>
            <p className="text-sm text-muted-foreground">{definition}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export { GlossaryPop };
export type { GlossaryPopProps };
