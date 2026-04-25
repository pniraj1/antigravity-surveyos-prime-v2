// ═══════════════════════════════════════════════════════════
// DOCUMENT PROCESSING
// Handles PDF-to-Image conversion and throttled execution
// ═══════════════════════════════════════════════════════════

// import * as pdfjsLib from 'pdfjs-dist'; // DO NOT STACTIC IMPORT THIS
import { callAIGateway } from './service';
import { getDocPrompt } from './prompts';
import { toast } from 'sonner';

/**
 * Extracts text content from a PDF page (if it has a text layer).
 * Returns empty string if page is image-only (scanned).
 */
async function extractPageText(page: any): Promise<string> {
  try {
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    return text.trim();
  } catch {
    return '';
  }
}

/**
 * Parses extracted text to detect financial amounts.
 * Looks for currency symbols and digits: ₹12,456, $1234.56, etc.
 * Returns true if significant numbers found (indicates digitally-born PDF).
 */
function hasFinancialData(text: string): boolean {
  const currencyPattern = /[₹$€£]\s*[\d,]+(?:\.\d{2})?/g;
  const matches = text.match(currencyPattern) || [];
  return matches.length > 3;
}

// ─── Smart PDF Mode Detection ─────────────────────────────────────────────────

const TEXT_RICH_THRESHOLD = 200;  // chars/page → clearly digitally-born
const TEXT_POOR_THRESHOLD = 30;   // chars/page → clearly scanned / image-only

/**
 * Returns true if the text is mostly garbage (corrupted export from legacy ERP).
 * A garbled text layer has high char count but unreadable content — we should
 * fall back to vision processing in that case.
 *
 * Heuristic: if >25% of characters are not printable ASCII, digits, common
 * punctuation, or basic Devanagari/Hindi Unicode range, treat as garbage.
 */
function isGarbageText(text: string): boolean {
  if (text.length < 50) return false;
  const printable = text.match(/[\x20-\x7E\u0900-\u097F\u20B9]/g) ?? [];
  return (printable.length / text.length) < 0.75;
}

type PageMode = 'text' | 'vision';
type DocMode  = 'text' | 'vision' | 'mixed';

interface PageProfile {
  pageIndex: number;
  charCount: number;
  text: string;
  mode: PageMode;
}

/**
 * Classifies each page as text-native or vision-only, then determines the
 * overall document mode:
 *
 *   text   — ≥85% of pages are text-rich → send text to AI, skip images
 *   vision — ≥85% of pages are scanned   → current path (send PNG images)
 *   mixed  — blend of both               → treated as 'vision' (safe fallback)
 *
 * A page is "text-rich" only if:
 *   1. charCount ≥ TEXT_RICH_THRESHOLD, AND
 *   2. The extracted text is NOT garbled (passes isGarbageText check)
 */
function profilePages(textLayers: string[]): {
  pages: PageProfile[];
  docMode: DocMode;
} {
  const pages: PageProfile[] = textLayers.map((text, i) => {
    const isTextRich = text.length >= TEXT_RICH_THRESHOLD && !isGarbageText(text);
    return {
      pageIndex: i,
      charCount: text.length,
      text,
      mode: isTextRich ? 'text' : 'vision',
    };
  });

  const textCount = pages.filter(p => p.mode === 'text').length;
  const ratio = pages.length > 0 ? textCount / pages.length : 0;

  // mixed → treat as vision (simpler, safer, no per-chunk routing complexity)
  const docMode: DocMode = ratio >= 0.85 ? 'text' : 'vision';

  return { pages, docMode };
}

/**
 * Converts a file (Image or PDF) to a list of base64 strings.
 *
 * Returns two arrays:
 *   - viewImages: high-res PNG (scale 3×) for the Evidence Viewer sidebar
 *   - apiImages:  compressed JPEG (scale 1.5×) for AI API calls (stays under 4MB/image)
 *   - textLayers: extracted text from PDF (if available), for digitally-born PDFs
 */
export async function fileToImages(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<{ viewImages: string[]; apiImages: string[]; textLayers?: string[] }> {
  if (file.type === 'application/pdf') {
    const pdfjsLib = await import('pdfjs-dist');
    const version = pdfjsLib.version;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const viewImages: string[] = [];
    const apiImages: string[] = [];
    const textLayers: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      if (onProgress) onProgress(i, pdf.numPages);
      const page = await pdf.getPage(i);

      // Try to extract text (for digitally-born PDFs)
      const pageText = await extractPageText(page);
      textLayers.push(pageText);

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

      // ── API image (JPEG 90%, scale 1.5×) ───────────────────────────────
      // Increased quality from 80% to 90% to improve digit OCR accuracy for scanned PDFs.
      // 1.5× scale gives ~1275×1650px JPEG ≈ 500-900 KB — still within Gemini 4MB limit.
      const apiViewport = page.getViewport({ scale: 1.5 });
      const apiCanvas = document.createElement('canvas');
      const apiCtx = apiCanvas.getContext('2d');
      if (!apiCtx) throw new Error('Canvas context failed');
      apiCanvas.height = apiViewport.height;
      apiCanvas.width  = apiViewport.width;
      await page.render({ canvasContext: apiCtx, canvas: apiCanvas, viewport: apiViewport }).promise;
      apiImages.push(apiCanvas.toDataURL('image/jpeg', 0.90));
    }
    return { viewImages, apiImages, textLayers };
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
  /** Math validation issues */
  discrepancies?: string[];
}

/**
 * Validates math logic for estimates and bills.
 * Checks if sum of individual items roughly matches the extracted subtotals/totals.
 */
function validateMath(data: any, docType: string): { isValid: boolean; discrepancies: string[] } {
  const discrepancies: string[] = [];
  if (docType !== 'estimate' && docType !== 'final-bill') return { isValid: true, discrepancies };

  const TOLERANCE = 5; // Allow small rounding differences

  const parts = Array.isArray(data.spare_parts) ? data.spare_parts : [];
  const labour = Array.isArray(data.labour_items) ? data.labour_items : [];
  const paint = Array.isArray(data.painting_items) ? data.painting_items : [];

  const expectedPartsTotal = Number(data.subtotal_parts_taxable) || 0;
  const actualPartsTotal = parts.reduce((sum: number, item: any) => sum + (Number(item.taxable_amount) || 0), 0);

  const expectedLabourTotal = Number(data.subtotal_labour_taxable) || 0;
  const actualLabourTotal = labour.reduce((sum: number, item: any) => sum + (Number(item.taxable_amount) || 0), 0);

  const expectedPaintTotal = Number(data.subtotal_painting_taxable) || 0;
  const actualPaintTotal = paint.reduce((sum: number, item: any) => sum + (Number(item.taxable_amount) || 0), 0);

  if (expectedPartsTotal > 0 && Math.abs(actualPartsTotal - expectedPartsTotal) > TOLERANCE) {
    discrepancies.push(`Parts sum (₹${actualPartsTotal.toFixed(2)}) doesn't match document parts total (₹${expectedPartsTotal.toFixed(2)})`);
  }
  
  if (expectedLabourTotal > 0 && Math.abs(actualLabourTotal - expectedLabourTotal) > TOLERANCE) {
    discrepancies.push(`Labour sum (₹${actualLabourTotal.toFixed(2)}) doesn't match document labour total (₹${expectedLabourTotal.toFixed(2)})`);
  }
  
  if (expectedPaintTotal > 0 && Math.abs(actualPaintTotal - expectedPaintTotal) > TOLERANCE) {
    discrepancies.push(`Painting sum (₹${actualPaintTotal.toFixed(2)}) doesn't match document painting total (₹${expectedPaintTotal.toFixed(2)})`);
  }

  // overall total
  const expectedGross = Number(data.gross_amount) || Number(data.total_amount) || 0;
  if (expectedGross > 0) {
    const totalPartsGross = parts.reduce((sum: number, item: any) => sum + (Number(item.total_amount) || 0), 0);
    const totalLabourGross = labour.reduce((sum: number, item: any) => sum + (Number(item.total_amount) || 0), 0);
    const totalPaintGross = paint.reduce((sum: number, item: any) => sum + (Number(item.total_amount) || 0), 0);
    const sumGross = totalPartsGross + totalLabourGross + totalPaintGross;
    
    // Allow a bit more tolerance for gross total
    if (sumGross > 0 && Math.abs(sumGross - expectedGross) > 10) {
      discrepancies.push(`Sum of all items (₹${sumGross.toFixed(2)}) doesn't match document gross total (₹${expectedGross.toFixed(2)})`);
    }
  }

  return {
    isValid: discrepancies.length === 0,
    discrepancies
  };
}

export async function extractDocument(
  key: string,
  file: File,
  onProgress?: (msg: string) => void,
  feedback?: string,
  previousData?: any
): Promise<ExtractionResult> {
  const basePrompt = getDocPrompt(key) || "Extract all visible details from this document as JSON.";
  
  let prompt = basePrompt;
  if (feedback) {
    let previousDataStr = "";
    if (previousData) {
      previousDataStr = `\n\nPREVIOUS EXTRACTION DATA:\n"""\n${JSON.stringify(previousData, null, 2)}\n"""\n`;
    }
    prompt = `${basePrompt}${previousDataStr}\n\nUSER FEEDBACK ON PREVIOUS EXTRACTION:\n"""\n${feedback}\n"""\n\nCRITICAL INSTRUCTION:\nPlease pay STRICT ATTENTION to the user's feedback above. \n- If the user mentions missing items or skipped lines, make absolutely sure to find and extract them.\n- You MUST return the FULL document extraction again (including items you previously extracted correctly, plus the newly corrected/found items), so the final JSON is complete. Arrange them as originally they were supposed to be with the serial numbers.`;
  }

  return aiQueue.add(async () => {
    if (onProgress) onProgress('Scanning document...');
    const { viewImages, apiImages, textLayers } = await fileToImages(file, (p, t) => {
      if (onProgress) onProgress(`Processing page ${p} of ${t}...`);
    });

    const totalPages = apiImages.length;

    // ── Smart PDF Mode Detection ─────────────────────────────────────────────
    // Classify each page as text-native or vision-only.
    // If ≥85% of pages have a rich text layer (and not garbled), send text to
    // the AI directly — no images, no encoding overhead, Groq-compatible.
    // Otherwise fall through to the existing image/vision path.
    const { pages: pageProfiles, docMode } = textLayers
      ? profilePages(textLayers)
      : { pages: [], docMode: 'vision' as DocMode };

    const useTextMode = docMode === 'text';
    if (useTextMode) {
      console.log(`[AI Extraction] ${key}: text-mode detected (${totalPages} pages, text-native PDF)`);
    } else {
      console.log(`[AI Extraction] ${key}: vision-mode (${docMode})`);
    }

    // Chunk size: estimates need 2 pages per call; everything else 1
    let CHUNK_SIZE = 1;
    if (key === 'estimate' || key === 'final-bill') {
      CHUNK_SIZE = 2;
    }

    // Build the base prompt — for vision mode on digitally-born docs we still
    // hint the AI with the text layer for accuracy, but send images too.
    let enhancedPrompt = prompt;
    if (!useTextMode && textLayers && textLayers.some(t => hasFinancialData(t))) {
      const textPreview = textLayers.slice(0, 3).join('\n---PAGE BREAK---\n');
      enhancedPrompt = `${prompt}\n\nNOTE: This appears to be a digitally-created document (not scanned). The extracted text layer is provided below for reference to guide your extraction:\n\n${textPreview}\n\nUse this text as a reference to ensure accuracy, but validate against the visual document.`;
    }

    const MAX_RETRIES = 1;
    let autoRetryCount = 0;
    let finalResult: any = null;
    let discrepancies: string[] = [];

    while (autoRetryCount <= MAX_RETRIES) {
      finalResult = null;

      for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
        const currentBatchStart = i + 1;
        const currentBatchEnd = Math.min(i + CHUNK_SIZE, totalPages);

        if (onProgress) {
          let msg = totalPages > 1
            ? `Analyzing page ${currentBatchStart}–${currentBatchEnd} of ${totalPages}...`
            : 'Analyzing document...';
          if (autoRetryCount > 0) msg = `Auto-retry: ${msg}`;
          onProgress(msg);
        }

        // Small throttle delay between chunks to avoid rate limiting
        if (i > 0) await new Promise(r => setTimeout(r, 600));

        // ── Choose text-mode or vision-mode payload ──────────────────────────
        let chunkImages: string[];
        let chunkPrompt: string;

        if (useTextMode) {
          // Text-native PDF: embed the raw text directly in the prompt.
          // No images sent → works with all providers including Groq.
          const chunkText = pageProfiles
            .slice(i, i + CHUNK_SIZE)
            .map((p, idx) => `--- PAGE ${i + idx + 1} ---\n${p.text}`)
            .join('\n\n');
          chunkPrompt = `${enhancedPrompt}\n\n--- DOCUMENT TEXT (pages ${currentBatchStart}–${currentBatchEnd}) ---\n${chunkText}`;
          chunkImages = []; // no images
        } else {
          // Vision path: send JPEG images (existing behaviour)
          chunkImages = apiImages.slice(i, i + CHUNK_SIZE);
          chunkPrompt = enhancedPrompt;
        }

        let rawResponse: string;
        try {
          rawResponse = await callAIGateway(chunkPrompt, chunkImages);
        } catch (firstErr) {
          // One retry after 500ms before giving up
          await new Promise(r => setTimeout(r, 500));
          try {
            rawResponse = await callAIGateway(chunkPrompt, chunkImages);
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

      // Check math if estimate or final-bill
      const mathCheck = validateMath(finalResult, key);
      discrepancies = mathCheck.discrepancies;
      
      if (mathCheck.isValid || autoRetryCount >= MAX_RETRIES) {
        break; // Stop retrying if valid or reached max retries
      } else {
        // Prepare for retry
        enhancedPrompt += `\n\nCRITICAL FEEDBACK ON PREVIOUS ATTEMPT:\nYour previous extraction had the following math discrepancies:\n- ${discrepancies.join('\n- ')}\n\nPlease ensure you extract EVERY line item carefully and check your totals. Do NOT skip any items from any page.`;
        if (onProgress) onProgress(`Math discrepancies found. Auto-retrying extraction...`);
        autoRetryCount++;
        // short delay before retry
        await new Promise(r => setTimeout(r, 1000));
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
    return { data: finalResult, images: viewImages, discrepancies };
  });
}
