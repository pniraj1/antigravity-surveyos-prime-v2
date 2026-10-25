'use client';
import React, { useState, useSyncExternalStore } from 'react';
import { FolderOpen, Laptop, AlertTriangle } from 'lucide-react';
import { useReading } from '@/lib/documents/kit/reading';

interface Props {
  supported: boolean;
  folder: { rootName: string; device: string; claimPath: string | null; permission: PermissionState } | null;
  onConnect: (deviceLabel: string) => void | Promise<void>;
  onReconnect: () => void;
}

type Location = 'local' | 'driveDesktop';
const LOCATION_KEY = 'surveyos_claim_folders_location';

const LOCATIONS: Array<[Location, string]> = [
  ['local', 'A folder on this computer'],
  ['driveDesktop', 'Google Drive (using Google Drive for desktop)'],
];

function readLocation(): Location {
  try { return localStorage.getItem(LOCATION_KEY) === 'driveDesktop' ? 'driveDesktop' : 'local'; } catch { return 'local'; }
}

let chosen: Location | null = null; // this visit's choice, for when localStorage is unavailable
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const snapshot = (): Location => chosen ?? readLocation();
function chooseLocation(next: Location) {
  chosen = next;
  try { localStorage.setItem(LOCATION_KEY, next); } catch { /* private mode: the choice lasts for this visit only */ }
  listeners.forEach((cb) => cb());
}

/** Where the claim folders live. Drive for desktop is just a folder on this PC, so the pick-folder flow is the same. */
function LocationChoice({ location, onChange }: { location: Location; onChange: (l: Location) => void }) {
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Where claim folders live" className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {LOCATIONS.map(([value, text]) => (
          <label key={value} className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="claim-folders-location" checked={location === value} onChange={() => onChange(value)} />
            {text}
          </label>
        ))}
      </div>
      {location === 'driveDesktop' && (
        <ol className="list-decimal pl-5 space-y-0.5 text-xs text-muted-foreground">
          <li>Install Google Drive for desktop from google.com/drive/download and sign in.</li>
          <li>In its settings choose <strong>Mirror files</strong> (works offline), or <strong>Stream files</strong>.</li>
          <li>Click <strong>Choose folder</strong> below and pick your claims folder inside the Google Drive drive (usually <code>G:\My Drive\…</code>).</li>
        </ol>
      )}
    </div>
  );
}

export function ClaimFolderCard({ supported, folder, onConnect, onReconnect }: Props) {
  const [label, setLabel] = useState('');
  const location = useSyncExternalStore(subscribe, snapshot, () => 'local' as Location); // localStorage does not exist on the server
  const reading = useReading((s) => s.active > 0);
  const fetching = location === 'driveDesktop' && reading && (
    <div role="status" className="text-xs text-muted-foreground">Fetching from Google Drive…</div>
  );

  if (!supported) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        Use desktop Chrome or Edge to keep claim files in a folder on this PC.
      </div>
    );
  }
  if (!folder) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-3">
        <LocationChoice location={location} onChange={chooseLocation} />
        <div className="flex flex-wrap items-center gap-3">
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
            Choose folder
          </button>
        </div>
        {fetching}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
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
      {fetching}
    </div>
  );
}
