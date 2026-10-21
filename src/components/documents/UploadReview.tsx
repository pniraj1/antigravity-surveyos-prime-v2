'use client';
import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileText, ImageOff } from 'lucide-react';
import type { UploadSet } from '@/types/documents';
import { canTick, droppedReviews, formatSize, identityMarks } from '@/lib/documents/kit/panel';
import { RECIPES } from '@/lib/documents/kit/recipes';
import { isReviewed } from '@/lib/documents/kit/review';
import type { BuiltFile, DocumentKit } from '@/lib/documents/kit/useDocumentKit';
import { loadPdf, PDF_THUMB_QUALITY, PDF_THUMB_WIDTH } from '@/lib/photos/pdf-to-images';

interface Props {
  kit: DocumentKit;
  set: UploadSet;
  /** The files built this session. Null after a reload: the numbers still show, the previews don't. */
  files: BuiltFile[] | null;
}

type Thumbs = { blob?: Blob; urls: string[]; failed: boolean };

/** Every page of a built file as an image: PDF pages are rendered, an image is shown as is, other files get none. */
function useThumbs(file: BuiltFile | undefined): Thumbs {
  const [thumbs, setThumbs] = useState<Thumbs>({ urls: [], failed: false });
  const blob = file?.blob;
  // State from an earlier blob is ignored, so a rebuilt file never shows the old pages.
  const name = file?.name ?? '';
  useEffect(() => {
    if (!blob) return;
    let dead = false;
    let objectUrl: string | null = null;
    let pdf: Awaited<ReturnType<typeof loadPdf>> | null = null;
    if (blob.type.startsWith('image/')) {
      objectUrl = URL.createObjectURL(blob);
      const url = objectUrl;
      void Promise.resolve().then(() => { if (!dead) setThumbs({ blob, urls: [url], failed: false }); });
    } else if (blob.type === 'application/pdf' || /\.pdf$/i.test(name)) {
      void (async () => {
        try {
          pdf = await loadPdf(new File([blob], name, { type: 'application/pdf' }));
          for (let n = 1; n <= pdf.numPages && !dead; n++) {
            const { dataUrl } = await pdf.renderPage(n, PDF_THUMB_WIDTH, PDF_THUMB_QUALITY);
            if (!dead) setThumbs((t) => ({ blob, failed: false, urls: [...(t.blob === blob ? t.urls : []), dataUrl] }));
          }
        } catch {
          if (!dead) setThumbs((t) => ({ blob, urls: t.blob === blob ? t.urls : [], failed: true }));
        }
      })();
    }
    return () => {
      dead = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      void pdf?.destroy();
    };
  }, [blob, name]);
  return thumbs.blob === blob ? thumbs : { urls: [], failed: false };
}

function BoxReview({ kit, boxId, built, file, matches }: { kit: DocumentKit; boxId: string; built: UploadSet['boxes'][string]; file?: BuiltFile; matches: boolean }) {
  const state = kit.states.find((s) => s.box.id === boxId);
  const blocked = kit.review.blocked.includes(boxId);
  const reviewed = !!built.reviewedAt;
  const tickable = canTick({ built: !!file, entry: built, state, setMatchesRecipe: matches });
  const { urls, failed } = useThumbs(file);
  const marks = state ? identityMarks(state, kit.identity) : null;
  const markText = marks
    ? [marks.match && `${marks.match} match this claim`, marks.mismatch && `${marks.mismatch} don't match`, marks.cantCheck && `${marks.cantCheck} can't be checked`, marks.pending && `${marks.pending} still being checked`].filter(Boolean).join(' · ')
    : '';
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{state?.box.label ?? built.name}</span>
            {blocked && <span className="rounded-md border border-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Needs you</span>}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {built.name} · {built.pages} page{built.pages === 1 ? '' : 's'} · {formatSize(built.size)}
          </div>
          {markText && <div className="text-[11px] text-muted-foreground">{markText}</div>}
          {blocked && state?.reasons.map((r) => <div key={r} className="text-[11px] text-amber-800">{r}</div>)}
          {built.stale && <div className="text-[11px] font-medium text-amber-800">Changed since it was built: build again.</div>}
          {built.written === false && !built.stale && <div className="text-[11px] font-medium text-amber-800">Not saved to the folder until it&apos;s confirmed.</div>}
        </div>
        <label className={`inline-flex items-center gap-1.5 text-xs font-medium ${reviewed || tickable ? '' : 'opacity-50'}`} title={blocked ? 'Fix the box in the checklist first.' : undefined}>
          <input
            type="checkbox" checked={reviewed} disabled={reviewed || !tickable}
            onChange={() => kit.review.markReviewed(boxId)}
          />
          Looks right
        </label>
      </div>
      {!file ? (
        <div className="text-[11px] text-muted-foreground">Build again to see the previews.</div>
      ) : failed && urls.length === 0 ? (
        <div className="flex items-center gap-1 text-[11px] text-red-600"><ImageOff size={13} /> Could not draw a preview of this file.</div>
      ) : urls.length === 0 && !file.blob.type.startsWith('image/') && file.blob.type !== 'application/pdf' ? (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><FileText size={13} /> No preview for this kind of file.</div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
          {urls.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={u} alt={`${state?.box.label ?? built.name} page ${i + 1}`} className="aspect-[3/4] w-full rounded border border-border bg-muted object-contain" />
          ))}
        </div>
      )}
    </div>
  );
}

export function UploadReview({ kit, set, files }: Props) {
  const reviewed = isReviewed(set);
  // The set may have been built for another portal list (the flow was switched since): name its own folder and don't offer ticks.
  const matches = set.portal === kit.recipe?.portal && set.flow === kit.recipe?.flow;
  const title = RECIPES.find((r) => r.portal === set.portal && r.flow === set.flow)?.title ?? set.flow;
  const allTickable = matches && Object.entries(set.boxes).every(([id, b]) =>
    canTick({ built: !!files?.some((f) => f.boxId === id), entry: b, state: kit.states.find((x) => x.box.id === id), setMatchesRecipe: matches }));
  // A review that disappears while the same set is on screen means a source or a claim field changed.
  const reviewedIds = Object.keys(set.boxes).filter((id) => set.boxes[id].reviewedAt);
  const [seen, setSeen] = useState({ builtAt: set.builtAt, ids: reviewedIds, changed: false });
  if (seen.builtAt !== set.builtAt) {
    setSeen({ builtAt: set.builtAt, ids: reviewedIds, changed: false });
  } else if (seen.ids.join() !== reviewedIds.join()) {
    setSeen({ builtAt: set.builtAt, ids: reviewedIds, changed: seen.changed || droppedReviews(seen.ids, set.boxes).length > 0 });
  }
  const changed = seen.changed;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="text-xs text-foreground">
          {reviewed ? (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
              <CheckCircle2 size={13} /> Upload set reviewed. Upload these files on the portal: Portal Upload/{title}/.
            </span>
          ) : (
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">Review upload set</span>
          )}
          {changed && !reviewed && <div className="mt-0.5 text-[11px] font-medium text-amber-800">Changed since review: check again.</div>}
        </div>
        <button
          type="button" onClick={() => kit.review.markReviewed('all')} disabled={reviewed || !allTickable}
          className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          All look right
        </button>
      </div>
      {matches ? (
        <div className="divide-y divide-border">
          {Object.entries(set.boxes).map(([id, built]) => (
            <BoxReview key={id} kit={kit} boxId={id} built={built} file={files?.find((f) => f.boxId === id)} matches={matches} />
          ))}
        </div>
      ) : (
        <div className="px-4 py-3 text-xs font-medium text-amber-800">This upload set was built for another portal list. Build again.</div>
      )}
    </div>
  );
}
