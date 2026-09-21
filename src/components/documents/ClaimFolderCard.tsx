'use client';
import React, { useState } from 'react';
import { FolderOpen, Laptop, AlertTriangle } from 'lucide-react';

interface Props {
  supported: boolean;
  folder: { rootName: string; device: string; claimPath: string | null; permission: PermissionState } | null;
  onConnect: (deviceLabel: string) => void;
  onReconnect: () => void;
}

export function ClaimFolderCard({ supported, folder, onConnect, onReconnect }: Props) {
  const [label, setLabel] = useState('');
  if (!supported) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        Use desktop Chrome or Edge to keep claim files in a folder on this PC.
      </div>
    );
  }
  if (!folder) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-3">
        <FolderOpen size={16} className="text-primary" />
        <div className="text-sm flex-1 min-w-[200px]">
          <div className="font-medium">Claim folder</div>
          <div className="text-xs text-muted-foreground">Pick a folder once; every claim gets its own subfolder with typed files.</div>
        </div>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name this PC (e.g. Office PC)"
          aria-label="Name for this PC"
          className="text-xs rounded border border-border bg-background px-2 py-1 w-44"
          maxLength={40}
        />
        <button
          onClick={() => onConnect(label.trim() || 'This PC')}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground"
        >
          Connect folder
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
      <FolderOpen size={16} className="text-primary" />
      <span className="font-mono text-xs">{folder.claimPath ?? folder.rootName}</span>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Laptop size={12} /> {folder.device}</span>
      {folder.permission === 'granted' ? (
        <button onClick={() => onConnect(folder.device)} className="ml-auto text-xs text-muted-foreground underline">Change</button>
      ) : (
        <span className="ml-auto inline-flex items-center gap-2 text-xs text-amber-600">
          <AlertTriangle size={12} /> Folder access needed for this session
          <button onClick={onReconnect} className="font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground">
            Allow access
          </button>
        </span>
      )}
    </div>
  );
}
