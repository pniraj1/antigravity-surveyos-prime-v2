import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub the only DOM API the plain-image branch of fileToImages touches.
globalThis.FileReader = class {
  onload: any;
  onerror: any;
  readAsDataURL(f: Blob) {
    f.arrayBuffer().then(b => this.onload?.({ target: { result: 'data:image/png;base64,' + Buffer.from(b).toString('base64') } }));
  }
} as any;

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

vi.mock('../service', () => {
  class AllProvidersBusyError extends Error {
    tried: string[];
    constructor(job: string, tried: string[]) { super(`All AI models are busy (${job}: tried ${tried.join(', ') || 'none'})`); this.tried = tried; }
  }
  class OfflineError extends Error { constructor() { super("You're offline"); } }
  class ProviderError extends Error {
    provider: string; status: number;
    constructor(provider: string, status: number, message: string) { super(message); this.provider = provider; this.status = status; }
  }
  return {
    callAIGateway: vi.fn(),
    getActiveImageCap: () => 1,
    newSession: (id: string) => ({ id, avoid: new Set(), announced: new Set(), lastGood: undefined as { provider: string; model: string } | undefined }),
    AllProvidersBusyError,
    OfflineError,
    ProviderError,
  };
});

import { callAIGateway } from '../service';
import { extractDocument } from '../processor';

const gw = callAIGateway as unknown as ReturnType<typeof vi.fn>;

// Every mocked reply also marks the session as having a "good" model — the
// real callAIGateway does this on success (service.ts) and the second-opinion
// branch in processor.ts is gated on session.lastGood being set.
let queued: string[] = [];
function queue(...responses: string[]) { queued.push(...responses); }
beforeEach(() => {
  queued = [];
  gw.mockReset();
  gw.mockImplementation(async (_prompt: string, _images: string[], _jobType: string, _job: string, session?: { lastGood?: unknown }) => {
    if (session) session.lastGood = { provider: 'test', model: 'test-model' };
    const next = queued.shift();
    if (next === undefined) throw new Error('unexpected extra callAIGateway call in test');
    return next;
  });
});

function pngFile(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
}

const threeFiles = () => [pngFile('p0.png'), pngFile('p1.png'), pngFile('p2.png')];

describe('extractDocument — image path (estimate)', () => {
  it('(a) clean read: 3 calls, one per page, each row tagged with its chunk page, no findings', async () => {
    queue(
      JSON.stringify({ spare_parts: [{ sr_no: 1, total_amount: 10 }, { sr_no: 2, total_amount: 10 }] }),
      JSON.stringify({ spare_parts: [{ sr_no: 3, total_amount: 10 }, { sr_no: 4, total_amount: 10 }] }),
      JSON.stringify({ labour_items: [{ sr_no: 5, total_amount: 10 }], gross_amount: 50 }),
    );

    const { data, findings } = await extractDocument('estimate', threeFiles());

    expect(gw).toHaveBeenCalledTimes(3);
    expect(gw.mock.calls[0][4]?.pagesTotal).toBe(3);
    const parts = data.spare_parts;
    expect(parts.every((r: any) => typeof r._page === 'number')).toBe(true);
    expect(parts.find((r: any) => r.sr_no === 1)._page).toBe(0);
    expect(parts.find((r: any) => r.sr_no === 2)._page).toBe(0);
    expect(parts.find((r: any) => r.sr_no === 3)._page).toBe(1);
    expect(parts.find((r: any) => r.sr_no === 4)._page).toBe(1);
    expect(data.labour_items[0]._page).toBe(2);
    expect(findings).toEqual([]);
  });

  it('(b) chunk 2 omits serial 3 → a targeted re-read call for page 2 fills it in', async () => {
    // Both neighbours of the missing serial (2 and 4) land on page 1 so the
    // gap resolves to a single extra page, exercising exactly one gap call.
    queue(
      JSON.stringify({ spare_parts: [{ sr_no: 1, total_amount: 10 }] }),
      JSON.stringify({ spare_parts: [{ sr_no: 2, total_amount: 10 }, { sr_no: 4, total_amount: 10 }] }),
      JSON.stringify({ labour_items: [{ sr_no: 5, total_amount: 10 }], gross_amount: 50 }),
      JSON.stringify({ spare_parts: [{ sr_no: 3, total_amount: 10 }] }),
    );

    const { data, findings } = await extractDocument('estimate', threeFiles());

    expect(gw).toHaveBeenCalledTimes(4);
    const fourthCall = gw.mock.calls[3];
    expect(fourthCall[1]).toHaveLength(1);            // images arg: one page
    expect(fourthCall[0]).toContain('3');
    expect(fourthCall[0]).toContain('TARGETED RE-READ of page 2');

    const row3 = data.spare_parts.find((r: any) => r.sr_no === 3);
    expect(row3).toBeTruthy();
    expect(row3._page).toBe(1);
    expect(findings).toEqual([]);
  });

  describe('(c) gross-off, no gaps → second opinion', () => {
    it('c1: second pass reconciles → reconciled gross wins, no findings', async () => {
      queue(
        JSON.stringify({ spare_parts: [{ sr_no: 1, total_amount: 10 }, { sr_no: 2, total_amount: 10 }] }),
        JSON.stringify({ spare_parts: [{ sr_no: 3, total_amount: 10 }, { sr_no: 4, total_amount: 10 }] }),
        JSON.stringify({ labour_items: [{ sr_no: 5, total_amount: 10 }], gross_amount: 550 }),
        JSON.stringify({ spare_parts: [{ sr_no: 1, total_amount: 10 }, { sr_no: 2, total_amount: 10 }] }),
        JSON.stringify({ spare_parts: [{ sr_no: 3, total_amount: 10 }, { sr_no: 4, total_amount: 10 }] }),
        JSON.stringify({ labour_items: [{ sr_no: 5, total_amount: 10 }], gross_amount: 50 }),
      );

      const { data, findings } = await extractDocument('estimate', threeFiles());

      expect(gw).toHaveBeenCalledTimes(6);
      expect(data.gross_amount).toBe(50);
      expect(findings).toEqual([]);
    });

    it('c2: second pass still off and missing serial 3 → first result kept', async () => {
      queue(
        JSON.stringify({ spare_parts: [{ sr_no: 1, total_amount: 10 }, { sr_no: 2, total_amount: 10 }] }),
        JSON.stringify({ spare_parts: [{ sr_no: 3, total_amount: 10 }, { sr_no: 4, total_amount: 10 }] }),
        JSON.stringify({ labour_items: [{ sr_no: 5, total_amount: 10 }], gross_amount: 550 }),
        JSON.stringify({ spare_parts: [{ sr_no: 1, total_amount: 10 }, { sr_no: 2, total_amount: 10 }] }),
        JSON.stringify({ spare_parts: [{ sr_no: 4, total_amount: 10 }] }),
        JSON.stringify({ labour_items: [{ sr_no: 5, total_amount: 10 }], gross_amount: 550 }),
      );

      const { data, findings } = await extractDocument('estimate', threeFiles());

      expect(gw).toHaveBeenCalledTimes(6);
      expect(data.gross_amount).toBe(550);
      expect(data.spare_parts.find((r: any) => r.sr_no === 3)).toBeTruthy();
      expect(findings).toHaveLength(1);
      expect(findings[0].kind).toBe('gross');
    });
  });

  it('(d) unnumbered: every page restarts at 1..2, rows sum to gross → all 6 rows kept, no findings', async () => {
    queue(
      JSON.stringify({ spare_parts: [{ sr_no: 1, total_amount: 10 }, { sr_no: 2, total_amount: 10 }] }),
      JSON.stringify({ spare_parts: [{ sr_no: 1, total_amount: 10 }, { sr_no: 2, total_amount: 10 }] }),
      JSON.stringify({ spare_parts: [{ sr_no: 1, total_amount: 10 }, { sr_no: 2, total_amount: 10 }], gross_amount: 60 }),
    );

    const { data, findings } = await extractDocument('estimate', threeFiles());

    expect(gw).toHaveBeenCalledTimes(3);
    expect(data.spare_parts).toHaveLength(6);
    expect(findings).toEqual([]);
  });
});
