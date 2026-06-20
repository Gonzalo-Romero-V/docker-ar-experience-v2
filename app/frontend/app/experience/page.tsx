'use client';

import dynamic from 'next/dynamic';

const ExperienceClient = dynamic(() => import('./ExperienceClient'), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-3 text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <p className="text-sm">Cargando experiencia AR...</p>
      </div>
    </div>
  ),
});

export default function ExperiencePage() {
  return <ExperienceClient />;
}
