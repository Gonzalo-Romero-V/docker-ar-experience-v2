import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not configured in frontend environment' },
      { status: 500 },
    );
  }

  let text: string;
  try {
    const body = await request.json() as { text?: unknown };
    if (typeof body.text !== 'string' || !body.text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    text = body.text.slice(0, 2000);
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'tts-1', voice: 'nova', input: text }),
  });

  if (!upstream.ok) {
    const msg = await upstream.text();
    console.error('[/api/tts] OpenAI error', upstream.status, msg);
    return NextResponse.json({ error: 'TTS upstream failed' }, { status: 502 });
  }

  const audio = await upstream.arrayBuffer();
  return new NextResponse(audio, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
