'use client';

import React, { useEffect, useState } from 'react';
import { FileWarning, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  listParserSamples, loadParserSample, deleteParserSample, openSaveTarget, saveToTarget, type ParserSampleMeta,
} from '@/lib/ai/parser-sample';

type Row = ParserSampleMeta & { id: string };

const daysLeft = (r: Row) => Math.max(0, Math.ceil((r.expireAt.toMillis() - Date.now()) / 86_400_000));
const msg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export function ParserSamplesCard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listParserSamples().then(setRows).catch((e: unknown) => {
      toast.error(msg(e, 'Could not load unread bills'));
      setFailed(true);
      setRows([]);
    });
  }, []);

  const download = async (r: Row) => {
    setBusy(r.id);
    const name = r.fileName || `parser-sample-${r.id.slice(0, 8)}.pdf`;
    let saved = false;
    try {
      const target = await openSaveTarget(name); // first await: keeps the click's user activation
      if (!target) return;
      const blob = await loadParserSample(r.id, r.chunks, r.size);
      saved = await saveToTarget(target, blob, name);
      if (!saved) return;
      await deleteParserSample(r.id, r.chunks);
      setRows(cur => (cur ?? []).filter(x => x.id !== r.id));
    } catch (e: unknown) {
      toast.error(saved ? "Saved, but couldn't delete it from the server." : msg(e, 'Download failed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 flex items-center gap-3 border-b border-border" style={{ background: 'var(--color-neutral-50)' }}>
        <FileWarning size={16} className="text-primary" />
        <h2 className="text-sm font-medium text-foreground">Bills the parser couldn&apos;t read</h2>
      </div>
      <div className="p-6 space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p className="text-xs">
          Download a bill to work on the parser. Downloading deletes it from the server; anything left is deleted automatically 15 days after it arrived.
        </p>
        {rows === null ? (
          <Loader2 size={14} className="animate-spin" />
        ) : failed ? (
          <p className="text-xs">Couldn&apos;t load samples.</p>
        ) : rows.length === 0 ? (
          <p className="text-xs">No unread bills right now.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map(r => (
              <li key={r.id} className="flex items-start gap-3 p-3 rounded-xl border border-border text-xs">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="font-medium text-foreground break-all">{r.fileName}</div>
                  <div>{r.docType} · {r.pages} pages · {Math.round(r.size / 1024)} KB</div>
                  <div>{r.reason}</div>
                  <div>Received {r.createdAt.toDate().toLocaleDateString()} · {daysLeft(r)} days left</div>
                </div>
                <button
                  onClick={() => download(r)}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {busy === r.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
