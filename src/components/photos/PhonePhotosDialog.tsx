'use client';

import { useEffect, useRef, useState } from 'react';
import { Smartphone, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useClaimStore } from '@/stores/claim-store';
import { readDocument } from '@/lib/documents/folder';
import { photoGroups, skipsAlreadyAdded, tagFromGroup } from '@/lib/scan-import/phone-files';
import { toastPhoneReadError } from '@/components/documents/UsePhoneFiles';
import type { PhotoMeta } from '@/hooks/usePhotoUpload';
import type { ClaimDocument } from '@/types/documents';

/** Thumbnails read at once: enough to fill the grid quickly without freezing on a 24+ photo group. */
const THUMB_READERS = 3;

interface Props {
  /** The Photos tab's compress-and-add path (same as Gallery / Browse). */
  onAdd: (files: File[], meta: PhotoMeta[]) => void;
  disabled?: boolean;
}

/** "Use phone files" on the Photos tab: phone photos land as a selection; nothing reaches the sheet without the Add click. */
export function PhonePhotosDialog({ onAdd, disabled }: Props) {
  const claim = useClaimStore((s) => s.currentClaim);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // doc id -> object URL; '' = could not be read.
  const [thumbs, setThumbs] = useState<Readonly<Record<string, string>>>({});
  const files = useRef(new Map<string, File>());
  const claimId = claim?.id;

  // Read thumbnails a few at a time while open; revoke every URL on close or claim switch.
  useEffect(() => {
    const current = useClaimStore.getState().currentClaim;
    if (!open || !current) return;
    let stop = false;
    let warned = false;
    const urls: string[] = [];
    const queue = photoGroups(current).flatMap((g) => g.docs);
    const reader = async () => {
      for (let d = queue.shift(); d && !stop; d = queue.shift()) {
        const doc = d;
        try {
          const file = await readDocument(current, doc);
          if (stop) return;
          files.current.set(doc.id, file);
          const url = URL.createObjectURL(file);
          urls.push(url);
          setThumbs((t) => ({ ...t, [doc.id]: url }));
        } catch (err) {
          if (stop) return;
          setThumbs((t) => ({ ...t, [doc.id]: '' }));
          if (!warned) { warned = true; toastPhoneReadError(err, doc.relPath); }
        }
      }
    };
    void Promise.all(Array.from({ length: THUMB_READERS }, reader));
    const held = files.current;
    return () => {
      stop = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
      held.clear();
      setThumbs({});
      setSelected(new Set());
    };
  }, [open, claimId]);

  const groups = claim ? photoGroups(claim) : [];
  if (!claim || groups.length === 0) return null;

  const addable = new Set(skipsAlreadyAdded(groups.flatMap((g) => g.docs), claim.photos).map((d) => d.id));
  const toggle = (ids: string[], on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const add = async () => {
    const picks = groups.flatMap((g) => g.docs.filter((d) => selected.has(d.id) && addable.has(d.id)).map((d) => ({ d, tag: tagFromGroup(g) })));
    if (picks.length === 0) return;
    setBusy(true);
    try {
      const read: { file: File; meta: PhotoMeta }[] = [];
      for (const { d, tag } of picks) {
        const file = files.current.get(d.id) ?? (await readOrToast(claim, d));
        if (file) read.push({ file, meta: { tag, sourceDocId: d.id } });
      }
      if (useClaimStore.getState().currentClaim?.id !== claim.id) return; // claim switched meanwhile: never add A's photos to B
      setOpen(false);
      if (read.length) onAdd(read.map((r) => r.file), read.map((r) => r.meta));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" className="gap-2 min-h-[44px] md:min-h-0 md:h-10" disabled={disabled} onClick={() => setOpen(true)}>
        <Smartphone size={16} />
        Use phone files
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Phone photos</DialogTitle>
          </DialogHeader>
          {groups.map((g) => {
            const free = g.docs.filter((d) => addable.has(d.id)).map((d) => d.id);
            const allOn = free.length > 0 && free.every((id) => selected.has(id));
            return (
              <section key={g.type} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">{g.label} <span className="text-muted-foreground">({g.docs.length})</span></h3>
                  <label className={`flex items-center gap-1.5 text-xs ${free.length ? 'cursor-pointer' : 'opacity-50'}`}>
                    <input type="checkbox" checked={allOn} disabled={!free.length || busy} onChange={(e) => toggle(free, e.target.checked)} />
                    Select all
                  </label>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {g.docs.map((d) => {
                    const added = !addable.has(d.id);
                    const url = thumbs[d.id];
                    return (
                      <label key={d.id} className={`relative block aspect-square rounded-md border border-border overflow-hidden bg-muted ${added ? 'opacity-50' : 'cursor-pointer'}`} title={d.relPath}>
                        {url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={d.relPath} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground p-1 text-center">
                            {url === '' ? "Can't preview" : <Loader2 size={14} className="animate-spin" />}
                          </span>
                        )}
                        <input
                          type="checkbox"
                          className="absolute top-1.5 left-1.5 h-4 w-4"
                          aria-label={d.relPath}
                          checked={added || selected.has(d.id)}
                          disabled={added || busy}
                          onChange={(e) => toggle([d.id], e.target.checked)}
                        />
                        {added && <span className="absolute bottom-0 inset-x-0 bg-background/80 text-[10px] text-center">Added</span>}
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <DialogFooter>
            <Button type="button" disabled={busy || ![...selected].some((id) => addable.has(id))} onClick={() => void add()}>
              {busy && <Loader2 size={16} className="animate-spin" />}
              Add to photo sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Read a photo whose thumbnail failed; toast and skip it if it still can't be read. */
async function readOrToast(claim: Parameters<typeof readDocument>[0], doc: ClaimDocument): Promise<File | undefined> {
  try {
    return await readDocument(claim, doc);
  } catch (err) {
    toastPhoneReadError(err, doc.relPath);
    return undefined;
  }
}
