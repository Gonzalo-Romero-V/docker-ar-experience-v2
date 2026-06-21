'use client';

import { useCallback, useEffect, useRef } from 'react';

export function useVoiceNarration() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const speak = useCallback(async (text: string) => {
    // Stop any current narration
    audioRef.current?.pause();
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        console.error('[TTS] backend responded', res.status, res.statusText);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch((err) => console.warn('[TTS] play() blocked:', err));
    } catch (err) {
      console.error('[TTS] fetch failed — is the backend running on :3000?', err);
    }
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  return { speak, stop };
}
