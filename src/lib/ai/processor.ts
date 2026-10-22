// ═══════════════════════════════════════════════════════════
// DOCUMENT PROCESSING
// Handles PDF-to-Image conversion and throttled execution
// ═══════════════════════════════════════════════════════════

// import * as pdfjsLib from 'pdfjs-dist'; // DO NOT STACTIC IMPORT THIS
import { callAIGateway, getActiveImageCap, newSession, AllProvidersBusyError, OfflineError } from './service';
import { resolveVisionChunkSize } from './image-cap';
import { getDocPrompt } from './prompts';
import { jobForDocType } from './jobs';
import { toast } from 'sonner';
import { rowCheck, tagRows, dropDuplicates, toFindings, type Finding } from './row-check';
import { fillGaps } from './gap-fill';
import { takeDrop } from './fault';
import { getAIPages, resolveAIPages } from './ai-pages';

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
): Promise<{ viewImages: string[]; apiImages: string[]; textLayers?: string[]; pageNumbers?: number[] }> {
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

    // Only the pages the surveyor ticked in the review sheet are rendered —
    // unticked pages never become images and never reach the provider.
    const pageNumbers = resolveAIPages(pdf.numPages, getAIPages(file));
    for (let idx = 0; idx < pageNumbers.length; idx++) {
      if (onProgress) onProgress(idx + 1, pageNumbers.length);
      const page = await pdf.getPage(pageNumbers[idx]);

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
    return { viewImages, apiImages, textLayers, pageNumbers };
  }

  // Handle standard images — full-res original for viewing, downscaled JPEG for the API.
  // Phone camera photos (12MP+, 4000×3000) sent raw add noise and hurt OCR accuracy;
  // ~1600px on the long edge is plenty for document text and stays well under provider limits.
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result?.toString();
      if (url) resolve(url);
      else reject(new Error('Failed to read image'));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { viewImages: [dataUrl], apiImages: [await downscaleForApi(dataUrl)] };
}

/**
 * Multi-file version of {@link fileToImages}: converts every file in a slot
 * (e.g. RC front + back) and concatenates their pages into one set of images.
 * Text layers are only kept when *every* file is a digitally-born PDF whose
 * text spans all pages — a mixed set (photos, or PDF+photo) falls back to
 * vision, which is the safe default for scanned/photographed documents.
 */
export async function filesToImages(
  files: File[],
  onProgress?: (page: number, total: number) => void,
): Promise<{ viewImages: string[]; apiImages: string[]; textLayers?: string[]; pageRefs: PageRef[] }> {
  const viewImages: string[] = [];
  const apiImages: string[] = [];
  const textLayers: string[] = [];
  const pageRefs: PageRef[] = [];
  let allHaveText = files.length > 0;

  for (const [fileIndex, file] of files.entries()) {
    const r = await fileToImages(file, onProgress);
    viewImages.push(...r.viewImages);
    apiImages.push(...r.apiImages);
    r.apiImages.forEach((_, i) => pageRefs.push({ file: fileIndex, page: r.pageNumbers?.[i] ?? 1 }));
    if (r.textLayers && r.textLayers.length === r.apiImages.length) {
      textLayers.push(...r.textLayers);
    } else {
      allHaveText = false;
    }
  }

  return { viewImages, apiImages, textLayers: allHaveText ? textLayers : undefined, pageRefs };
}

/** Where one sent image came from: file index in the slot, real 1-based PDF page. */
export interface PageRef { file: number; page: number }

/**
 * Tags each non-empty top-level value with where it was read — `foo_page`
 * (real PDF page) and `foo_file` (file index, only when not the first file) —
 * so the Evidence Viewer can open the document at that page. Light documents
 * are read one page per call, so the chunk's first page IS the source page;
 * for a 2-page estimate chunk it is the first of the two.
 */
export function tagFieldPages(fragment: unknown, ref: PageRef | undefined): unknown {
  if (!ref || !fragment || typeof fragment !== 'object' || Array.isArray(fragment)) return fragment;
  const out: Record<string, unknown> = { ...(fragment as Record<string, unknown>) };
  for (const [k, v] of Object.entries(fragment as Record<string, unknown>)) {
    if (/_(context|page|file)$/.test(k) || v === '' || v === null || v === undefined || typeof v === 'object') continue;
    out[`${k}_page`] = ref.page;
    if (ref.file > 0) out[`${k}_file`] = ref.file;
  }
  return out;
}

// Max long-edge dimension for images sent to the AI API.
const MAX_API_IMAGE_DIM = 1600;

/**
 * Downscales an image data URL so its longest edge is ≤ MAX_API_IMAGE_DIM,
 * re-encoding as JPEG 90%. Returns the original if it's already small enough
 * or if decoding fails (never blocks extraction).
 */
async function downscaleForApi(dataUrl: string): Promise<string> {
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image decode failed'));
      img.src = dataUrl;
    });
    const scale = MAX_API_IMAGE_DIM / Math.max(img.width, img.height);
    if (scale >= 1) return dataUrl;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return dataUrl;
  }
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
  /** Unresolved row/gross findings for the review dialog (empty on a clean read). */
  findings: Finding[];
  /** Pages the AI could not (fully) read. */
  issues: string[];
}

/**
 * A whole-document re-read on the next model is worth its cost only when the
 * gross does not reconcile AND no serial gap explains it — a row without a
 * serial is gone and no page can be pinned. Every other case is handled by
 * the cheaper gap fill or needs no call at all.
 */
export function needsSecondOpinion(docType: string, data: unknown, pageTexts?: string[]): boolean {
  if (docType !== 'estimate' && docType !== 'final-bill') return false;
  if (!data || typeof data !== 'object') return false;
  const c = rowCheck(data, pageTexts);
  return !!c.grossMismatch && c.gaps.length === 0;
}

/** Thrown when the surveyor cancels. Named so callers can stay silent on it. */
function abortError(): Error {
  const e = new Error('Extraction cancelled');
  e.name = 'AbortError';
  return e;
}

export async function extractDocument(
  key: string,
  file: File | File[],
  onProgress?: (msg: string, pagesDone?: number, pagesTotal?: number) => void,
  feedback?: string,
  previousData?: any,
  forceDocMode?: 'text' | 'vision',
  // ponytail: abort is checked between page chunks, not threaded into fetch.
  // That stops every remaining call — which is where the quota goes on a slow
  // multi-page document — without rewiring callAIGateway/callWithFallback/
  // callWithKey and their seven call sites. The one already-dispatched request
  // is billed the moment it leaves, so threading deeper would save nothing but
  // its response. Upgrade path: add `signal` to those three signatures and pass
  // it to the two fetch() calls in service.ts (405, 501).
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  const files = Array.isArray(file) ? file : [file];
  const job = jobForDocType(key);
  const session = newSession(`${key}-${Date.now()}`);
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
    const { viewImages, apiImages, textLayers, pageRefs } = await filesToImages(files, (p, t) => {
      if (onProgress) onProgress(`Processing page ${p} of ${t}...`);
    });

    const totalPages = apiImages.length;
    session.pagesTotal = totalPages;   // heavy ranking skips keys that cannot cover the whole document

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
      console.log(`[AI Extraction] ${key}: text-mode detected (${totalPages} pages, text-native PDF)`);
    } else {
      console.log(`[AI Extraction] ${key}: vision-mode (${docMode})`);
    }

    // Chunk size: always 1 page per call in text-mode (avoids 413 on dense documents).
    // In vision-mode: estimates prefer 2 pages per call for efficiency; others get 1.
    // The preference is then clamped to the active provider's image cap — NVIDIA
    // accepts exactly 1, and exceeding it 400s the whole request.
    const PREFERRED_VISION_CHUNK = (key === 'estimate' || key === 'final-bill') ? 2 : 1;
    const VISION_CHUNK_SIZE = resolveVisionChunkSize(PREFERRED_VISION_CHUNK, getActiveImageCap(job));
    const CHUNK_SIZE = useTextMode ? 1 : VISION_CHUNK_SIZE;

    // Build the base prompt — for vision mode on digitally-born docs we still
    // hint the AI with the text layer for accuracy, but send images too.
    let enhancedPrompt = prompt;
    if (docMode !== 'vision' && textLayers && textLayers.some(t => hasFinancialData(t))) {
      const textPreview = textLayers.slice(0, 3).join('\n---PAGE BREAK---\n');
      enhancedPrompt = `${prompt}\n\nNOTE: This appears to be a digitally-created document (not scanned). The extracted text layer is provided below for reference to guide your extraction:\n\n${textPreview}\n\nUse this text as a reference to ensure accuracy, but validate against the visual document.`;
    }

    // One pass over every chunk. Runs a second time (on the next model) only
    // when the first pass fails the math check — see needsSecondOpinion below.
    // quiet: a second pass whose result may be discarded — no hard-failure toast;
    // the error still throws and the second-opinion catch keeps the first result.
    async function runAllChunks(quiet = false): Promise<{ result: any; issues: string[] }> {
      const failToast = (e: unknown) => {
        if (quiet) return;
        const msg = e instanceof Error ? e.message : 'Unknown error';
        toast.error(`AI extraction failed — ${msg}. Please enter fields manually.`);
      };
      let result: any = null;
      // Pages the AI could not (fully) read — surfaced to the surveyor alongside
      // math discrepancies so missing line items are never silent.
      const issues: string[] = [];

      for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
        // Cancelled between pages — stop before spending another call.
        if (signal?.aborted) throw abortError();

        const currentBatchStart = i + 1;
        const currentBatchEnd = Math.min(i + CHUNK_SIZE, totalPages);

        if (onProgress) {
          let msg = totalPages > 1
            ? `Analyzing page ${currentBatchStart}–${currentBatchEnd} of ${totalPages}...`
            : 'Analyzing document...';
          // Single pass — no retry prefix needed
          // Page counts drive the determinate progress fill; the message alone
          // cannot be parsed reliably for them.
          onProgress(msg, currentBatchEnd, totalPages);
        }

        // Small throttle delay between chunks to avoid rate limiting
        if (i > 0) await new Promise(r => setTimeout(r, 600));

        // Budget is "calls still needed from here on", not the whole document —
        // a key with just enough left for the rest must not be dropped mid-read.
        session.pagesTotal = Math.ceil((totalPages - i) / CHUNK_SIZE);

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
          let pageTruncated = false;
          if (pageText.length > MAX_PAGE_TEXT_CHARS) {
            pageTruncated = true;
            console.warn(
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
            console.warn(
              `[AI Extraction] ${key}: page ${currentBatchStart} still too large for text-mode ` +
              `(~${estimateTokens(candidatePrompt)} tokens) — falling back to vision.`
            );
            chunkImages = apiImages.slice(i, i + 1);
            chunkPrompt = enhancedPrompt;
          } else {
            chunkPrompt = candidatePrompt;
            chunkImages = []; // pure text mode — no images
            if (pageTruncated) {
              issues.push(`Page ${currentBatchStart} is very dense and was only partially read — verify its line items against the document.`);
            }
          }
        } else {
          // Vision path: send JPEG images (existing behaviour)
          chunkImages = apiImages.slice(i, i + CHUNK_SIZE);
          chunkPrompt = enhancedPrompt;
        }

        // Parse one gateway reply and fold it into `result`; an unparseable page is
        // logged as an issue (multi-page) or thrown (single-page). Shared by the
        // normal path and the page-at-a-time 413 fallback below.
        const mergeResponse = (rawResponse: string, first: number, last: number) => {
          try {
            const fragment = JSON.parse(rawResponse);
            result = mergeAIResults(result, tagFieldPages(tagRows(fragment, first - 1, last - 1), pageRefs[first - 1]));   // 1-based chunk → 0-based page tags
          } catch (err) {
            // For multi-page docs: one bad page should not abort the whole extraction.
            // Log the failure and continue accumulating results from other pages.
            console.warn(
              `[AI Extraction] ${key}: page chunk ${first}–${last} returned unparseable JSON — skipping this chunk.`,
              '\nRaw response (first 500 chars):', rawResponse?.slice(0, 500)
            );
            if (totalPages === 1) {
              // Single-page doc with no fallback — propagate as before
              throw new Error('AI returned an invalid format. Please try again or enter fields manually.');
            }
            // Multi-page: continue with whatever we have accumulated so far,
            // but tell the surveyor which pages are missing.
            const pageLabel = first === last ? `Page ${first}` : `Pages ${first}–${last}`;
            issues.push(`${pageLabel} could not be read by the AI — line items from ${first === last ? 'this page' : 'these pages'} may be missing.`);
          }
        };

        let rawResponse: string;
        try {
          rawResponse = await callAIGateway(chunkPrompt, chunkImages, 'json', job, session, signal);
        } catch (firstErr: any) {
          // The gateway already walked every model/key/provider and, on cancel,
          // threw on purpose — re-calling it would repeat the whole walk and
          // double every toast.
          if (firstErr?.name === 'AbortError' || firstErr instanceof AllProvidersBusyError || firstErr instanceof OfflineError) throw firstErr;

          // ── Payload too large → auto-fallback to vision for this chunk ──────
          // The gateway signals PAYLOAD_TOO_LARGE when even the shortest text-mode
          // prompt exceeds the provider's token cap. Retrying with the same prompt
          // won't help, but sending the page as an image almost certainly will.
          const isTooBig =
            firstErr?.status === 413 ||
            (firstErr?.message ?? '').includes('PAYLOAD_TOO_LARGE');

          if (isTooBig && chunkImages.length === 0) {
            // We were in text-mode — retry this chunk in vision-mode
            console.warn(
              `[AI Extraction] ${key}: PAYLOAD_TOO_LARGE on text chunk ${currentBatchStart} ` +
              `— retrying as vision (image) chunk.`
            );
            const visionImages = apiImages.slice(i, i + 1); // 1 page vision fallback
            try {
              rawResponse = await callAIGateway(enhancedPrompt, visionImages, 'json', job, session, signal);
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
                failToast(visionErr);
              }
              throw visionErr;
            }
          } else if (isTooBig && chunkImages.length > 1) {
            // Vision chunk too large for every model that fits it — re-run this
            // chunk one page at a time. ponytail: one page is the floor; if a
            // single page 413s the document is beyond every configured model.
            console.warn(`[AI Extraction] ${key}: PAYLOAD_TOO_LARGE on vision chunk ${currentBatchStart}–${currentBatchEnd} — re-running one page at a time.`);
            for (let p = 0; p < chunkImages.length; p++) {
              if (signal?.aborted) throw abortError();
              // One page left in this fallback call — plus every chunk after it.
              session.pagesTotal = (chunkImages.length - p) + Math.ceil((totalPages - currentBatchEnd) / CHUNK_SIZE);
              const r = await callAIGateway(enhancedPrompt, [chunkImages[p]], 'json', job, session, signal);
              mergeResponse(r, currentBatchStart + p, currentBatchStart + p);
            }
            continue;
          } else if (isTooBig) {
            // A single page is still too large — beyond every configured model.
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
              rawResponse = await callAIGateway(chunkPrompt, chunkImages, 'json', job, session, signal);
            } catch (err: any) {
              failToast(err);
              throw err;
            }
          }
        }

        mergeResponse(rawResponse, currentBatchStart, currentBatchEnd);
      }

      return { result, issues };
    }

    let { result: finalResult, issues: pageIssues } = await runAllChunks();
    const firstPassModel = session.lastGood?.model;

    const money = key === 'estimate' || key === 'final-bill';
    // Text-mode pages give us something to verify the printed gross against;
    // vision pages do not, so the model's figure is trusted there.
    const pageTexts = money && useTextMode && textLayers ? textLayers : undefined;

    if (money && finalResult) {
      const drop = takeDrop();                                   // dev-only ?ai-drop=38
      if (drop) {
        finalResult = Object.fromEntries(Object.entries(finalResult).map(([k, v]) =>
          [k, Array.isArray(v) ? v.filter((r: any) => Number(r?.sr_no) !== drop) : v]));
        console.info(`[ai-fault] dropped serial ${drop} from the first pass`);
      }

      let check = rowCheck(finalResult, pageTexts);
      if (check.duplicates.length) {
        if (check.duplicatesDroppable) {
          console.info('[Smart Fix] dropped duplicate serials', check.duplicates);
          finalResult = dropDuplicates(finalResult);
          check = rowCheck(finalResult, pageTexts);
        } else {
          console.info('[Smart Fix] duplicate ratio too high — unnumbered document, keeping every row', check.duplicates.length);
        }
      }

      if (check.gaps.length) {
        console.info('[Smart Fix] serial gaps after first pass:', check.gaps);
        try {
          finalResult = await fillGaps({
            basePrompt: enhancedPrompt, apiImages, data: finalResult,
            srNos: check.gaps.map(g => g.srNo),
            pages: [...new Set(check.gaps.flatMap(g => g.pages))],
            session, signal, onProgress: msg => onProgress?.(msg),
          });
          check = rowCheck(finalResult, pageTexts);
        } catch (e) {
          if (signal?.aborted || (e as { name?: string })?.name === 'AbortError') throw e;
          console.warn('[Smart Fix] gap fill unavailable — keeping first result', e);
        }
      }

      // ponytail: the second opinion re-runs the WHOLE document on the next
      // model. Only when the gross is off and no serial gap can be blamed —
      // an unserialled row is gone and no page can be pinned.
      if (check.grossMismatch && check.gaps.length === 0 && session.lastGood) {
        console.info('[ai-fallback] gross does not reconcile and no serial gap explains it:', check.grossMismatch);
        onProgress?.('Totals don\'t add up — asking a second AI model to re-read the document…');
        if (firstPassModel) session.avoid.add(firstPassModel);
        session.lastGood = undefined;
        try {
          const second = await runAllChunks(true);
          const secondCheck = rowCheck(second.result, pageTexts);
          const secondData = secondCheck.duplicatesDroppable ? dropDuplicates(second.result) : second.result;
          const secondFinal = rowCheck(secondData, pageTexts);
          if (!secondFinal.grossMismatch && secondFinal.gaps.length === 0) {
            const secondModel = (session as typeof session).lastGood?.model;
            console.info(`[ai-fallback] second opinion from ${secondModel} reconciles; first (${firstPassModel}) did not.`);
            finalResult = secondData; pageIssues = second.issues;
          }
        } catch (e) {
          if (signal?.aborted || (e as { name?: string })?.name === 'AbortError') throw e;
          console.warn('[ai-fallback] second opinion unavailable — keeping first result', e);
        } finally {
          if (firstPassModel) session.avoid.delete(firstPassModel);
        }
      }
    }

    const findings: Finding[] = money && finalResult ? toFindings(rowCheck(finalResult, pageTexts)) : [];

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
    return { data: finalResult, images: viewImages, findings, issues: pageIssues };
  });
}

/**
 * Smart Fix button: the same gap engine, run on the pending review result.
 * Gap findings re-read their pages for their serials; a gross-only finding
 * re-reads the last page (where the gross lives) for rows not yet listed.
 */
export async function smartFixRescan(
  key: string,
  file: File,
  data: unknown,
  findings: Finding[],
  onProgress?: (msg: string) => void,
  signal?: AbortSignal,
  forceDocMode?: 'text' | 'vision',
): Promise<{ data: unknown; findings: Finding[] }> {
  const basePrompt = getDocPrompt(key) ?? 'Extract all visible details from this document as JSON.';
  return aiQueue.add(async () => {
    onProgress?.('Smart Fix: loading document…');
    const { apiImages, textLayers } = await fileToImages(file);
    const detected = textLayers ? profilePages(textLayers).docMode : 'vision';
    const pageTexts = (forceDocMode ?? detected) === 'text' && textLayers ? textLayers : undefined;
    const session = newSession(`${key}-fix-${Date.now()}`);

    const gap = findings.find((f): f is Extract<Finding, { kind: 'gap' }> => f.kind === 'gap');
    const srNos = gap?.srNos ?? [];
    const pages = gap ? gap.pages : [apiImages.length - 1];

    let next = await fillGaps({ basePrompt, apiImages, data, srNos, pages, session, signal, onProgress });
    const check = rowCheck(next, pageTexts);
    if (check.duplicatesDroppable) next = dropDuplicates(next);
    return { data: next, findings: toFindings(rowCheck(next, pageTexts)) };
  });
}
