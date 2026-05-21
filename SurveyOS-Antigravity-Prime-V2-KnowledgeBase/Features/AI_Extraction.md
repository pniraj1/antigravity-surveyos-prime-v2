# AI Extraction

## Current Implementation

- **What it does:** Multi-provider AI service for OCR/document extraction from insurance documents (RC, DL, Policy, Estimate, Invoice, Bank Statement). Supports multiple AI providers with automatic fallback, key rotation, and targeted rescans for discrepancies. Returns evidence context snippets for traceability.
- **Key files:**
  - `src/lib/ai/service.ts` — Gateway supporting Gemini 2.5-flash (default), Groq Llama-4-scout, NVIDIA Llama-3.2; handles model deprecation and free-tier rate limits
  - `src/lib/ai/prompts.ts` — Specialized JSON extraction prompts per document type; returns context snippets per extracted field
  - `src/lib/ai/processor.ts` — Orchestrates multi-document extraction pipeline
  - `src/lib/ai/reconciliation.ts` — Reconciles conflicting data from multiple documents
  - `src/lib/ai/bank-statement-extractor.ts` — Specialized bank statement/invoice extraction
  - `src/hooks/useAIExtraction.ts` — React hook managing extraction workflow, targeted rescans, session storage of last files
  - `src/components/ai/AIControls.tsx` — Provider toggle, doc mode toggle, model selector UI
  - `src/components/dialogs/AIReviewDialog.tsx` — Review extracted data before applying
- **Dependencies:** Gemini API, Groq API, NVIDIA NIM API, Firebase Firestore (for AI config), Sonner toasts

## Known Issues / What Went Wrong

- Model deprecation handling required: gemini-2.0-flash shutdown (March 2026), gemini-3-pro-preview deprecated, Maverick deprecated
- Free-tier rate limits documented but NOT enforced at client level (10 RPM for gemini-2.5-flash)
- Vision model availability differs by provider (Groq vision limited to scout)
- 60-second extraction timeout was silently failing on large PDFs (removed 2026-04-26)

## Improvement Ideas

- Client-side rate limiting to prevent API quota exhaustion
- Extraction confidence scores displayed in UI
- Batch extraction for multiple documents
- Cache extracted results to avoid re-processing same document

## Technical Debt

- `@ts-ignore` used for google.accounts.oauth2 type access in drive integration
- AI provider keys stored in Firestore profile (free-tier, low risk but not ideal)

## Related

- [[Assessment_Grid]] — AI fills assessment rows from extracted data
- [[Cloud_Sync]] — Extracted documents synced via Drive
- `Project_Bramha/Overview.md` — Bramha agentic RAG system (shadow mode)
