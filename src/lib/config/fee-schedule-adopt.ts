import type { FeeSchedule } from './fee-schedule';

/**
 * True when the surveyor has a personal rate card whose acknowledged admin
 * version is behind the current global version — i.e. show the adopt/keep prompt.
 * Surveyors without a personal card follow the global automatically (no prompt).
 */
export function schedulePromptNeeded(
  personal: FeeSchedule | undefined,
  ackVersion: string | undefined,
  globalVersion: string | null,
): boolean {
  if (!personal) return false;
  if (!globalVersion) return false;
  return (ackVersion ?? personal.version) !== globalVersion;
}
