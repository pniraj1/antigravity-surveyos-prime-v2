'use client';
import { useState, type ComponentProps } from 'react';
import { FolderOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClaimFolderCard } from './ClaimFolderCard';

type Props = ComponentProps<typeof ClaimFolderCard>;

/** The claim folder as one quiet line; the full ClaimFolderCard opens only from here. */
export function FolderLine({ supported, folder, onConnect, onReconnect }: Props) {
  const [open, setOpen] = useState(false);
  if (!supported) return <ClaimFolderCard supported={false} folder={null} onConnect={onConnect} onReconnect={onReconnect} />;

  const link = 'text-primary underline underline-offset-2 hover:opacity-80';
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <FolderOpen size={14} className="text-primary flex-shrink-0" />
      {!folder ? (
        <span>No claim folder · <button type="button" className={link} onClick={() => setOpen(true)}>Connect</button></span>
      ) : folder.permission !== 'granted' ? (
        <button type="button" className={link} onClick={onReconnect}>Allow access</button>
      ) : (
        <span>
          Files kept in: <span className="font-mono">{folder.rootName}</span> on {folder.device} ·{' '}
          <button type="button" className={link} onClick={() => setOpen(true)}>Change</button>
        </span>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Claim folder</DialogTitle>
          </DialogHeader>
          <ClaimFolderCard
            supported={supported}
            folder={folder}
            onConnect={async (label) => { await onConnect(label); setOpen(false); }}
            onReconnect={onReconnect}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
