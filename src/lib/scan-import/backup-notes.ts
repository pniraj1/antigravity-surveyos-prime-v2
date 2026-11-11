import { normalizeScanNotes, type NormalizedNotesPayload } from './normalizer';

/** Notes from a zip that holds only Scan's "Text only" backup (no manifest, so no claim files). Otherwise null. */
export async function backupOnlyNotes(zipFiles: Map<string, Blob>): Promise<NormalizedNotesPayload | null> {
  const names = [...zipFiles.keys()];
  if (names.some((n) => n.endsWith('_surveyos-scan.json'))) return null;
  const name = names.find((n) => n.endsWith('_surveyos-backup.json'));
  return name ? normalizeScanNotes(await zipFiles.get(name)!.text()) : null;
}
