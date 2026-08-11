/**
 * Text normalization pipeline for voice-transcribed chemistry answers.
 *
 * Order of operations (per ARCHITECTURE.md):
 *   1. Lowercase
 *   2. Trim
 *   3. Strip punctuation (preserve hyphens for compound names)
 *   4. Collapse whitespace
 *   5. Substitute spoken number words with digit strings
 */

const NUMBER_WORDS: Record<string, string> = {
  zero: '0',
  one: '1',
  won: '1',    // SR mishearing
  two: '2',
  to: '2',     // SR mishearing
  too: '2',    // SR mishearing
  three: '3',
  four: '4',
  for: '4',    // SR mishearing
  fore: '4',   // SR mishearing
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20',
};

/**
 * Maps a single spoken number word ("one" through "twenty") to its digit string.
 * Returns null if the word is not a recognized number word.
 */
export function wordToDigit(word: string): string | null {
  return NUMBER_WORDS[word.toLowerCase()] ?? null;
}

/**
 * Replaces all recognized number words in a text string with their digit equivalents.
 * Operates on whole-word boundaries to avoid corrupting words that contain number substrings
 * (e.g. "nitrogen" should not be mangled).
 */
export function normalizeNumberWords(text: string): string {
  return text.replace(/\b[a-z]+\b/g, (match) => {
    const digit = wordToDigit(match);
    return digit !== null ? digit : match;
  });
}

/**
 * Full normalization pipeline:
 *   lowercase -> trim -> strip punctuation (keep hyphens) -> collapse whitespace -> number word substitution
 */
export function normalize(text: string): string {
  let result = text.toLowerCase().trim();

  // Strip punctuation except hyphens. Keep letters, digits, whitespace, and hyphens.
  result = result.replace(/[^a-z0-9\s-]/g, '');

  // Collapse runs of whitespace into a single space.
  result = result.replace(/\s+/g, ' ').trim();

  // Substitute spoken number words with digits.
  result = normalizeNumberWords(result);

  return result;
}
