export type FormFieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const IGNORED_INPUT_TYPES = new Set([
  'hidden',
  'file',
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
]);

/**
 * Returns all unfilled, visible, interactive form fields (input, textarea, select)
 * within a given container element.
 *
 * Requirements:
 * - Returns [] if container is null.
 * - Skips disabled or readonly elements.
 * - Skips invisible elements (offsetParent === null, aria-hidden === 'true', or 0x0 size).
 * - For HTMLInputElement: skips types ['hidden', 'file', 'checkbox', 'radio', 'button', 'submit', 'reset'].
 *   Unfilled if value.trim() === ''.
 * - For HTMLTextAreaElement: unfilled if value.trim() === ''.
 * - For HTMLSelectElement: unfilled if value.trim() === '', UNLESS the selected option
 *   contains "not applicable" (case-insensitive).
 */
export function getUnfilledFields(container: HTMLElement | null): FormFieldElement[] {
  if (!container) return [];

  const candidates = container.querySelectorAll<FormFieldElement>('input, textarea, select');
  const unfilled: FormFieldElement[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i];

    // Skip disabled or readonly
    if (el.disabled || ('readOnly' in el && (el as HTMLInputElement).readOnly)) {
      continue;
    }

    // Skip invisible
    if (el.offsetParent === null || el.getAttribute('aria-hidden') === 'true') {
      continue;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      continue;
    }

    const tag = el.tagName.toUpperCase();
    if (tag === 'INPUT') {
      const input = el as HTMLInputElement;
      if (IGNORED_INPUT_TYPES.has(input.type.toLowerCase())) {
        continue;
      }
      if (input.value.trim() === '') {
        unfilled.push(input);
      }
    } else if (tag === 'TEXTAREA') {
      const textarea = el as HTMLTextAreaElement;
      if (textarea.value.trim() === '') {
        unfilled.push(textarea);
      }
    } else if (tag === 'SELECT') {
      const select = el as HTMLSelectElement;
      if (select.value.trim() === '') {
        const selectedOpt = select.options[select.selectedIndex];
        const optText = selectedOpt ? (selectedOpt.text || selectedOpt.textContent || '') : '';
        if (!optText.toLowerCase().includes('not applicable')) {
          unfilled.push(select);
        }
      }
    }
  }

  return unfilled;
}
