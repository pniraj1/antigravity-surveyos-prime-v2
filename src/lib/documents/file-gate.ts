export interface FileGate {
  /** Resolves once, the first time `open` is called. */
  whenOpen: Promise<void>;
  open: () => void;
}

/** A one-shot gate: filing waits on `whenOpen`; toast close and Undo both call `open`, only the first counts. */
export function createFileGate(startOpen = false): FileGate {
  let open!: () => void;
  const whenOpen = new Promise<void>((r) => { open = r; });
  if (startOpen) open();
  return { whenOpen, open };
}
