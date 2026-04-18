// ═══════════════════════════════════════════════════════════
// DOCUMENT PROCESSING
// Handles PDF-to-Image conversion and throttled execution
// ═══════════════════════════════════════════════════════════

// import * as pdfjsLib from 'pdfjs-dist'; // DO NOT STACTIC IMPORT THIS
import { callAIGateway } from './service';
import { getDocPrompt } from './prompts';
import { toast } from 'sonner';

/**
 * Converts a file (Image or PDF) to a list of base64 strings.
 *
 * Returns two arrays:
 *   - viewImages: high-res PNG (scale 3×) for the Evidence Viewer sidebar
 *   - apiImages:  compressed JPEG (scale 1.5×) for AI API calls (stays under 4MB/image)
 */
export async function fileToImages(
  file: File, 
  onProgress?: (page: number, total: number) => void
): Promise<{ viewImages: string[]; apiImages: string[] }> {
  if (file.type === 'application/pdf') {
    const pdfjsLib = await import('pdfjs-dist');
    const version = pdfjsLib.version;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const viewImages: string[] = [];
    const apiImages: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      if (onProgress) onProgress(i, pdf.numPages);
      const page = await pdf.getPage(i);

      // ── High-res view image (PNG, scale 3×) ────────────────────────────
      // Scale 3.0 → ~2550×3300px for a typical A4 — crisp enough for zooming
      const viewViewport = page.getViewport({ scale: 3.0 });
      const viewCanvas = document.createElement('canvas');
      const viewCtx = viewCanvas.getContext('2d');
      if (!viewCtx) throw new Error('Canvas context failed');
      viewCanvas.height = viewViewport.height;
      viewCanvas.width  = viewViewport.width;
      await page.render({ canvasContext: viewCtx, canvas: viewCanvas, viewport: viewViewport }).promise;
      viewImages.push(viewCanvas.toDataURL('image/png'));

      // ── API image (JPEG 80%, scale 1.5×) ───────────────────────────────
      // Gemini has a 4MB inline-data limit per image.
      // 1.5× scale gives ~1275×1650px JPEG ≈ 400-800 KB — well within limits
      // while still containing all text clearly legible for OCR.
      const apiViewport = page.getViewport({ scale: 1.5 });
      const apiCanvas = document.createElement('canvas');
      const apiCtx = apiCanvas.getContext('2d');
      if (!apiCtx) throw new Error('Canvas context failed');
      apiCanvas.height = apiViewport.height;
      apiCanvas.width  = apiViewport.width;
      await page.render({ canvasContext: apiCtx, canvas: apiCanvas, viewport: apiViewport }).promise;
      apiImages.push(apiCanvas.toDataURL('image/jpeg', 0.80));
    }
    return { viewImages, apiImages };
  }

  // Handle standard images — same data URL used for both view and API
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result?.toString();
      if (dataUrl) resolve({ viewImages: [dataUrl], apiImages: [dataUrl] });
      else reject(new Error('Failed to read image'));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Sequential Queue to prevent API rate limiting (Throttling)
 * The user explicitly requested not to process all documents at once.
 */
class AITaskQueue {
  private queue: (() => Promise<any>)[] = [];
  private isProcessing = false;

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const res = await task();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    const task = this.queue.shift();
    if (task) await task();
    this.isProcessing = false;
    this.process();
  }
}

const aiQueue = new AITaskQueue();

/**
 * Helper to deep merge AI JSON fragments from multi-page extractions.
 * Concatenates arrays and fills in empty/new fields.
 */
function mergeAIResults(acc: any, fragment: any): any {
  if (!acc) return fragment;
  const result = { ...acc };

  for (const key in fragment) {
    const newVal = fragment[key];
    const oldVal = result[key];

    if (Array.isArray(newVal)) {
      // Concatenate list items (e.g. spare_parts, labour_items)
      result[key] = [...(Array.isArray(oldVal) ? oldVal : []), ...newVal];
    } else if (typeof newVal === 'object' && newVal !== null) {
      // Recursive merge for sub-objects
      result[key] = mergeAIResults(oldVal || {}, newVal);
    } else {
      // Simple values: prefer existing if already set, otherwise take new
      if (oldVal === undefined || oldVal === null || oldVal === '' || oldVal === 0) {
        result[key] = newVal;
      }
    }
  }
  return result;
}

/**
 * High-level orchestrator for document extraction.
 * Handles multi-page PDFs by chunking (respecting Groq's 5-image limit).
 */
export interface ExtractionResult {
  data: any;
  /** High-res PNG pages for Evidence Viewer display (stored in sessionStorage) */
  images: string[];
}

export async function extractDocument(
  key: string, 
  file: File,
  onProgress?: (msg: string) => void,
  feedback?: string
): Promise<ExtractionResult> {
  const basePrompt = getDocPrompt(key) || "Extract all visible details from this document as JSON.";
  const prompt = feedback 
    ? `${basePrompt}\n\nUSER FEEDBACK ON PREVIOUS EXTRACTION:\n"""\n${feedback}\n"""\nPlease pay STRICT ATTENTION to this feedback. Correct your mappings accordingly (e.g. if the user says column X is net amount and column Y is gross amount, apply that to the JSON output).`
    : basePrompt;
  
  return aiQueue.add(async () => {
    if (onProgress) onProgress('Scanning document...');
    const { viewImages, apiImages } = await fileToImages(file, (p, t) => {
      if (onProgress) onProgress(`Processing page ${p} of ${t}...`);
    });

    const totalPages = apiImages.length;
    // For estimate/final-bill: use larger chunks so all line items are seen together
    // For other docs: keep CHUNK_SIZE=1 for Groq compatibility
    const CHUNK_SIZE = (key === 'estimate' || key === 'final-bill') ? 5 : 1;
    let finalResult: any = null;

    for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
      const chunk = apiImages.slice(i, i + CHUNK_SIZE);  // send small JPEG to API
      const currentBatchStart = i + 1;
      const currentBatchEnd = Math.min(i + CHUNK_SIZE, totalPages);

      if (onProgress) {
        onProgress(
          totalPages > 1 
            ? `Analyzing page ${currentBatchStart} of ${totalPages}...`
            : `Analyzing document...`
        );
      }

      // Small throttle delay between pages to avoid rate limiting
      if (i > 0) await new Promise(r => setTimeout(r, 600));

      let rawResponse: string;
      try {
        rawResponse = await callAIGateway(prompt, chunk);
      } catch (firstErr) {
        // One retry after 500ms before giving up
        await new Promise(r => setTimeout(r, 500));
        try {
          rawResponse = await callAIGateway(prompt, chunk);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          toast.error(`AI extraction failed — ${msg}. Please enter fields manually.`);
          throw err;
        }
      }

      try {
        const fragment = JSON.parse(rawResponse);
        finalResult = mergeAIResults(finalResult, fragment);
      } catch (err) {
        console.error('AI JSON Parse Error in batch:', rawResponse);
        // If it's a multi-batch request and one fails, we might still want the partial results,
        // but for now we'll throw to ensure data integrity.
        throw new Error("AI returned an invalid format for one or more pages.");
      }
    }

    // Log extraction summary for estimate/final-bill documents
    if ((key === 'estimate' || key === 'final-bill') && finalResult) {
      const parts = Array.isArray(finalResult.spare_parts) ? finalResult.spare_parts.length : 0;
      const labour = Array.isArray(finalResult.labour_items) ? finalResult.labour_items.length : 0;
      const painting = Array.isArray(finalResult.painting_items) ? finalResult.painting_items.length : 0;
      const total = finalResult.total_amount ?? 'N/A';
      if (onProgress) {
        onProgress(`Extracted ${parts} parts, ${labour} labour, ${painting} painting items. Total: ₹${total}`);
      }
      console.log(`[AI Extraction] ${key}: ${parts} parts, ${labour} labour, ${painting} painting. Total: ${total}`);
    }

    // Return high-res view images to caller so they can be stored in sessionStorage
    return { data: finalResult, images: viewImages };
  });
}
