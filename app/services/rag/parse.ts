import { readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { minimatch } from 'minimatch';
import type { KBConfig, MarkdownFile } from './types.js';

export function walkMarkdownFiles(dir: string, config: KBConfig): MarkdownFile[] {
  const files: MarkdownFile[] = [];
  walk(dir, dir, config, files);
  return files;
}

export function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content;
  const end = content.indexOf('---', 3);
  return end === -1 ? content : content.slice(end + 3).trimStart();
}

function walk(root: string, current: string, config: KBConfig, acc: MarkdownFile[]): void {
  const entries = readdirSync(current, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(current, entry.name);
    const relPath = fullPath.slice(root.length + 1).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      walk(root, fullPath, config, acc);
    } else if (extname(entry.name) === '.md') {
      const included = config.includeGlobs.some((glob) =>
        minimatch(relPath, glob, { matchBase: false })
      );
      if (included) {
        const raw = readFileSync(fullPath, 'utf-8');
        acc.push({ path: relPath, content: stripFrontmatter(raw) });
      }
    }
  }
}
