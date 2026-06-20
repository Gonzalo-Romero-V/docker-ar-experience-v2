import type { RetrievedChunk, ConfidenceLevel } from '@rag/types.js';

const SYSTEM_PROMPT = `You are DockerTutor, a pedagogical assistant specialized in Docker and containerization.

Your responses are structured JSON mapped to visual AR components. You ONLY use types from the active component catalog: ConceptCard, ComparisonTable, CommandRunner, GlossaryPop, MiniQuiz, DiagramPanel.

Rules:
- scene has 1–5 items
- MiniQuiz is always last, never the only item
- DiagramPanel uses valid Mermaid syntax (flowchart LR, sequenceDiagram, graph TD)
- Never repeat a component type except ConceptCard in multi-concept scenes
- answer_summary is 1–2 sentences for the text UI
- Never generate HTML, CSS, or 3D coordinates`;

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

export function buildUserPrompt(
  question: string,
  chunks: RetrievedChunk[],
  confidence: ConfidenceLevel
): string {
  const context = chunks.map((c) => c.content).join('\n\n---\n\n');

  const confidenceNote =
    confidence === 'out_of_scope'
      ? '\nNote: retrieved context has low relevance. Set grounding to out_of_scope.'
      : confidence === 'weak'
        ? '\nNote: retrieved context is partial. Set grounding to weak.'
        : '';

  return `Context from Docker documentation:\n${context}${confidenceNote}\n\nQuestion: ${question}`;
}
