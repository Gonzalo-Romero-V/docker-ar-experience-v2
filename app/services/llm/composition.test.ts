import { describe, it, expect } from 'vitest';
import { normalizeComposition } from './composition.js';

const base = {
  answer_summary: 'test',
  level: 'beginner' as const,
  grounding: 'grounded' as const,
  confidence: 0.9,
  followups: [],
  sources: [],
};

const conceptCard = (title = 'T') => ({
  type: 'ConceptCard' as const,
  props: { title, definition: 'D', level: 'beginner' as const },
});
const quiz = () => ({
  type: 'MiniQuiz' as const,
  props: { question: 'Q?', options: ['A', 'B'], correctIndex: 0, explanation: 'E' },
});
const table = () => ({
  type: 'ComparisonTable' as const,
  props: { headers: ['A', 'B'], rows: [['1', '2']] },
});
const cmd = () => ({
  type: 'CommandRunner' as const,
  props: { command: 'docker ps', description: 'list containers' },
});

describe('normalizeComposition', () => {
  it('preserves scene when no MiniQuiz is present', () => {
    const scene = [conceptCard(), table()];
    const result = normalizeComposition({ ...base, scene });
    expect(result.scene.map((i) => i.type)).toEqual(['ConceptCard', 'ComparisonTable']);
  });

  it('moves MiniQuiz from middle to last', () => {
    const scene = [conceptCard(), quiz(), table()];
    const result = normalizeComposition({ ...base, scene });
    expect(result.scene.at(-1)?.type).toBe('MiniQuiz');
    expect(result.scene[0].type).toBe('ConceptCard');
  });

  it('moves MiniQuiz from first position to last', () => {
    const scene = [quiz(), conceptCard(), table()];
    const result = normalizeComposition({ ...base, scene });
    expect(result.scene.at(-1)?.type).toBe('MiniQuiz');
    expect(result.scene.length).toBe(3);
  });

  it('preserves both ConceptCards (ConceptCard is not deduped)', () => {
    const scene = [conceptCard('A'), conceptCard('B'), table()];
    const result = normalizeComposition({ ...base, scene });
    const cards = result.scene.filter((i) => i.type === 'ConceptCard');
    expect(cards.length).toBe(2);
  });

  it('dedupes non-ConceptCard types — keeps first, removes duplicate', () => {
    const scene = [table(), conceptCard(), table()];
    const result = normalizeComposition({ ...base, scene });
    const tables = result.scene.filter((i) => i.type === 'ComparisonTable');
    expect(tables.length).toBe(1);
  });

  it('caps scene to 5 items', () => {
    const scene = [conceptCard('1'), conceptCard('2'), conceptCard('3'), conceptCard('4'), conceptCard('5'), conceptCard('6')];
    const result = normalizeComposition({ ...base, scene });
    expect(result.scene.length).toBe(5);
  });

  it('caps to 5 and then places MiniQuiz last', () => {
    const scene = [conceptCard('1'), conceptCard('2'), conceptCard('3'), conceptCard('4'), quiz(), cmd()];
    const result = normalizeComposition({ ...base, scene });
    expect(result.scene.length).toBe(5);
    expect(result.scene.at(-1)?.type).toBe('MiniQuiz');
  });
});
