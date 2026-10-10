import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the layer dependency rule documented in docs/ARCHITECTURE.md:
 * domain ← application ← { infrastructure, presentation }.
 */
const SRC = dirname(fileURLToPath(import.meta.url));
const LAYERS = ['domain', 'application', 'infrastructure', 'presentation', 'config'] as const;
type Layer = (typeof LAYERS)[number];

const ALLOWED: Record<Layer, Layer[]> = {
  domain: ['domain'],
  application: ['application', 'domain'],
  infrastructure: ['infrastructure', 'application', 'domain'],
  presentation: ['presentation', 'application', 'domain', 'config'],
  config: ['config', 'domain'],
};

/** Pure presentation modules must not depend on React or Three.js. */
const PURE_DIRS = ['presentation/world', 'presentation/animation'];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') ? [p] : [];
  });
}

function layerOf(path: string): Layer | null {
  const top = relative(SRC, path).split(/[\\/]/)[0];
  return (LAYERS as readonly string[]).includes(top) ? (top as Layer) : null;
}

function importsOf(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  return [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

function resolveImport(file: string, spec: string): string | null {
  const alias = spec.match(/^@(domain|application|infrastructure|presentation|config)\/(.*)$/);
  if (alias) return join(SRC, alias[1], alias[2]);
  if (spec.startsWith('.')) return resolve(dirname(file), spec);
  return null;
}

describe('architecture', () => {
  const all = files(SRC);

  it('respects the layer dependency rule', () => {
    const violations: string[] = [];
    for (const file of all) {
      const from = layerOf(file);
      if (!from) continue;
      for (const spec of importsOf(file)) {
        const target = resolveImport(file, spec);
        const to = target && layerOf(target);
        if (to && !ALLOWED[from].includes(to)) violations.push(`${relative(SRC, file)} → ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps world/ and animation/ free of React and Three.js', () => {
    const violations = all
      .filter((f) => PURE_DIRS.some((d) => relative(SRC, f).startsWith(d)))
      .flatMap((f) => importsOf(f).filter((s) => /^(react|three|@react-three)/.test(s)).map((s) => `${relative(SRC, f)} → ${s}`));
    expect(violations).toEqual([]);
  });
});
