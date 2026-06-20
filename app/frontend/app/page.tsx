'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HeaderShell } from '@/components/layout';
import { Button } from '@/components/ui/button';

// Ruta relativa → proxeada por next.config.ts rewrites al backend (funciona desde celular sin config extra)
const API_URL = '/api';

export default function HomePage() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/ask`, {  // → proxied to backend via next.config.ts
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const envelope = await res.json();
      sessionStorage.setItem('ar_response', JSON.stringify(envelope));
      router.push('/experience');
    } catch {
      toast.error('No se pudo conectar con el tutor. ¿Está el backend corriendo en :3000?');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <HeaderShell />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        {/* Hero */}
        <div className="mb-12 max-w-xl space-y-4 text-center">
          <div className="text-6xl leading-none">🐳</div>
          <h1 className="font-mono text-4xl font-bold tracking-tight text-foreground">
            Docker AR Tutor
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Hacé una pregunta sobre Docker. La respuesta aparece como paneles
            interactivos flotando en realidad aumentada alrededor del image target.
          </p>
        </div>

        {/* Feature cards */}
        <div className="mb-12 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
          <FeatureCard
            icon="🔍"
            title="RAG inteligente"
            desc="Respuestas basadas en documentación Docker oficial, no en memoria del modelo"
          />
          <FeatureCard
            icon="📦"
            title="Componentes pedagógicos"
            desc="Cards, tablas, quizzes y diagramas renderizados como DOM real en AR"
          />
          <FeatureCard
            icon="🎯"
            title="Distribución radial"
            desc="Paneles calculados matemáticamente en arco 3D, no posiciones hardcodeadas"
          />
        </div>

        {/* Ask form */}
        <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-3">
          <label
            htmlFor="question"
            className="block text-sm font-medium text-foreground"
          >
            ¿Qué querés aprender sobre Docker?
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e);
            }}
            placeholder="Ej: ¿Qué diferencia hay entre una imagen y un contenedor?"
            rows={3}
            disabled={loading}
            className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading || !question.trim()}
          >
            {loading ? 'Consultando al tutor...' : 'Iniciar experiencia AR →'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Cmd/Ctrl + Enter para enviar · La experiencia AR requiere cámara y el image target
          </p>
        </form>
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        Docker AR Tutor — EVA 03 · Next.js + MindAR + RAG con pgvector
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-center">
      <div className="mb-2 text-2xl leading-none">{icon}</div>
      <div className="mb-1 text-sm font-semibold text-foreground">{title}</div>
      <div className="text-xs leading-relaxed text-muted-foreground">{desc}</div>
    </div>
  );
}
