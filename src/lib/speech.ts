/**
 * Simple wrapper around the browser's built-in speechSynthesis API.
 *
 * Question text is optionally read aloud via speechSynthesis (free, no API cost).
 * Rate is set slightly slower (0.9) for clarity when reading element names,
 * ion formulas, and chemistry terms.
 */

/**
 * Check whether the browser supports the speechSynthesis API.
 */
export function isSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Speak the given text aloud using the browser's speechSynthesis.
 * Cancels any ongoing speech before starting.
 */
export function speak(text: string): void {
  if (!isSpeechAvailable()) return;

  // Cancel any currently-playing utterance
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;

  window.speechSynthesis.speak(utterance);
}

/**
 * Cancel any ongoing speech synthesis.
 */
export function stopSpeaking(): void {
  if (!isSpeechAvailable()) return;
  window.speechSynthesis.cancel();
}
