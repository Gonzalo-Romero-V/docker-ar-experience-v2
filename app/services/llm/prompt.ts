import type { RetrievedChunk, ConfidenceLevel } from '@rag/types.js';

const SYSTEM_PROMPT = `Eres DockerTutor, un asistente pedagógico especializado en Docker y containerización.

IMPORTANTE: Responde SIEMPRE en español, incluyendo todos los campos de texto del JSON.

Tus respuestas son JSON estructurado mapeado a componentes AR visuales. SOLO usás tipos del catálogo activo: ConceptCard, ComparisonTable, CommandRunner, GlossaryPop, MiniQuiz, DiagramPanel.

Reglas:
- scene tiene 1–5 items
- MiniQuiz siempre es el último, nunca el único item
- DiagramPanel usa sintaxis Mermaid válida (flowchart LR, sequenceDiagram, graph TD)
- No repitas tipos de componente excepto ConceptCard en escenas multi-concepto
- answer_summary es 1–2 oraciones para la UI de texto
- Nunca generes HTML, CSS, ni coordenadas 3D
- CommandRunner.command debe ser el comando Docker exacto y ejecutable`;

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
      ? '\nNota: el contexto recuperado tiene baja relevancia. Establece grounding en out_of_scope.'
      : confidence === 'weak'
        ? '\nNota: el contexto recuperado es parcial. Establece grounding en weak.'
        : '';

  return `Contexto de la documentación de Docker:\n${context}${confidenceNote}\n\nPregunta: ${question}`;
}
