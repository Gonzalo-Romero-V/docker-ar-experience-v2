import { z } from 'zod';
import { SceneItemSchema } from './components.js';

const FollowupSchema = z.object({
  type: z.enum(['deepen', 'quiz', 'video', 'ask']),
  label: z.string(),
  payload: z.string().optional(),
});

const SourceSchema = z.object({
  title: z.string(),
  source_file: z.string(),
  source_url: z.string(),
});

export const ResponseEnvelopeSchema = z.object({
  answer_summary: z.string(),
  level: z.enum(['beginner', 'intermediate']),
  grounding: z.enum(['grounded', 'weak', 'out_of_scope']),
  confidence: z.number().min(0).max(1),
  scene: z.array(SceneItemSchema).min(0).max(5),
  followups: z.array(FollowupSchema),
  sources: z.array(SourceSchema),
});

export type ResponseEnvelope = z.infer<typeof ResponseEnvelopeSchema>;
export type Followup = z.infer<typeof FollowupSchema>;
export type Source = z.infer<typeof SourceSchema>;
