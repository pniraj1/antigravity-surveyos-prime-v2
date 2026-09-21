'use client';
import React, { useRef, useState } from 'react';
import { ExternalLink, Trash2, Plus, HardDrive } from 'lucide-react';
import type { ClaimDocument, DocType } from '@/types/documents';
import { DOC_TYPE_LABEL } from '@/types/documents';

interface Props {
  documents: Array<ClaimDocument & { here: boolean }>;
  connected: boolean;
  onAdd: (type: DocType, files: File[]) => void;
  onOpen: (doc: ClaimDocument) => void;
  onRemove: (doc: ClaimDocument) => void;
}

const kb = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const SOURCE_ICON: Record<ClaimDocument['source'], string> = { upload: '⬆', generated: '⚙', photo: '📷' };

export function ClaimDocumentsList({ documents, connected, onAdd, onOpen, onRemove }: Props) {
  const [type, setType] = useState<DocType>('other');
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Documents · {documents.length}</div>
        {connected && (
          <div className="flex items-center gap-2">
            <select value={type} onChange={(e) => setType(e.target.value as DocType)} className="text-xs rounded border border-border bg-background px-2 py-1">
              {(Object.keys(DOC_TYPE_LABEL) as DocType[]).map((t) => <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>)}
            </select>
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary text-primary-foreground">
              <Plus size={12} /> Add file
            </button>
            <input
              ref={fileRef} type="file" multiple className="hidden"
              onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) onAdd(type, fs); }}
            />
          </div>
        )}
      </div>
      {documents.length === 0 ? (
        <div className="px-4 py-6 text-xs text-muted-foreground text-center">
          {connected ? 'Nothing yet. Uploads, photos and printed reports will appear here.' : 'Connect a claim folder to keep files here.'}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-2 text-xs">
              <span title={d.source}>{SOURCE_ICON[d.source]}</span>
              <span className="font-medium w-44 shrink-0 truncate">{DOC_TYPE_LABEL[d.type]}</span>
              <span className="font-mono truncate flex-1 text-muted-foreground">{d.relPath}</span>
              <span className="text-muted-foreground w-16 text-right">{kb(d.size)}</span>
              <span className={`inline-flex items-center gap-1 w-28 ${d.here ? 'text-emerald-700' : 'text-amber-700'}`}>
                <HardDrive size={12} /> {d.here ? 'here' : `on ${d.devices.join(', ') || '?'}`}
              </span>
              <button onClick={() => onOpen(d)} disabled={!d.here} title="Open" className="p-1 rounded hover:bg-muted disabled:opacity-40"><ExternalLink size={14} /></button>
              <button onClick={() => onRemove(d)} title="Remove from list (file stays on disk)" className="p-1 rounded hover:bg-muted text-destructive"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
