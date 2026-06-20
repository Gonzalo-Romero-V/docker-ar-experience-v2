'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MiniQuizProps {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

function MiniQuiz({ question, options, correctIndex, explanation }: MiniQuizProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const answered = selected !== null;
  const isCorrect = selected === correctIndex;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{question}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {options.map((option, i) => (
          <Button
            key={i}
            variant="outline"
            className={cn(
              'w-full justify-start text-left',
              answered && i === correctIndex && 'border-green-500 text-green-600',
              answered && i === selected && !isCorrect && 'border-destructive text-destructive',
            )}
            onClick={() => !answered && setSelected(i)}
            aria-pressed={selected === i}
          >
            {option}
          </Button>
        ))}
        {answered && (
          <p className={cn('text-sm pt-2', isCorrect ? 'text-green-600' : 'text-muted-foreground')}>
            {isCorrect ? '✓ Correct — ' : '✗ Incorrect — '}{explanation}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export { MiniQuiz };
export type { MiniQuizProps };
