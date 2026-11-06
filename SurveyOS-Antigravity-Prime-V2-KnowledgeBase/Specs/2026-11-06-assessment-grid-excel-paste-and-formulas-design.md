# Design: Assessment Grid Excel Copy/Paste & Inline Formula Calculations

> Date: 2026-11-06  
> Author: Antigravity  
> Status: Approved by User

## 1. Understanding Summary
- **What is being built:**
  1. **Native Clipboard Paste (`Ctrl+V`):** Replaces the permission-blocked `navigator.clipboard.readText()` with standard React `onPaste` handling (`e.clipboardData.getData('text/plain')`).
  2. **Multi-Cell Range Fill & Multi-Line Paste:**
     - Pasting a single value (e.g. `18` or `18%`) fills all selected cells in the column range.
     - Pasting multi-line data from Excel applies row-by-row down the active section.
  3. **Native Clipboard Copy (`Ctrl+C`):** Copies the value(s) of the active cell or range to the system clipboard on `onCopy`.
  4. **Fill Down (`Ctrl+D`):** Classic Excel shortcut to duplicate the top cell's value into all selected cells below it without copying first.
  5. **Inline Math / Formula Evaluation (`=150+200` $\rightarrow$ `350`):** In numeric cells (Assessed, Estimated, Quantity), surveyors can type arithmetic expressions (e.g. `=150+200` or `150+200`). On `Enter` or `blur`, the math evaluates safely and commits the calculated figure.
- **Why it exists:** Surveyors need Excel-grade speed when updating rates in bulk (like GST% pulled as 0%) and computing multi-item assessments without switching to an external calculator.
- **Who it is for:** Motor insurance surveyors editing line items in the Assessment sheet.
- **Key Constraints:**
  - Standard browser event model: zero permission popups or security exceptions.
  - Safe evaluation: zero `eval()` or code execution vulnerabilities.
  - Seamless keyboard flow: Tab, Shift+Arrow selection, Ctrl+C, Ctrl+V, Ctrl+D.

## 2. Assumptions
- Input fields switch from restrictive HTML `type="number"` to text-based numeric inputs (using local state while editing) so browsers permit typing `=`, `+`, `-`, `*`, `/`.
- Both leading `=` (e.g. `=150+200`) and bare expressions (e.g. `150+200`) are recognized and calculated.
- If an invalid formula is entered, it gracefully preserves the existing value or shows a gentle error state without crashing.

## 3. Decision Log
| Feature | Decision | Rationale |
|---|---|---|
| **Paste Handler** | `onPaste` event with `e.clipboardData.getData('text/plain')` | Standard web event model; works synchronously across all browsers with zero permission denials. |
| **Copy Handler** | `onCopy` event with `e.clipboardData.setData('text/plain', text)` | Copies selected range as newline-delimited text so it can be pasted back or pasted into Excel. |
| **Formula Syntax** | Allow `=150+200` and `150+200` | High convenience; surveyors familiar with Excel can type `=`, but simple math without `=` also evaluates. |
| **Formula Engine** | 25-line safe tokenizer/evaluator | Zero dependencies, safe arithmetic parser strictly supporting `+`, `-`, `*`, `/`, `()`, decimals, and numbers. |

## 4. Final Design Specification

### 4.1 Safe Arithmetic Parser (`src/lib/utils/formula-eval.ts`)
```typescript
/**
 * Safely evaluates a basic arithmetic expression without eval().
 * Supports +, -, *, /, parenthesis, and decimals.
 * Returns null if the expression is invalid or contains non-math characters.
 */
export function evaluateFormula(expr: string): number | null {
  if (!expr || typeof expr !== 'string') return null;
  const clean = expr.trim().replace(/^=/, '').trim();
  if (!clean) return null;
  
  // Whitelist only numbers, decimals, basic operators, parens, and spaces
  if (!/^[0-9+\-*/().\s]+$/.test(clean)) return null;

  try {
    // Safe tokenizer and recursive descent or shunting-yard evaluator
    const tokens = tokenize(clean);
    const result = parseExpression(tokens);
    return isFinite(result) ? Math.round(result * 100) / 100 : null;
  } catch {
    return null;
  }
}
```

### 4.2 Formula-Enabled Numeric Cell Input
Create or enhance the numeric input in [`AssessmentSectionTable.tsx`](file:///c:/Users/Manasi/OneDrive/Desktop/Antigravity%20Surveyor%20V6%20fixed/SurveyOS-Prime-V2/src/components/claim/AssessmentSectionTable.tsx):
- Manages local string state `editValue` on focus.
- Displays evaluated number on blur (`onChange` commits the evaluated number via `evaluateFormula` or `parseFloat`).
- Submits on `Enter`, reverts on `Escape`.

### 4.3 Clipboard Handlers in `AssessmentSectionTable.tsx` / `AssessmentGrid.tsx`
- **`onPaste`**:
  ```typescript
  const handlePaste = (e: React.ClipboardEvent) => {
    if (!selection.cellSelection) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    applyClipboardText(text, selection.cellSelection);
  };
  ```
- **`onCopy`**:
  ```typescript
  const handleCopy = (e: React.ClipboardEvent) => {
    if (!selection.cellSelection) return;
    const text = getSelectionClipboardText(selection.cellSelection);
    if (text) {
      e.clipboardData.setData('text/plain', text);
      e.preventDefault();
    }
  };
  ```
- **`Ctrl+D` (Fill Down)**:
  Handled in `onGridKeyDown` when `(e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd'`.
