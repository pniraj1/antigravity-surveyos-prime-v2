/** True when the browser can hand a PDF to the OS share sheet (Android Chrome, iOS Safari, …). */
export function canSharePdf(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([], 'check.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}

/** Opens the share sheet. Cancelling is not an error. Nothing is sent by the app itself. */
export async function sharePdf(blob: Blob, fileName: string): Promise<void> {
  const file = new File([blob], fileName, { type: 'application/pdf' });
  try {
    await navigator.share({ files: [file], title: fileName });
  } catch {
    // user cancelled or share target failed — nothing to do
  }
}
