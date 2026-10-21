'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileText, HelpCircle, ImageOff, XCircle } from 'lucide-react';
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType, PageLabel } from '@/types/documents';
import { DOC_TYPE_LABEL } from '@/types/documents';
import { readDocument } from '@/lib/documents/folder';
import { CANT_OPEN_PDF } from '@/lib/documents/kit/build';
import type { IdentityResult } from '@/lib/documents/kit/identity';
import { neededTypesFirst, nextSelection, pageKey, pageNumbers, selectionByDoc } from '@/lib/documents/kit/page-grid';
import type { DocumentKit } from '@/lib/documents/kit/useDocumentKit';
import { loadPdf, PDF_THUMB_QUALITY, PDF_THUMB_WIDTH } from '@/lib/photos/pdf-to-images';

interface Props {
  claim: ClaimData;
  /** Only the files whose bytes are on this PC. */
  documents: ClaimDocument[];
  kit: DocumentKit;
}

const ALL_TYPES = Object.keys(DOC_TYPE_LABEL) as DocType[];

// ── Thumbnails ──────────────────────────────────────────────────────────────
interface ThumbSource { pages: number; thumb(page: number): Promise<string>; close(): void }

const CANT_OPEN = CANT_OPEN_PDF;

async function openSource(claim: ClaimData, doc: ClaimDocument): Promise<ThumbSource> {
  const file = await readDocument(claim, doc);
  if (/\.pdf$/i.test(doc.relPath) || doc.mime === 'application/pdf') {
    const pdf = await loadPdf(file);
    return {
      pages: pdf.numPages,
      thumb: async (page) => (await pdf.renderPage(page, PDF_THUMB_WIDTH, PDF_THUMB_QUALITY)).dataUrl,
      close: () => { void pdf.destroy(); },
    };
  }
  const url = URL.createObjectURL(file);
  return { pages: 1, thumb: async () => url, close: () => URL.revokeObjectURL(url) };
}

// ── Small pieces ────────────────────────────────────────────────────────────
function LabelChip({ label }: { label?: PageLabel }) {
  if (!label) {
    return <span className="inline-block max-w-full truncate rounded-md border-2 border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Not labelled</span>;
  }
  return (
    <span
      title={label.confirmed ? 'Confirmed' : 'A suggestion. Not confirmed yet.'}
      className={`inline-block max-w-full truncate rounded-md border-2 px-1.5 py-0.5 text-[10px] font-medium ${
        label.confirmed ? 'border-solid border-primary text-foreground' : 'border-dotted border-amber-500 text-amber-800'
      }`}
    >
      {DOC_TYPE_LABEL[label.type]}
    </span>
  );
}

function IdentityMark({ result, overridden }: { result: IdentityResult; overridden: boolean }) {
  if (result.status === 'match') {
    return <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700"><CheckCircle2 size={11} /> matches this claim</span>;
  }
  if (result.status === 'mismatch') {
    return (
      <span className={`inline-flex items-start gap-1 text-[10px] ${overridden ? 'text-amber-700' : 'text-red-600'}`}>
        <XCircle size={11} className="mt-px shrink-0" />
        <span>{`doesn't match${result.found ? `: shows ${result.found}` : ''}${overridden ? ' (used anyway)' : ''}`}</span>
      </span>
    );
  }
  if (result.status === 'pending') return <span className="text-[10px] text-muted-foreground">checking…</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><HelpCircle size={11} /> can&apos;t check</span>;
}

function Tile({ page, src, selected, label, identity, onPick, onVisible, onUseAnyway }: {
  page: number; src: string | undefined; selected: boolean; label?: PageLabel; identity?: IdentityResult;
  onPick: (shift: boolean) => void; onVisible: (page: number) => void; onUseAnyway: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { onVisible(page); io.disconnect(); }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [page, onVisible]);

  const mismatch = identity?.status === 'mismatch';
  return (
    <div
      ref={box} role="button" tabIndex={0} aria-pressed={selected} aria-label={`Page ${page}`}
      onClick={(e) => onPick(e.shiftKey)}
      onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(e.shiftKey); } }}
      className={`flex cursor-pointer select-none flex-col gap-1.5 rounded-md border p-2 ${selected ? 'border-primary ring-2 ring-primary' : 'border-border hover:border-primary'}`}
    >
      <div className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded bg-muted">
        {src === undefined ? <div className="h-full w-full animate-pulse bg-muted" /> : src === '' ? <ImageOff size={20} className="text-muted-foreground" /> : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`Page ${page}`} className="h-full w-full object-contain" draggable={false} />
        )}
      </div>
      <div className="text-[10px] text-muted-foreground">Page {page}</div>
      <LabelChip label={label} />
      {label && identity && <IdentityMark result={identity} overridden={!!label.overrideAt} />}
      {label && mismatch && !label.overrideAt && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onUseAnyway(); }}
          className="self-start rounded border border-red-300 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-50"
        >
          Use anyway
        </button>
      )}
    </div>
  );
}

// ── One file ────────────────────────────────────────────────────────────────
interface FileProps {
  claim: ClaimData; doc: ClaimDocument; pages: number[] | null; selected: ReadonlySet<string>;
  identity?: Record<number, IdentityResult>;
  onPick: (key: string, shift: boolean) => void; onUseAnyway: (docId: string, page: number) => void;
}

/** Remounted (via `key`) when the file changes on disk, which drops the old thumbnails. */
function FileSection({ claim, doc, pages, selected, identity, onPick, onUseAnyway }: FileProps) {
  const [thumbs, setThumbs] = useState<Record<number, string>>({}); // '' = could not render
  const [failed, setFailed] = useState(false); // the file as a whole cannot be opened
  const [opened, setOpened] = useState(0); // page count from opening the file, when the claim doesn't know it yet
  const latest = useRef({ claim, doc });
  useEffect(() => { latest.current = { claim, doc }; });
  const run = useRef<{ source: Promise<ThumbSource> | null; asked: Set<number>; dead: boolean }>({ source: null, asked: new Set(), dead: false });

  useEffect(() => {
    const state = { source: null as Promise<ThumbSource> | null, asked: new Set<number>(), dead: false };
    run.current = state;
    return () => { state.dead = true; void state.source?.then((s) => s.close(), () => undefined); };
  }, []);

  // The file is opened once, by the first tile that scrolls into view.
  const open = useCallback(() => {
    const state = run.current;
    state.source ??= openSource(latest.current.claim, latest.current.doc);
    state.source.catch(() => { if (!state.dead) setFailed(true); });
    return state;
  }, []);

  const onVisible = useCallback((page: number) => {
    const state = open();
    if (state.asked.has(page)) return;
    state.asked.add(page);
    state.source!.then(
      (s) => s.thumb(page).then(
        (url) => { if (!state.dead) setThumbs((t) => ({ ...t, [page]: url })); },
        () => { if (!state.dead) setThumbs((t) => ({ ...t, [page]: '' })); },
      ),
      () => undefined, // the whole file failed: `open` reports it
    );
  }, [open]);

  // No page count yet means no tiles to trigger the open: try it here, so a PDF that cannot be read says so.
  const unknownCount = pages !== null && pages.length === 0;
  useEffect(() => {
    if (!unknownCount) return;
    const state = open();
    state.source!.then((s) => { if (!state.dead) setOpened(s.pages); }, () => undefined);
  }, [unknownCount, open]);

  const shown = unknownCount && opened > 0 ? Array.from({ length: opened }, (_, i) => i + 1) : pages;

  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="truncate font-mono text-muted-foreground">{doc.relPath}</span>
      </div>
      {failed && shown && shown.length > 0 && <div className="mb-2 text-xs text-red-600">{CANT_OPEN}</div>}
      {pages === null ? (
        <div className="flex w-40 flex-col gap-1.5 rounded-md border border-border p-2">
          <div className="flex aspect-[3/4] w-full items-center justify-center rounded bg-muted"><FileText size={24} className="text-muted-foreground" /></div>
          <LabelChip label={{ type: doc.type, by: 'known', confirmed: true }} />
        </div>
      ) : failed && shown?.length === 0 ? (
        <div className="text-xs text-red-600">{CANT_OPEN}</div>
      ) : shown?.length === 0 ? (
        <div className="text-xs text-muted-foreground">Reading the pages…</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {shown?.map((n) => (
            <Tile
              key={n} page={n} src={failed ? '' : thumbs[n]} selected={selected.has(pageKey(doc.id, n))}
              label={doc.pages?.[n]} identity={identity?.[n]}
              onPick={(shift) => onPick(pageKey(doc.id, n), shift)} onVisible={onVisible}
              onUseAnyway={() => onUseAnyway(doc.id, n)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── The Pages view ──────────────────────────────────────────────────────────
export function PageLabelGrid({ claim, documents, kit }: Props) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const anchor = useRef<string | null>(null);

  const entries = useMemo(() => documents.map((doc) => ({ doc, pages: pageNumbers(doc) })), [documents]);
  const order = useMemo(() => entries.flatMap(({ doc, pages }) => (pages ?? []).map((n) => pageKey(doc.id, n))), [entries]);
  const { needed, rest } = useMemo(() => neededTypesFirst(kit.states, ALL_TYPES), [kit.states]);
  const guesses = documents.reduce(
    (sum, d) => sum + Object.values(d.pages ?? {}).filter((l) => !l.confirmed && (l.by === 'text' || l.by === 'name')).length, 0,
  );
  const chosen = order.filter((k) => selected.has(k)).length;

  const onPick = useCallback((key: string, shift: boolean) => {
    const next = nextSelection(order, selected, anchor.current, key, shift);
    anchor.current = next.anchor;
    setSelected(next.selected);
  }, [order, selected]);

  const applyType = (type: DocType) => {
    for (const [docId, pages] of selectionByDoc(order, selected)) kit.setLabels(docId, pages, type);
    anchor.current = null;
    setSelected(new Set());
  };

  const typeButton = (t: DocType, highlight: boolean) => (
    <button
      key={t} type="button" disabled={chosen === 0} onClick={() => applyType(t)}
      className={`rounded-lg border px-2 py-1 text-[11px] font-medium disabled:opacity-40 ${highlight ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
    >
      {DOC_TYPE_LABEL[t]}
    </button>
  );

  return (
    <div id="document-pages" className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pages · {order.length}</div>
        <button
          type="button" onClick={kit.confirmAll} disabled={guesses === 0}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          <CheckCircle2 size={12} /> Confirm all suggestions{guesses ? ` (${guesses})` : ''}
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">No files on this PC to label yet. Add files or press Scan folder.</div>
      ) : (
        <>
          <div className="sticky top-0 z-10 space-y-1.5 border-b border-border bg-card px-4 py-2">
            <div className="text-[11px] text-muted-foreground">
              {chosen ? `${chosen} page${chosen === 1 ? '' : 's'} selected. Tap what they are.` : 'Click pages to select them (Shift+click for a range), then tap what they are.'}
            </div>
            {needed.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Still needed</span>
                {needed.map((t) => typeButton(t, true))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{needed.length ? 'Others' : 'All types'}</span>
              {rest.map((t) => typeButton(t, false))}
            </div>
          </div>
          <div className="divide-y divide-border">
            {entries.map(({ doc, pages }) => (
              <FileSection
                key={`${doc.id}|${doc.size}|${JSON.stringify(doc.fingerprints ?? null)}`}
                claim={claim} doc={doc} pages={pages} selected={selected} identity={kit.identity[doc.id]}
                onPick={onPick} onUseAnyway={kit.useAnyway}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
