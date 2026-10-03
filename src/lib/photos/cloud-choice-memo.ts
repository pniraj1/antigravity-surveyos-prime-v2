// ponytail: in-memory only — one answer per claim per page session. A reload
// asks again, which is the safe direction for a privacy question.
const choices = new Map<string, boolean>();

export function getCloudChoice(claimId: string): boolean | undefined {
  return choices.get(claimId);
}

export function rememberCloudChoice(claimId: string, ok: boolean): void {
  choices.set(claimId, ok);
}

export function clearCloudChoices(): void {
  choices.clear();
}
