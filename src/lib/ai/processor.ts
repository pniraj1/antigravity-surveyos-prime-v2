// ═══════════════════════════════════════════════════════════
// DOCUMENT PROCESSING
// Handles PDF-to-Image conversion and throttled execution
// ═══════════════════════════════════════════════════════════

// import * as pdfjsLib from 'pdfjs-dist'; // DO NOT STACTIC IMPORT THIS
import { callAIGateway } from './service';
import { getDocPrompt } from './prompts';
import { toast } from 'sonner';
import { logger } from '@/lib/utils/logger';
import { hashFile, buildProfile } from './document-profiler';
import {
  getCachedExtraction,
  saveCachedExtraction,
  getExtractionProgress,
  saveExtractionProgress,
  clearExtractionProgress,
} from './extraction-cache';
import { runParser, parserMeetsThreshold, needsCategorization } from './parsers/index';
import { categorizeItems } from './categorizer';
import { getPageScopeSuffix } from './prompts';

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

// ─── Token Budget ─────────────────────────────────────────────────────────────
// Groq's on-demand (free) tier: 8,000 TPM cap.
// We budget 4,500 tokens for the ENTIRE prompt (instructions + page text).
// This leaves ~3,500 tokens headroom for the JSON output (needed for large estimates).
// Conservative estimate: estimate prompt ≈ 900 tokens, page budget ≈ 3,600 tokens.
// 1 token ≈ 4 chars is the standard rough estimate.
const MAX_PROMPT_TOKENS = 4_500;
const CHARS_PER_TOKEN   = 4;

// Maximum characters of page text we'll send per chunk in text-mode.
// 3,600 tokens × 4 chars = 14,400 chars — but be conservative with 12,000 chars
// to account for prompt overhead and Groq's approximate tokenization.
const MAX_PAGE_TEXT_CHARS = 12_000;

/** Rough token estimate for a text string (4 chars per token). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

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
          resolve(res as T);
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
    if (task) await task().catch(() => { /* individual task already rejects its own promise */ });
    this.isProcessing = false;
    this.process();
  }
}

const aiQueue = new AITaskQueue();

/**
 * Helper to deep merge AI JSON fragments from multi-page extractions.
 * Concatenates arrays and fills in empty/new fields.
 */
// Fields that represent document-level financial totals.
// For these we keep the LARGEST non-zero value seen across all page chunks
// (a page that has no summary row returns 0, which should never overwrite
// a real total found on a later page).
const TOTAL_FIELDS = new Set([
  'total_amount', 'gross_amount', 'net_amount', 'payable_amount',
  'subtotal_parts_taxable', 'subtotal_labour_taxable', 'subtotal_painting_taxable',
  'gst_amount', 'discount_amount', 'tds_amount',
]);

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
    } else if (TOTAL_FIELDS.has(key)) {
      // Financial totals: keep the largest non-zero value across all pages.
      // This prevents a page-1 zero from permanently hiding the real total
      // found on a later summary page.
      const oldNum = Number(oldVal) || 0;
      const newNum = Number(newVal) || 0;
      result[key] = Math.max(oldNum, newNum) || oldVal;
    } else {
      // Simple values: prefer existing if already set, otherwise take new
      if (oldVal === undefined || oldVal === null || oldVal === '') {
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
 * Merge strategy for targeted rescan results.
 * Unlike mergeAIResults (which appends arrays), this REPLACES non-empty arrays
 * and always updates scalar fields — so corrected totals overwrite stale ones.
 */
function applyTargetedUpdate(existing: any, partial: any): any {
  if (!partial) return existing;
  const result = { ...existing };
  for (const k in partial) {
    const v = partial[k];
    if (Array.isArray(v) && v.length > 0) {
      result[k] = v; // replace, not append
    } else if (!Array.isArray(v) && v !== null && v !== undefined && v !== '') {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Rescans only specific pages of a document — used when math discrepancies
 * are detected after initial extraction. Typically targets the last 1-2 pages
 * where the summary / totals section lives.
 *
 * Much cheaper than a full rescan: only the specified pages are sent to the AI.
 */
export async function rescanTargetPages(
  key: string,
  file: File,
  pageIndices: number[],
  focusHint: string,
  onProgress?: (msg: string) => void,
): Promise<{ partialData: any; discrepancies: string[] }> {
  const basePrompt = getDocPrompt(key) ?? 'Extract all visible details from this document as JSON.';
  const targetedPrompt =
    `${basePrompt}\n\n` +
    `TARGETED RESCAN — fix specific fields only.\n` +
    `Pay special attention to: ${focusHint}\n` +
    `Return the COMPLETE corrected JSON for the affected section(s), including ALL line items.`;

  return aiQueue.add(async () => {
    if (onProgress) onProgress('Smart Fix: loading document...');
    const { apiImages } = await fileToImages(file);

    const total = apiImages.length;
    const valid = pageIndices.filter(i => i >= 0 && i < total);
    if (valid.length === 0) throw new Error('No valid pages for targeted rescan.');

    const label = valid.map(i => i + 1).join(', ');
    if (onProgress) onProgress(`Smart Fix: rescanning page${valid.length > 1 ? 's' : ''} ${label} of ${total}...`);

    let partialData: any = null;
    for (const idx of valid) {
      try {
        const raw = await callAIGateway(targetedPrompt, [apiImages[idx]]);
        const fragment = JSON.parse(raw);
        partialData = mergeAIResults(partialData, fragment);
      } catch {
        logger.warn(`[Smart Fix] Page ${idx + 1} returned unparseable response — skipping.`);
      }
    }

    const mathCheck = validateMath(partialData, key);
    return { partialData, discrepancies: mathCheck.discrepancies };
  });
}

export { applyTargetedUpdate };

/**
 * Validates math logic for estimates and bills.
 * Checks if sum of individual items roughly matches the extracted subtotals/totals.
 */
/**
 * Returns a tolerance amount that scales with the expected value.
 * Small amounts use a flat ₹5 floor; large amounts use 0.1% of the expected
 * value so a ₹500,000 estimate doesn't falsely flag on normal rounding.
 */
function tolerance(expected: number): number {
  return Math.max(5, expected * 0.001);
}

function validateMath(data: any, docType: string): { isValid: boolean; discrepancies: string[] } {
  const discrepancies: string[] = [];
  if (docType !== 'estimate' && docType !== 'final-bill') return { isValid: true, discrepancies };

  const parts = Array.isArray(data.spare_parts) ? data.spare_parts : [];
  const labour = Array.isArray(data.labour_items) ? data.labour_items : [];
  const paint = Array.isArray(data.painting_items) ? data.painting_items : [];

  const expectedPartsTotal = Number(data.subtotal_parts_taxable) || 0;
  const actualPartsTotal = parts.reduce((sum: number, item: any) => sum + (Number(item.taxable_amount) || 0), 0);

  const expectedLabourTotal = Number(data.subtotal_labour_taxable) || 0;
  const actualLabourTotal = labour.reduce((sum: number, item: any) => sum + (Number(item.taxable_amount) || 0), 0);

  const expectedPaintTotal = Number(data.subtotal_painting_taxable) || 0;
  const actualPaintTotal = paint.reduce((sum: number, item: any) => sum + (Number(item.taxable_amount) || 0), 0);

  if (expectedPartsTotal > 0 && Math.abs(actualPartsTotal - expectedPartsTotal) > tolerance(expectedPartsTotal)) {
    discrepancies.push(`Parts sum (₹${actualPartsTotal.toFixed(2)}) doesn't match document parts total (₹${expectedPartsTotal.toFixed(2)})`);
  }
  
  if (expectedLabourTotal > 0 && Math.abs(actualLabourTotal - expectedLabourTotal) > tolerance(expectedLabourTotal)) {
    discrepancies.push(`Labour sum (₹${actualLabourTotal.toFixed(2)}) doesn't match document labour total (₹${expectedLabourTotal.toFixed(2)})`);
  }
  
  if (expectedPaintTotal > 0 && Math.abs(actualPaintTotal - expectedPaintTotal) > tolerance(expectedPaintTotal)) {
    discrepancies.push(`Painting sum (₹${actualPaintTotal.toFixed(2)}) doesn't match document painting total (₹${expectedPaintTotal.toFixed(2)})`);
  }

  // Overall gross total check
  const expectedGross = Number(data.gross_amount) || Number(data.total_amount) || 0;
  if (expectedGross > 0) {
    const totalPartsGross = parts.reduce((sum: number, item: any) => sum + (Number(item.total_amount) || 0), 0);
    const totalLabourGross = labour.reduce((sum: number, item: any) => sum + (Number(item.total_amount) || 0), 0);
    const totalPaintGross = paint.reduce((sum: number, item: any) => sum + (Number(item.total_amount) || 0), 0);
    const sumGross = totalPartsGross + totalLabourGross + totalPaintGross;
    
    if (sumGross > 0 && Math.abs(sumGross - expectedGross) > tolerance(expectedGross)) {
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
  previousData?: any,
  forceDocMode?: 'text' | 'vision'
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

    // ── Layer 1: File hash + cache lookup ──────────────────────────────────────
    const fileHash = await hashFile(file);
    const cached = await getCachedExtraction(fileHash, key);
    if (cached) {
      if (onProgress) onProgress('Loaded from cache (instant).');
      return { data: cached.data, images: [], discrepancies: [] };
    }

    const { viewImages, apiImages, textLayers } = await fileToImages(file, (p, t) => {
      if (onProgress) onProgress(`Processing page ${p} of ${t}...`);
    });

    const totalPages = apiImages.length;

    // ── Smart PDF Mode Detection ─────────────────────────────────────────────
    // Classify each page as text-native or vision-only.
    // If ≥85% of pages have a rich text layer (and not garbled), send text to
    // the AI directly — no images, no encoding overhead, Groq-compatible.
    // Otherwise fall through to the existing image/vision path.
    const { pages: pageProfiles, docMode: detectedMode } = textLayers
      ? profilePages(textLayers)
      : { pages: [], docMode: 'vision' as DocMode };

    const docMode = forceDocMode ?? detectedMode;

    const useTextMode = docMode === 'text';
    if (useTextMode) {
      logger.log(`[AI Extraction] ${key}: text-mode detected (${totalPages} pages, text-native PDF)`);
    } else {
      logger.log(`[AI Extraction] ${key}: vision-mode (${docMode})`);
    }

    // ── Layer 2: Deterministic parser fast-path (estimate/final-bill only) ─────
    // For digitally-born PDFs with a recognised format, run a zero-API-call
    // TypeScript parser. If it meets the confidence threshold (0.85 items + totals),
    // skip AI entirely and go straight to categorisation.
    if (
      (key === 'estimate' || key === 'final-bill') &&
      textLayers &&
      useTextMode
    ) {
      const profile = buildProfile(fileHash, totalPages, textLayers);
      const parserResult = runParser(profile);

      if (parserMeetsThreshold(parserResult)) {
        if (onProgress) onProgress('Parsed digitally — zero AI calls needed.');

        // Run categorisation if spare_parts have empty material categories
        let parsedData = parserResult.data;
        if (needsCategorization(parserResult)) {
          if (onProgress) onProgress('Categorising parts...');
          try {
            const catResult = await categorizeItems(parsedData.spare_parts);
            parsedData = { ...parsedData, spare_parts: catResult.categorized };
          } catch {
            // categorisation is non-blocking — proceed with uncategorised items
          }
        }

        // Cache the parser result and return immediately
        await saveCachedExtraction({
          fileHash,
          docType: key,
          extractedAt: Date.now(),
          data: parsedData,
          source: 'parser',
          parserName: parserResult.parserName,
        });

        const mathCheck = validateMath(parsedData, key);
        return { data: parsedData, images: viewImages, discrepancies: mathCheck.discrepancies };
      }
      // Parser confidence below threshold — fall through to AI extraction
    }

    // Chunk size: always 1 page per call in text-mode (avoids 413 on dense documents).
    // In vision-mode: estimates get 2 pages per call for efficiency; others get 1.
    const VISION_CHUNK_SIZE = (key === 'estimate' || key === 'final-bill') ? 2 : 1;
    const CHUNK_SIZE = useTextMode ? 1 : VISION_CHUNK_SIZE;

    // Build the base prompt — for vision mode on digitally-born docs we still
    // hint the AI with the text layer for accuracy, but send images too.
    let enhancedPrompt = prompt;
    if (docMode !== 'vision' && textLayers && textLayers.some(t => hasFinancialData(t))) {
      const textPreview = textLayers.slice(0, 3).join('\n---PAGE BREAK---\n');
      enhancedPrompt = `${prompt}\n\nNOTE: This appears to be a digitally-created document (not scanned). The extracted text layer is provided below for reference to guide your extraction:\n\n${textPreview}\n\nUse this text as a reference to ensure accuracy, but validate against the visual document.`;
    }

    // Single-pass extraction — no automatic re-scan on math discrepancies.
    // Discrepancies are surfaced to the surveyor via a toast; they evaluate manually.

    // ── Layer 3: Resume — restore partial results from a previous interrupted run ──
    const savedProgress = await getExtractionProgress(fileHash, key);
    let completedPages = new Set<number>(savedProgress?.completedPages ?? []);
    let finalResult: any = savedProgress?.partialData ?? null;
    let discrepancies: string[] = [];

    // Single pass — no retry loop
    {

      for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
        const currentBatchStart = i + 1;
        const currentBatchEnd = Math.min(i + CHUNK_SIZE, totalPages);

        if (onProgress) {
          let msg = totalPages > 1
            ? `Analyzing page ${currentBatchStart}–${currentBatchEnd} of ${totalPages}...`
            : 'Analyzing document...';
          // Single pass — no retry prefix needed
          onProgress(msg);
        }

        // Small throttle delay between chunks to avoid rate limiting
        if (i > 0) await new Promise(r => setTimeout(r, 600));

        // ── Layer 4: Skip pages already completed in a prior run ──────────────────
        if (completedPages.has(i)) {
          logger.log(`[AI Extraction] ${key}: skipping page ${currentBatchStart} (already completed in prior run)`);
          continue;
        }

        // ── Choose text-mode or vision-mode payload ──────────────────────────
        let chunkImages: string[];
        let chunkPrompt: string;

        if (useTextMode) {
          // Text-native PDF: embed the raw text directly in the prompt.
          // No images sent → works with all providers including Groq.
          //
          // ⚠️  TOKEN BUDGET GUARD (Groq 8K TPM limit)
          // Build the chunk text for the current CHUNK_SIZE window, then measure
          // estimated tokens. If the full prompt would exceed MAX_PROMPT_TOKENS,
          // shrink the window page-by-page until it fits.
          // If even a SINGLE page is too large, fall back to vision for that chunk.

          // Since CHUNK_SIZE=1 in text-mode, we always process exactly one page at a time.
          // Build the page text, but truncate it hard if it exceeds MAX_PAGE_TEXT_CHARS.
          // This prevents 413s even on pathologically dense pages (e.g. 200-line estimates).
          let pageText = pageProfiles[i]?.text ?? '';
          if (pageText.length > MAX_PAGE_TEXT_CHARS) {
            logger.warn(
              `[AI Extraction] ${key}: page ${currentBatchStart} text is very large ` +
              `(${pageText.length} chars) — truncating to ${MAX_PAGE_TEXT_CHARS} chars.`
            );
            // Truncate to the last complete line before the limit to avoid mid-row cuts.
            const truncated = pageText.slice(0, MAX_PAGE_TEXT_CHARS);
            const lastNewline = truncated.lastIndexOf('\n');
            pageText = lastNewline > MAX_PAGE_TEXT_CHARS * 0.8
              ? truncated.slice(0, lastNewline)
              : truncated;
          }

          const chunkText = `--- PAGE ${currentBatchStart} ---\n${pageText}`;
          let candidatePrompt = `${enhancedPrompt}\n\n--- DOCUMENT TEXT (page ${currentBatchStart} of ${totalPages}) ---\n${chunkText}`;

          // If even the truncated single-page prompt is still too large, fall back to vision.
          if (estimateTokens(candidatePrompt) > MAX_PROMPT_TOKENS) {
            logger.warn(
              `[AI Extraction] ${key}: page ${currentBatchStart} still too large for text-mode ` +
              `(~${estimateTokens(candidatePrompt)} tokens) — falling back to vision.`
            );
            chunkImages = apiImages.slice(i, i + 1);
            chunkPrompt = enhancedPrompt;
          } else {
            chunkPrompt = candidatePrompt;
            chunkImages = []; // pure text mode — no images
          }
        } else {
          // Vision path: send JPEG images (existing behaviour)
          chunkImages = apiImages.slice(i, i + CHUNK_SIZE);
          chunkPrompt = enhancedPrompt;
        }

        // ── Layer 5: Page-scope suffix (reduces output tokens for long estimates) ──
        if (key === 'estimate' || key === 'final-bill') {
          chunkPrompt = chunkPrompt + getPageScopeSuffix(currentBatchStart, totalPages);
        }

        let rawResponse: string;
        try {
          rawResponse = await callAIGateway(chunkPrompt, chunkImages);
        } catch (firstErr: any) {
          // ── Payload too large → auto-fallback to vision for this chunk ──────
          // The gateway signals PAYLOAD_TOO_LARGE when even the shortest text-mode
          // prompt exceeds the provider's token cap. Retrying with the same prompt
          // won't help, but sending the page as an image almost certainly will.
          const isTooBig =
            firstErr?.status === 413 ||
            (firstErr?.message ?? '').includes('PAYLOAD_TOO_LARGE');

          if (isTooBig && chunkImages.length === 0) {
            // We were in text-mode — retry this chunk in vision-mode
            logger.warn(
              `[AI Extraction] ${key}: PAYLOAD_TOO_LARGE on text chunk ${currentBatchStart} ` +
              `— retrying as vision (image) chunk.`
            );
            const visionImages = apiImages.slice(i, i + 1); // 1 page vision fallback
            try {
              rawResponse = await callAIGateway(enhancedPrompt, visionImages);
            } catch (visionErr: any) {
              // Both text-mode and vision-mode failed (provider token limit too restrictive).
              // This typically means Groq's 8K TPM is too small for this document.
              // Guide the user to add a Gemini key which has 250K TPM.
              const isVisionTooBig =
                (visionErr as any)?.status === 413 ||
                (visionErr?.message ?? '').includes('PAYLOAD_TOO_LARGE');
              if (isVisionTooBig) {
                toast.error(
                  'This document is too large for Groq\'s free tier (8K token limit). ' +
                  'Add a Google Gemini API key in Profile → AI & Documents Intelligence — it supports documents up to 250K tokens.',
                  { duration: 12000 }
                );
              } else {
                const msg = visionErr instanceof Error ? visionErr.message : 'Unknown error';
                toast.error(`AI extraction failed — ${msg}. Please enter fields manually.`);
              }
              throw visionErr;
            }
          } else if (isTooBig) {
            // Vision-mode was already in use, but prompt is still too large.
            toast.error(
              'This document is too large for your current AI provider\'s token limit. ' +
              'Add a Google Gemini API key in Profile → AI & Documents Intelligence — it supports documents up to 250K tokens.',
              { duration: 12000 }
            );
            throw firstErr;
          } else {
            // Generic transient error — retry once after 500ms
            await new Promise(r => setTimeout(r, 500));
            try {
              rawResponse = await callAIGateway(chunkPrompt, chunkImages);
            } catch (err: any) {
              const msg = err instanceof Error ? err.message : 'Unknown error';
              toast.error(`AI extraction failed — ${msg}. Please enter fields manually.`);
              throw err;
            }
          }
        }

        try {
          const fragment = JSON.parse(rawResponse);
          finalResult = mergeAIResults(finalResult, fragment);

          // ── Layer 6: Save streaming progress ──────────────────────────────────────
          completedPages.add(i);
          await saveExtractionProgress({
            fileHash,
            docType: key,
            totalPages,
            completedPages: Array.from(completedPages),
            failedPages: [],
            partialData: finalResult,
            updatedAt: Date.now(),
          });
        } catch (err) {
          // For multi-page docs: one bad page should not abort the whole extraction.
          // Log the failure and continue accumulating results from other pages.
          logger.warn(
            `[AI Extraction] ${key}: page chunk ${currentBatchStart}–${currentBatchEnd} returned unparseable JSON — skipping this chunk.`,
            '\nRaw response (first 500 chars):', rawResponse?.slice(0, 500)
          );
          if (totalPages === 1) {
            // Single-page doc with no fallback — propagate as before
            throw new Error('AI returned an invalid format. Please try again or enter fields manually.');
          }
          // Multi-page: continue with whatever we have accumulated so far
        }
      }

      // Validate math — result surfaced to UI layer, no automatic re-scan.
      const mathCheck = validateMath(finalResult, key);
      discrepancies = mathCheck.discrepancies;

      // ── Layer 7: Cache completed AI result + clear resume progress ─────────────
      if (finalResult) {
        await saveCachedExtraction({
          fileHash,
          docType: key,
          extractedAt: Date.now(),
          data: finalResult,
          source: useTextMode ? 'ai-text' : 'ai-vision',
        });
        await clearExtractionProgress(fileHash, key);
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
      logger.log(`[AI Extraction] ${key}: ${parts} parts, ${labour} labour, ${painting} painting. Total: ${total}`);
    }

    // Return high-res view images to caller so they can be stored in sessionStorage
    return { data: finalResult, images: viewImages, discrepancies };
  });
}
