/**
 * Per-provider image limits.
 *
 * NVIDIA NIM rejects any request carrying more than one image:
 *   400 {"message":"At most 1 image(s) may be provided in one request."}
 * Groq accepts 5. Gemini is effectively uncapped.
 *
 * The cap must shrink the CHUNK the processor builds, not truncate the images
 * inside a chunk — truncation silently drops pages from an estimate, which is
 * a liability document.
 */

/** Largest chunk that fits under `imageCap`. Always at least 1. */
export function resolveVisionChunkSize(preferred: number, imageCap: number | null): number {
  if (imageCap === null) return Math.max(1, preferred);
  return Math.max(1, Math.min(preferred, imageCap));
}

/**
 * Guards the request builder. Reaching here over the cap means the caller
 * chunked wrongly — fail loudly rather than quietly sending fewer pages than
 * the surveyor's document contains.
 */
export function assertWithinImageCap(count: number, imageCap: number | null, providerName: string): void {
  if (imageCap !== null && count > imageCap) {
    throw new Error(
      `${providerName} accepts at most ${imageCap} image per request, got ${count}. ` +
      `This is a chunking bug — pages would otherwise be dropped silently.`
    );
  }
}
