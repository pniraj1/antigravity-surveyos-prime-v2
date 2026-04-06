// ═══════════════════════════════════════════════════════════
// DOCUMENT PROCESSING
// Handles PDF-to-Image conversion and throttled execution
// ═══════════════════════════════════════════════════════════

import * as pdfjsLib from 'pdfjs-dist';
import { callAIGateway } from './service';
import { DOC_PROMPTS } from './prompts';

// Setup PDF.js worker — using unpkg for better reliability with version 5.6.205
if (typeof window !== 'undefined') {
  // We use unpkg as it provides a direct mapping for the mjs worker version.
  const version = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
}

/**
 * Converts a file (Image or PDF) to a list of base64 strings.
 */
export async function fileToImages(
  file: File, 
  onProgress?: (page: number, total: number) => void
): Promise<string[]> {
  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const images: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      if (onProgress) onProgress(i, pdf.numPages);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas context failed');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        canvas: canvas,
        viewport: viewport
      }).promise;

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      images.push(dataUrl.split(',')[1]);
    }
    return images;
  }

  // Handle standard images
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const b64 = e.target?.result?.toString().split(',')[1];
      if (b64) resolve([b64]);
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
export async function extractDocument(
  key: string, 
  file: File,
  onProgress?: (msg: string) => void
): Promise<any> {
  const prompt = DOC_PROMPTS[key] || "Extract all visible details from this document as JSON.";
  
  return aiQueue.add(async () => {
    if (onProgress) onProgress('Scanning document...');
    const images = await fileToImages(file, (p, t) => {
      if (onProgress) onProgress(`Processing page ${p} of ${t}...`);
    });

    const totalPages = images.length;
    // Set chunk size to 1 to guarantee 100% compatibility with Groq Vision.
    // While slower for massive PDFs, it prevents all "Too many images" errors.
    const CHUNK_SIZE = 1; 
    let finalResult: any = null;

    for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
      const chunk = images.slice(i, i + CHUNK_SIZE);
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

      const rawResponse = await callAIGateway(prompt, chunk);
      
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

    return finalResult;
  });
}
