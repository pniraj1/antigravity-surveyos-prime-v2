// Embedding action stub — @google/genai not installed; server actions unsupported in static export.
// Replace with a Cloud Function gateway when ready.

export async function getEmbeddingAction(_text: string): Promise<number[]> {
  throw new Error('Embedding service not available in static-export mode.');
}
