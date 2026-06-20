import { zodToJsonSchema } from 'zod-to-json-schema';
import { ResponseEnvelopeSchema, type ResponseEnvelope } from '@shared/index.js';
import type { RetrievedChunk, ConfidenceLevel } from '@rag/types.js';
import type { OpenAIProvider } from './openai.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt.js';
import { normalizeComposition } from './composition.js';

/**
 * OpenAI strict mode requires:
 *   1. Every property of every object listed in `required`
 *   2. `additionalProperties: false` on every object
 *   3. Optional fields encoded as `anyOf: [<type>, {type:'null'}]` rather than absent from required
 *
 * zodToJsonSchema produces schemas where optional fields are omitted from `required`,
 * which violates the strict mode contract. This transformer fixes that recursively.
 */
function makeOpenAIStrict(node: unknown): unknown {
  if (typeof node !== 'object' || node === null) return node;
  if (Array.isArray(node)) return node.map(makeOpenAIStrict);

  const obj = { ...(node as Record<string, unknown>) };

  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    if (Array.isArray(obj[key])) {
      obj[key] = (obj[key] as unknown[]).map(makeOpenAIStrict);
    }
  }

  for (const defsKey of ['$defs', 'definitions'] as const) {
    if (obj[defsKey] && typeof obj[defsKey] === 'object') {
      const defs: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj[defsKey] as Record<string, unknown>)) {
        defs[k] = makeOpenAIStrict(v);
      }
      obj[defsKey] = defs;
    }
  }

  if (obj['items']) obj['items'] = makeOpenAIStrict(obj['items']);

  if (obj['properties'] && typeof obj['properties'] === 'object') {
    const props = obj['properties'] as Record<string, unknown>;
    const existingRequired = new Set(
      Array.isArray(obj['required']) ? (obj['required'] as string[]) : []
    );
    const newProps: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(props)) {
      const processed = makeOpenAIStrict(v) as Record<string, unknown>;
      newProps[k] = existingRequired.has(k)
        ? processed
        : { anyOf: [processed, { type: 'null' }] };
    }

    obj['properties'] = newProps;
    obj['required'] = Object.keys(props);
    obj['additionalProperties'] = false;
  }

  return obj;
}

const envelopeJsonSchema = makeOpenAIStrict(
  zodToJsonSchema(ResponseEnvelopeSchema, { name: 'ResponseEnvelope', strictUnions: true })
) as Record<string, unknown>;

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

/** Recursively converts null → undefined so Zod `.optional()` fields pass validation after OpenAI strict mode. */
function nullToUndefined(val: unknown): unknown {
  if (val === null) return undefined;
  if (Array.isArray(val)) return val.map(nullToUndefined);
  if (typeof val === 'object') {
    return Object.fromEntries(Object.entries(val as object).map(([k, v]) => [k, nullToUndefined(v)]));
  }
  return val;
}

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

  // OpenAI strict mode returns `null` for optional fields; Zod `.optional()` only accepts `undefined`.
  const normalized = nullToUndefined(raw);
  const parsed = ResponseEnvelopeSchema.safeParse(normalized);
  if (!parsed.success) {
    console.error('[orchestrate] schema validation failed:', parsed.error.flatten());
    return { ...FALLBACK, answer_summary: 'Response format error. Please try again.' };
  }

  return normalizeComposition(parsed.data);
}
