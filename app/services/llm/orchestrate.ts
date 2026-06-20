import { zodToJsonSchema } from 'zod-to-json-schema';
import { ResponseEnvelopeSchema, type ResponseEnvelope } from '@shared/index.js';
import type { RetrievedChunk, ConfidenceLevel } from '@rag/types.js';
import type { OpenAIProvider } from './openai.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt.js';
import { normalizeComposition } from './composition.js';

const envelopeJsonSchema = zodToJsonSchema(ResponseEnvelopeSchema, {
  name: 'ResponseEnvelope',
  strictUnions: true,
}) as Record<string, unknown>;

const FALLBACK: ResponseEnvelope = {
  answer_summary: 'Could not process your question. Please try again.',
  level: 'beginner',
  grounding: 'weak',
  confidence: 0,
  scene: [
    {
      type: 'ConceptCard',
      props: {
        title: 'Error',
        definition: 'An error occurred processing your question. Please try again.',
        level: 'beginner',
      },
    },
  ],
  followups: [],
  sources: [],
};

export async function orchestrateAnswer(
  provider: OpenAIProvider,
  question: string,
  chunks: RetrievedChunk[],
  confidence: ConfidenceLevel
): Promise<ResponseEnvelope> {
  const messages = [
    { role: 'system' as const, content: buildSystemPrompt() },
    { role: 'user' as const, content: buildUserPrompt(question, chunks, confidence) },
  ];

  let raw: unknown;
  try {
    raw = await provider.completeStructured<unknown>({
      messages,
      jsonSchema: envelopeJsonSchema,
      schemaName: 'ResponseEnvelope',
    });
  } catch (err) {
    console.error('[orchestrate] OpenAI call failed:', err);
    return FALLBACK;
  }

  const parsed = ResponseEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[orchestrate] schema validation failed:', parsed.error.flatten());
    return { ...FALLBACK, answer_summary: 'Response format error. Please try again.' };
  }

  return normalizeComposition(parsed.data);
}
