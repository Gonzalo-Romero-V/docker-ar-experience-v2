'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ARShell } from '@/components/ar/ARShell';
import { SpatialBoard } from '@/components/ar/SpatialBoard';
import {
  ConceptCard,
  ComparisonTable,
  CommandRunner,
  GlossaryPop,
  MiniQuiz,
  DiagramPanel,
} from '@/components/learning';

// Local type mirrors packages/shared/src types — avoids cross-package TS complexity
type SceneItem =
  | { type: 'ConceptCard'; props: { title: string; definition: string; level: 'beginner' | 'intermediate'; tags?: string[] } }
  | { type: 'ComparisonTable'; props: { headers: string[]; rows: string[][]; highlightColumn?: number } }
  | { type: 'CommandRunner'; props: { command: string; description: string; flags?: { flag: string; description: string }[] } }
  | { type: 'GlossaryPop'; props: { terms: { term: string; definition: string; example?: string }[] } }
  | { type: 'MiniQuiz'; props: { question: string; options: string[]; correctIndex: number; explanation: string } }
  | { type: 'DiagramPanel'; props: { mermaidCode: string; caption?: string } };

type ArResponse = {
  answer_summary: string;
  grounding: 'grounded' | 'weak' | 'out_of_scope';
  scene: SceneItem[];
  followups: { type: string; label: string; payload?: string }[];
};

function renderSceneItem(item: SceneItem): React.ReactNode {
  switch (item.type) {
    case 'ConceptCard':
      return (
        <div className="h-full overflow-y-auto p-3">
          <ConceptCard
            title={item.props.title}
            definition={item.props.definition}
            level={item.props.level}
            tags={item.props.tags}
          />
        </div>
      );
    case 'ComparisonTable':
      return (
        <div className="h-full overflow-y-auto p-3">
          <ComparisonTable
            headers={item.props.headers}
            rows={item.props.rows}
            highlightColumn={item.props.highlightColumn}
          />
        </div>
      );
    case 'CommandRunner':
      return (
        <div className="h-full overflow-y-auto p-3">
          <CommandRunner
            command={item.props.command}
            description={item.props.description}
            flags={item.props.flags}
          />
        </div>
      );
    case 'GlossaryPop':
      return (
        <div className="h-full overflow-y-auto p-3">
          <GlossaryPop terms={item.props.terms} />
        </div>
      );
    case 'MiniQuiz':
      return (
        <div className="h-full overflow-y-auto p-3">
          <MiniQuiz
            question={item.props.question}
            options={item.props.options}
            correctIndex={item.props.correctIndex}
            explanation={item.props.explanation}
          />
        </div>
      );
    case 'DiagramPanel':
      return (
        <div className="h-full overflow-y-auto p-3">
          <DiagramPanel graph={item.props.mermaidCode} title={item.props.caption} />
        </div>
      );
  }
}

export default function ExperienceClient() {
  const router = useRouter();
  const [response, setResponse] = useState<ArResponse | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('ar_response');
    if (!raw) {
      setLoadError(true);
      return;
    }
    try {
      setResponse(JSON.parse(raw) as ArResponse);
    } catch {
      setLoadError(true);
    }
  }, []);

  if (loadError) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-black text-white">
        <p className="text-lg font-semibold">No hay respuesta cargada</p>
        <button
          className="rounded-full border border-white/20 bg-white/10 px-6 py-2 text-sm"
          onClick={() => router.push('/')}
        >
          ← Volver al inicio
        </button>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    );
  }

  const panels = response.scene.map(renderSceneItem);

  return (
    <div className="relative h-dvh w-full bg-black">
      {/* Summary bar — shown as DOM overlay (not in AR space) */}
      <div className="absolute inset-x-0 top-0 z-20 border-b border-white/10 bg-black/70 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-white/70 line-clamp-2">{response.answer_summary}</p>
          <button
            className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white"
            onClick={() => router.push('/')}
          >
            ← Nueva pregunta
          </button>
        </div>
        {response.grounding !== 'grounded' && (
          <p className="mt-1 text-xs text-amber-400">
            {response.grounding === 'out_of_scope'
              ? '⚠️ Pregunta fuera del alcance del tutor'
              : '⚠️ Respuesta basada en conocimiento general (no documentación específica)'}
          </p>
        )}
      </div>

      {/* AR Experience — ARShell needs the compiled .mind target in /public */}
      <ARShell imageSrc="/targets/docker-target.mind">
        {(scene) => <SpatialBoard scene={scene} panels={panels} />}
      </ARShell>
    </div>
  );
}
