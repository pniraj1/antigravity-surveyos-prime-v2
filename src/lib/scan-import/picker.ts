/**
 * Google's own Drive file chooser for a Scan export zip. Uses the existing
 * `drive.file` token: a picked file is granted to this app, so it downloads
 * with `files/{id}?alt=media`. No new scope, no paid service.
 * Needs the Google Picker API enabled in the Cloud project (one-time owner step).
 */
import { getDriveToken, linkGoogleDrive } from '@/lib/drive';

// ponytail: only the Picker members used here.
interface PickerApi {
  DocsView: new (viewId?: string) => { setMimeTypes(m: string): unknown };
  PickerBuilder: new () => PickerBuilder;
  ViewId: { DOCS: string };
  Action: { PICKED: string; CANCEL: string };
}
interface PickerBuilder {
  addView(v: unknown): PickerBuilder;
  setOAuthToken(t: string): PickerBuilder;
  setDeveloperKey(k: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setCallback(cb: (data: { action: string; docs?: { id: string }[] }) => void): PickerBuilder;
  build(): { setVisible(v: boolean): void };
}
type PickerWindow = Window & {
  gapi?: { load(name: string, cfg: { callback: () => void; onerror: () => void }): void };
  google?: { picker?: PickerApi };
};

const API_SRC = 'https://apis.google.com/js/api.js';
let loading: Promise<PickerApi> | null = null;

/** Loads api.js once, then the picker module. A failed load can be retried. */
function loadPicker(): Promise<PickerApi> {
  const w = window as PickerWindow;
  loading ??= new Promise<PickerApi>((resolve, reject) => {
    const fail = () => reject(new Error('Google Picker could not load.'));
    const loadModule = () => w.gapi!.load('picker', {
      callback: () => (w.google?.picker ? resolve(w.google.picker) : fail()),
      onerror: fail,
    });
    if (w.gapi) return loadModule();
    const s = document.createElement('script');
    s.src = API_SRC;
    s.async = true;
    s.onload = loadModule;
    s.onerror = () => { s.remove(); fail(); };
    document.head.appendChild(s);
  }).catch((e) => { loading = null; throw e; });
  return loading;
}

/** Opens the Drive chooser; resolves the picked zip, or null when the surveyor closes it. Throws on load/auth failure. */
export async function pickDriveZip(): Promise<Blob | null> {
  // `||`: a blank line in .env must still fall back to the Firebase key.
  const key = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  if (!key || !appId) throw new Error('Google Drive picker is not configured.');

  // Link first, inside the click, so the Google sign-in popup is not blocked.
  if (!getDriveToken()) await linkGoogleDrive();
  const token = getDriveToken();
  if (!token) throw new Error('Google Drive is not linked.');

  const picker = await loadPicker();
  const id = await new Promise<string | null>((resolve) => {
    new picker.PickerBuilder()
      .addView(new picker.DocsView(picker.ViewId.DOCS).setMimeTypes('application/zip,application/x-zip-compressed'))
      .setOAuthToken(token)
      .setDeveloperKey(key)
      .setAppId(appId)
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) resolve(data.docs?.[0]?.id ?? null);
        else if (data.action === picker.Action.CANCEL) resolve(null);
      })
      .build()
      .setVisible(true);
  });
  if (!id) return null;

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download failed (${res.status}).`);
  return res.blob();
}
