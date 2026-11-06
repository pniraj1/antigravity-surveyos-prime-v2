/**
 * Safe inline arithmetic/formula evaluator for assessment grid cells.
 * Does NOT use eval() or Function().
 * Supports +, -, *, /, parenthesis, unary minus, and decimals.
 * Accepts expressions with or without a leading '='.
 * Returns null if the expression is invalid, empty, or divides by zero.
 */

type TokenType = 'NUMBER' | 'OP' | 'LPAREN' | 'RPAREN';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'OP', value: ch });
      i++;
      continue;
    }

    // Number (including leading decimal like .5 or 150.25)
    if (/\d/.test(ch) || (ch === '.' && i + 1 < input.length && /\d/.test(input[i + 1]))) {
      let numStr = '';
      let hasDot = false;
      while (i < input.length && (/\d/.test(input[i]) || input[i] === '.')) {
        if (input[i] === '.') {
          if (hasDot) return null; // multiple dots invalid
          hasDot = true;
        }
        numStr += input[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: numStr });
      continue;
    }

    // Any unrecognized character
    return null;
  }

  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  parse(): number | null {
    if (this.tokens.length === 0) return null;
    const result = this.parseExpression();
    if (result === null) return null;
    // Must consume all tokens
    if (this.pos < this.tokens.length) return null;
    if (!Number.isFinite(result)) return null;
    return Math.round((result + Number.EPSILON) * 100) / 100;
  }

  // Expression = Term (('+' | '-') Term)*
  private parseExpression(): number | null {
    let left = this.parseTerm();
    if (left === null) return null;

    while (this.pos < this.tokens.length) {
      const tok = this.peek();
      if (!tok || tok.type !== 'OP' || (tok.value !== '+' && tok.value !== '-')) {
        break;
      }
      this.consume();
      const right = this.parseTerm();
      if (right === null) return null;
      if (tok.value === '+') {
        left += right;
      } else {
        left -= right;
      }
    }

    return left;
  }

  // Term = Factor (('*' | '/') Factor)*
  private parseTerm(): number | null {
    let left = this.parseFactor();
    if (left === null) return null;

    while (this.pos < this.tokens.length) {
      const tok = this.peek();
      if (!tok || tok.type !== 'OP' || (tok.value !== '*' && tok.value !== '/')) {
        break;
      }
      this.consume();
      const right = this.parseFactor();
      if (right === null) return null;
      if (tok.value === '*') {
        left *= right;
      } else {
        if (right === 0) return null; // Division by zero
        left /= right;
      }
    }

    return left;
  }

  // Factor = ('+' | '-')? Primary
  private parseFactor(): number | null {
    const tok = this.peek();
    if (!tok) return null;

    if (tok.type === 'OP' && (tok.value === '+' || tok.value === '-')) {
      this.consume();
      const factor = this.parseFactor();
      if (factor === null) return null;
      return tok.value === '-' ? -factor : factor;
    }

    return this.parsePrimary();
  }

  // Primary = NUMBER | '(' Expression ')'
  private parsePrimary(): number | null {
    const tok = this.peek();
    if (!tok) return null;

    if (tok.type === 'NUMBER') {
      this.consume();
      const n = parseFloat(tok.value);
      return Number.isNaN(n) ? null : n;
    }

    if (tok.type === 'LPAREN') {
      this.consume();
      const expr = this.parseExpression();
      if (expr === null) return null;
      const closing = this.peek();
      if (!closing || closing.type !== 'RPAREN') return null;
      this.consume(); // consume ')'
      return expr;
    }

    return null;
  }
}

/**
 * Evaluates an arithmetic formula string safely.
 * Returns the computed number (rounded to 2 decimal places), or null if invalid.
 *
 * Examples:
 *   evaluateFormula('=150+200')     => 350
 *   evaluateFormula('150+200')      => 350
 *   evaluateFormula('150*1.18')     => 177
 *   evaluateFormula('(100+50)*1.18')=> 177
 *   evaluateFormula('invalid')      => null
 */
export function evaluateFormula(expr: string | null | undefined): number | null {
  if (!expr || typeof expr !== 'string') return null;

  const trimmed = expr.trim();
  if (!trimmed) return null;

  // Strip leading '=' if present (Excel formula notation)
  const clean = trimmed.startsWith('=') ? trimmed.slice(1).trim() : trimmed;
  if (!clean) return null;

  const tokens = tokenize(clean);
  if (!tokens) return null;

  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Checks whether a user input looks like a formula or mathematical expression.
 * Returns true if it starts with '=' or contains mathematical operators between digits.
 */
export function isFormulaCandidate(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  if (trimmed.startsWith('=')) return true;
  return /[0-9]\s*[\+\-\*\/]\s*[0-9]/.test(trimmed);
}
