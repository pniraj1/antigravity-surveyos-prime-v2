/** Fired whenever the persistent Drive upload queue may have changed size. */
export const DRIVE_QUEUE_EVENT = 'surveyos:drive-queue';

export function notifyDriveQueueChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DRIVE_QUEUE_EVENT));
}
