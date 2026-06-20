'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ConceptCardProps {
  title: string;
  definition: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  tags?: string[];
}

const levelVariant = {
  beginner: 'secondary',
  intermediate: 'default',
  advanced: 'outline',
} as const;

function ConceptCard({ title, definition, level, tags = [] }: ConceptCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          <Badge variant={levelVariant[level]}>{level}</Badge>
        </div>
        <CardDescription className="flex flex-wrap gap-1 pt-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{definition}</p>
      </CardContent>
    </Card>
  );
}

export { ConceptCard };
export type { ConceptCardProps };
