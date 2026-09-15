import { describe, it, expect } from 'vitest';
import { jobForDocType } from '../jobs';
import { readFileSync } from 'node:fs';

// Guard: no caller may call callAIGateway without a job. The default exists
// only so the compiler is happy mid-migration; every real call names its job.
describe('every callAIGateway caller names a job', () => {
  it('no two-argument calls remain in src/lib/ai', () => {
    for (const f of ['processor.ts', 'bank-statement-extractor.ts', 'insured-report.ts']) {
      const src = readFileSync(`src/lib/ai/${f}`, 'utf8');
      // ponytail: no 's' (dotAll) flag — [^;] already matches newlines, and the
      // project's ES2017 tsc target rejects the 's' flag on regex literals.
      const calls = [...src.matchAll(/callAIGateway\(([^;]*?)\)\s*;/g)].map(m => m[1]);
      for (const args of calls) expect(args, `${f}: callAIGateway(${args.slice(0, 60)}…)`).toMatch(/'(heavy|light|text)'|\bjob\b/);
    }
  });
  it('processor derives heavy for estimates', () => {
    expect(jobForDocType('estimate')).toBe('heavy');
  });
});
