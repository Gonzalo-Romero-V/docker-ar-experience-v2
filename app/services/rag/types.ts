export interface Chunk {
  content: string;
  sourcePath: string;
  hash: string;
}

export interface RetrievedChunk extends Chunk {
  score: number;
  bm25Score: number;
  vectorScore: number;
}

export type ConfidenceLevel = 'grounded' | 'weak' | 'out_of_scope';

export interface KBConfig {
  repo: string;
  includeGlobs: string[];
  minChunkChars: number;
  embeddingDimensions: number;
}

export interface MarkdownFile {
  path: string;
  content: string;
}
