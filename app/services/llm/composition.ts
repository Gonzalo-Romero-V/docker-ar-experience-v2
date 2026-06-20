import type { ResponseEnvelope, SceneItem } from '@shared/index.js';

export function normalizeComposition(envelope: ResponseEnvelope): ResponseEnvelope {
  const deduped = dedupScene(envelope.scene).slice(0, 5);
  return { ...envelope, scene: promoteQuizToLast(deduped) };
}

function dedupScene(items: SceneItem[]): SceneItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (item.type === 'ConceptCard') return true;
    if (seen.has(item.type)) return false;
    seen.add(item.type);
    return true;
  });
}

function promoteQuizToLast(items: SceneItem[]): SceneItem[] {
  const quiz = items.find((i) => i.type === 'MiniQuiz');
  if (!quiz) return items;
  return [...items.filter((i) => i.type !== 'MiniQuiz'), quiz];
}
