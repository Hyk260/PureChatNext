import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TEMPLATE_DIR = join(process.cwd(), 'src/libs/better-auth/email-templates/html');

const cache = new Map<string, string>();

export function loadTemplateHtml(name: string): string {
  if (!cache.has(name)) {
    cache.set(name, readFileSync(join(TEMPLATE_DIR, name), 'utf8'));
  }

  return cache.get(name)!;
}
