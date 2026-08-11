/**
 * Grading functions for chemistry quiz answers.
 *
 * All grading is pure text matching against canonical answers with normalization
 * and accepted aliases — no AI calls needed for v1 (per ARCHITECTURE.md).
 */

import { normalize } from './normalize';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GradeResult {
  correct: boolean;
  feedback?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Standard Levenshtein (edit) distance between two strings.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Pre-process symbolic charge notation to word form BEFORE normalization.
 * Needed because normalize() strips "+" as punctuation.
 *
 * Handles: "1+" → "1 plus", "2-" → "2 minus", "+3" → "plus 3", "-1" → "minus 1"
 */
function preProcessChargeSymbols(text: string): string {
  return text
    .replace(/(\d)\s*\+/g, '$1 plus')
    .replace(/\+\s*(\d)/g, 'plus $1')
    .replace(/(\d)\s*-/g, '$1 minus')
    .replace(/-\s*(\d)/g, 'minus $1')
    .replace(/^\s*\+\s*$/, 'plus')
    .replace(/^\s*-\s*$/, 'minus');
}

// ---------------------------------------------------------------------------
// Element grading
// ---------------------------------------------------------------------------

/**
 * Grade a user's answer for an element-name question.
 *
 * - Exact match (after normalization) against the canonical name or any alias → correct.
 * - Levenshtein distance ≤ 1 against the primary name only → correct (absorbs minor
 *   dictation slips per ARCHITECTURE.md).
 */
export function gradeElementAnswer(
  answer: string,
  element: { name: string; aliases: string[] },
): GradeResult {
  const normalizedAnswer = normalize(answer);
  const normalizedName = normalize(element.name);

  if (normalizedAnswer === normalizedName) return { correct: true };

  for (const alias of element.aliases) {
    if (normalizedAnswer === normalize(alias)) return { correct: true };
  }

  if (
    normalizedAnswer.length > 0 &&
    levenshtein(normalizedAnswer, normalizedName) <= 1
  ) {
    return {
      correct: true,
      feedback: `Accepted — close match for "${element.name}."`,
    };
  }

  return { correct: false, feedback: `The correct answer is ${element.name}.` };
}

// ---------------------------------------------------------------------------
// Ion charge parsing
// ---------------------------------------------------------------------------

const SIGN_WORDS_POSITIVE = new Set(['plus', 'positive']);
const SIGN_WORDS_NEGATIVE = new Set(['minus', 'negative']);

/**
 * Parse a spoken charge answer from a transcript.
 *
 * Accepts:
 * - Word form:    "3 plus", "positive 3", "minus 2", "negative 1"
 * - Symbolic:     "3+", "2-", "+1", "-3"
 * - Implied mag:  "plus" → +1, "minus" → -1
 *
 * Returns the signed integer, or null if the transcript cannot be parsed.
 */
export function parseChargeAnswer(transcript: string): number | null {
  const processed = preProcessChargeSymbols(transcript);
  const normalized = normalize(processed);
  const tokens = normalized.split(/\s+/).filter(Boolean);

  let magnitude: number | null = null;
  let sign: number | null = null;

  for (const token of tokens) {
    if (SIGN_WORDS_POSITIVE.has(token)) {
      sign = 1;
      continue;
    }
    if (SIGN_WORDS_NEGATIVE.has(token)) {
      sign = -1;
      continue;
    }
    const asDigit = parseInt(token, 10);
    if (!isNaN(asDigit) && asDigit >= 1 && asDigit <= 9) {
      magnitude = asDigit;
      continue;
    }
  }

  if (sign === null) return null;
  if (magnitude === null) magnitude = 1;
  return sign * magnitude;
}

/**
 * Returns true if the transcript uses conventional charge order (number before sign).
 * Conventional: "3 plus", "2 minus", "3+", "2-"
 * Non-conventional: "positive 3", "negative 2"
 */
export function isConventionalChargeOrder(transcript: string): boolean {
  const processed = preProcessChargeSymbols(transcript);
  const normalized = normalize(processed);
  const tokens = normalized.split(/\s+/).filter(Boolean);

  let numberIndex = -1;
  let signIndex = -1;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (
      (SIGN_WORDS_POSITIVE.has(token) || SIGN_WORDS_NEGATIVE.has(token)) &&
      signIndex === -1
    ) {
      signIndex = i;
    }
    const asDigit = parseInt(token, 10);
    if (!isNaN(asDigit) && asDigit >= 1 && asDigit <= 9 && numberIndex === -1) {
      numberIndex = i;
    }
  }

  // If no explicit number (implied 1), treat as conventional
  if (numberIndex === -1) return true;
  return numberIndex < signIndex;
}

// ---------------------------------------------------------------------------
// Formula + charge parsing (experimental, per ARCHITECTURE.md)
// ---------------------------------------------------------------------------

/**
 * Lookup table mapping common dictation renderings of spoken letters/element names
 * to their element symbols. Covers the elements found in polyatomic anions.
 */
const DICTATION_TO_SYMBOL: Record<string, string> = {
  // Single-letter elements and their common dictation forms
  s: 'S',
  es: 'S',
  o: 'O',
  oh: 'O',
  c: 'C',
  see: 'C',
  h: 'H',
  n: 'N',
  p: 'P',
  b: 'B',
  i: 'I',
  f: 'F',
  // Multi-letter elements and element-name renderings
  cl: 'Cl',
  chlorine: 'Cl',
  br: 'Br',
  bromine: 'Br',
  cr: 'Cr',
  chromium: 'Cr',
  mn: 'Mn',
  manganese: 'Mn',
};

/**
 * Greedy left-to-right parsing of a lowercase letter sequence into element symbols.
 * Tries two-letter symbols first (Cl, Br, Cr, Mn), then single-letter.
 * Returns null if any character can't be mapped.
 */
function parseElementSequence(letters: string): string[] | null {
  const result: string[] = [];
  let i = 0;
  while (i < letters.length) {
    // Try two-letter match first
    if (i + 1 < letters.length) {
      const twoChar = letters[i] + letters[i + 1];
      const sym = DICTATION_TO_SYMBOL[twoChar];
      if (sym) {
        result.push(sym);
        i += 2;
        continue;
      }
    }
    // Try single-letter match
    const oneChar = letters[i];
    const sym = DICTATION_TO_SYMBOL[oneChar];
    if (sym) {
      result.push(sym);
      i += 1;
      continue;
    }
    return null; // unrecognized character
  }
  return result.length > 0 ? result : null;
}

/**
 * Experimental parser for formula + charge answers (polyatomic anions).
 *
 * Handles both dictation ("s o 4 2 minus") and typed ("SO4 2-", "SO4 2 minus") input.
 * Splits mixed letter/digit tokens (e.g. "po3" → ["po","3"]), then maps letter
 * sequences to element symbols via greedy matching.
 *
 * Per ARCHITECTURE.md: recommend testing against real on-device dictation before
 * relying heavily on this — accuracy is unverified for spoken-letter sequences.
 */
export function parseFormulaChargeAnswer(
  transcript: string,
  expectedFormula: string,
  expectedCharge: number,
): boolean {
  const processed = preProcessChargeSymbols(transcript);
  const normalized = normalize(processed);

  // Split into tokens, then sub-tokenize mixed letter/digit tokens
  const rawTokens = normalized.split(/\s+/).filter(Boolean);
  const tokens: string[] = [];
  for (const t of rawTokens) {
    if (/[a-z]/.test(t) && /\d/.test(t)) {
      // Split on letter/digit boundaries: "po3" → ["po", "3"]
      const parts = t.match(/[a-z]+|\d+/g);
      if (parts) tokens.push(...parts);
      else tokens.push(t);
    } else {
      tokens.push(t);
    }
  }

  const formulaParts: string[] = [];
  const chargeTokens: string[] = [];
  let inCharge = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (inCharge) {
      chargeTokens.push(token);
      continue;
    }

    // Sign word starts the charge phrase
    if (SIGN_WORDS_POSITIVE.has(token) || SIGN_WORDS_NEGATIVE.has(token)) {
      inCharge = true;
      chargeTokens.push(token);
      continue;
    }

    // Pure letter token — try as element symbol(s)
    if (/^[a-z]+$/.test(token)) {
      // Direct dictation lookup first (handles "oh"→O, "see"→C, etc.)
      const directSymbol = DICTATION_TO_SYMBOL[token];
      if (directSymbol) {
        formulaParts.push(directSymbol);
        continue;
      }
      // Try greedy element-sequence parse (handles typed "po"→P,O  "clo"→Cl,O)
      const elements = parseElementSequence(token);
      if (elements) {
        formulaParts.push(...elements);
        continue;
      }
      // Unrecognized — skip (likely filler from dictation)
      continue;
    }

    // Digit token
    const asDigit = parseInt(token, 10);
    if (!isNaN(asDigit) && asDigit >= 0 && asDigit <= 9) {
      // Peek ahead: if next token is a sign word, this digit starts the charge
      const nextToken = tokens[i + 1];
      if (
        nextToken &&
        (SIGN_WORDS_POSITIVE.has(nextToken) ||
          SIGN_WORDS_NEGATIVE.has(nextToken))
      ) {
        inCharge = true;
        chargeTokens.push(token);
        continue;
      }
      // Otherwise treat as subscript
      formulaParts.push(String(asDigit));
      continue;
    }
  }

  const parsedFormula = formulaParts.join('');
  const chargeTranscript = chargeTokens.join(' ');
  const parsedCharge = chargeTranscript
    ? parseChargeAnswer(chargeTranscript)
    : null;

  if (parsedFormula !== expectedFormula) return false;
  if (parsedCharge === null || parsedCharge !== expectedCharge) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Ion name grading (for variable-charge ions: show symbol → answer name)
// ---------------------------------------------------------------------------

const ROMAN_TO_ARABIC: Record<string, string> = {
  i: '1',
  ii: '2',
  iii: '3',
  iv: '4',
  v: '5',
};

/**
 * Normalize an ion name for comparison, converting Roman numerals to Arabic.
 * "Iron (II) ion" → "iron 2 ion"
 * "Copper (I) ion" → "copper 1 ion"
 */
function normalizeIonName(name: string): string {
  let result = normalize(name);
  // After normalize(), parentheses are stripped, so "(II)" becomes "ii" as standalone token
  result = result.replace(
    /\b(i{1,3}|iv|v)\b/g,
    (match) => ROMAN_TO_ARABIC[match] ?? match,
  );
  return result;
}

/**
 * Grade a user's spoken name answer for a variable-charge ion.
 * Accepts: "iron 2", "iron two", "iron 2 ion", "Iron (II) ion", etc.
 */
export function gradeIonNameAnswer(
  answer: string,
  ion: { name: string; aliases?: string[] },
): GradeResult {
  const normalizedAnswer = normalize(answer);
  const normalizedExpected = normalizeIonName(ion.name);

  // Exact match
  if (normalizedAnswer === normalizedExpected) return { correct: true };

  // Match without "ion" suffix (user might say "iron 2" instead of "iron 2 ion")
  const expectedBase = normalizedExpected.replace(/\s*ion$/, '');
  const answerBase = normalizedAnswer.replace(/\s*ion$/, '');
  if (answerBase === expectedBase) return { correct: true };

  // Check aliases
  for (const alias of ion.aliases ?? []) {
    const normalizedAlias = normalizeIonName(alias);
    if (normalizedAnswer === normalizedAlias) return { correct: true };
    if (answerBase === normalizedAlias.replace(/\s*ion$/, ''))
      return { correct: true };
  }

  // Levenshtein tolerance ≤ 2 against the base name (absorb dictation slips)
  if (answerBase.length > 0 && levenshtein(answerBase, expectedBase) <= 2) {
    return {
      correct: true,
      feedback: `Accepted — close match for "${ion.name}."`,
    };
  }

  return { correct: false, feedback: `The correct answer is ${ion.name}.` };
}
