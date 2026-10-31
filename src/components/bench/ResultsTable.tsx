import type { CellResult } from '@/lib/bench/store';
import type { BenchRow, PdfProfile } from '@/lib/bench/types';
import { limitsSource, proposeLimits } from '@/lib/bench/export-limits';
import { checkerVsGold, needsOwner, summarize } from './bench-logic';

interface Props { profiles: PdfProfile[]; cells: CellResult[]; gold: Record<string, BenchRow[] | undefined>; hardIds: string[] }

export function ResultsTable({ profiles, cells, gold, hardIds }: Props) {
  const { agree, total } = checkerVsGold(profiles, cells, gold);
  const greyed = total === 0 || agree !== total;
  const rows = summarize(cells);
  const owner = needsOwner(profiles, cells, gold);
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Results</h2>
      <button type="button" className="rounded border px-2 py-1 text-sm disabled:opacity-40" disabled={greyed}
        onClick={() => void navigator.clipboard.writeText(limitsSource(proposeLimits(cells, hardIds)))
          .then(() => alert('Limits table copied — paste it into src/lib/ai/page-limits.ts after review.'), e => alert(`Copy failed: ${e}`))}>
        Export limits table
      </button>
      <p className={greyed ? 'text-sm font-medium text-red-600' : 'text-sm text-slate-700'}>
        Checker vs gold: {agree}/{total} agree
        {total === 0 ? ". Lock at least one gold PDF — results don't count until the checker agrees with gold" : greyed ? '. Fix the checker before trusting the results below.' : ''}
      </p>
      <div data-greyed={greyed ? 'true' : 'false'} className={greyed ? 'opacity-40' : ''}>
        <table className="w-full text-sm">
          <thead><tr className="text-left">
            <th>Model</th><th>Method</th><th>Max passing pages</th><th>Max rows per call</th><th>Tokens per correct row</th><th>Errors</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} className="border-t">
                <td>{r.provider} / {r.model}{r.stale && <span className="ml-1 rounded bg-amber-100 px-1 text-xs">stale</span>}</td>
                <td>{r.method}</td>
                <td>{r.maxPages ?? 'none'}</td>
                <td>{r.maxRowsPerCall}</td>
                <td>{r.tokensPerRow ?? 'n/a'}</td>
                <td>{Object.entries(r.errors).map(([t, n]) => `${t} ${n}`).join(', ') || 'none'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="mt-3 font-medium">Needs owner (no gold, no agreeing pair)</h3>
        <ul className="list-disc pl-5 text-sm">
          {owner.length ? owner.map(p => <li key={p.id}>{p.fileName}</li>) : <li>None</li>}
        </ul>
      </div>
    </section>
  );
}
