import { createHash } from 'crypto';
import type { Chunk } from './types.js';

const MAX_CHUNK_CHARS = 3200;

export function chunkMarkdown(content: string, sourcePath: string): Chunk[] {
  const sections = content.split(/(?=^#{2,3} .+$)/m).filter(Boolean);
  const chunks: Chunk[] = [];

  for (const section of sections) {
    if (!isUsefulChunk(section)) continue;

    const parts =
      section.length > MAX_CHUNK_CHARS
        ? splitByParagraphs(section, MAX_CHUNK_CHARS)
        : [section];

    for (const text of parts) {
      if (isUsefulChunk(text)) {
        chunks.push({ content: text.trim(), sourcePath, hash: sha256(text) });
      }
    }
  }

  return chunks;
}

export function isUsefulChunk(text: string): boolean {
  return text.trim().length >= 160;
}

function splitByParagraphs(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const result: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars && current) {
      result.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }

  if (current) result.push(current);
  return result;
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
