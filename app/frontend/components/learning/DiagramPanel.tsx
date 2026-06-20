'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DiagramPanelProps {
  graph: string;
  title?: string;
}

function DiagramPanel({ graph, title }: DiagramPanelProps) {
  const id = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });
        const { svg } = await mermaid.render(`mermaid-${id}`, graph);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Diagram render failed');
          setLoading(false);
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [graph, id]);

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        {loading && <Skeleton className="h-40 w-full rounded-md" />}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div ref={containerRef} className={loading ? 'hidden' : 'overflow-x-auto'} />
      </CardContent>
    </Card>
  );
}

export { DiagramPanel };
export type { DiagramPanelProps };
