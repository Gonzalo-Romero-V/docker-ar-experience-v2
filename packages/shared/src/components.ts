import { z } from 'zod';

const ConceptCardSchema = z.object({
  type: z.literal('ConceptCard'),
  props: z.object({
    title: z.string(),
    definition: z.string(),
    icon: z.string().optional(),
    level: z.enum(['beginner', 'intermediate']),
    tags: z.array(z.string()).max(3).optional(),
  }),
});

const ComparisonTableSchema = z.object({
  type: z.literal('ComparisonTable'),
  props: z.object({
    caption: z.string().optional(),
    headers: z.array(z.string()).min(2).max(6),
    rows: z.array(z.array(z.string())),
    highlightColumn: z.number().int().optional(),
  }),
});

const CommandRunnerSchema = z.object({
  type: z.literal('CommandRunner'),
  props: z.object({
    command: z.string(),
    description: z.string(),
    flags: z
      .array(z.object({ flag: z.string(), description: z.string() }))
      .optional(),
    expectedOutput: z.string().optional(),
  }),
});

const GlossaryPopSchema = z.object({
  type: z.literal('GlossaryPop'),
  props: z.object({
    terms: z
      .array(
        z.object({
          term: z.string(),
          definition: z.string(),
          example: z.string().optional(),
        })
      )
      .min(1)
      .max(6),
  }),
});

const MiniQuizSchema = z.object({
  type: z.literal('MiniQuiz'),
  props: z.object({
    question: z.string(),
    options: z.array(z.string()).min(2).max(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string(),
  }),
});

const DiagramPanelSchema = z.object({
  type: z.literal('DiagramPanel'),
  props: z.object({
    mermaidCode: z.string(),
    caption: z.string().optional(),
    diagramType: z.enum(['flowchart', 'sequence', 'graph']).optional(),
  }),
});

export const SceneItemSchema = z.discriminatedUnion('type', [
  ConceptCardSchema,
  ComparisonTableSchema,
  CommandRunnerSchema,
  GlossaryPopSchema,
  MiniQuizSchema,
  DiagramPanelSchema,
]);

export type SceneItem = z.infer<typeof SceneItemSchema>;
export type ConceptCard = z.infer<typeof ConceptCardSchema>;
export type ComparisonTable = z.infer<typeof ComparisonTableSchema>;
export type CommandRunner = z.infer<typeof CommandRunnerSchema>;
export type GlossaryPop = z.infer<typeof GlossaryPopSchema>;
export type MiniQuiz = z.infer<typeof MiniQuizSchema>;
export type DiagramPanel = z.infer<typeof DiagramPanelSchema>;
