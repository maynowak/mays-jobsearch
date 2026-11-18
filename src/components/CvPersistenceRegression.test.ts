import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

describe('JM-CV-UX-07: persistent CV processing must not hide the durable list', () => {
  it('does not switch from persistent to session mode while handing a downloaded PDF to the workflow', () => {
    const start = app.indexOf('const handleProcessPersistentCv');
    const end = app.indexOf('const handleAddCvFromLetter', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const handler = app.slice(start, end);

    expect(handler).toContain('handleCvUploadStart');
    expect(handler).not.toContain('setCvStorageMode("session")');
  });
});
