'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook wrapping the Web Speech API (SpeechRecognition).
 *
 * iOS Safari/Chrome mic-release strategy (revised):
 *   1. Call BOTH stop() AND abort() — iOS Chrome may need abort() specifically
 *   2. Keep onend alive (self-cleaning handler) so WebKit can fire its internal
 *      cleanup — nulling onend before WebKit fires it can leave the audio
 *      session dangling
 *   3. Do NOT call getUserMedia as a "nuclear" fallback — on iOS this REOPENS
 *      the mic, creating a new audio session that keeps the indicator alive
 *   4. Add pagehide listener — catches page reloads and tab switches on iOS,
 *      where beforeunload is unreliable
 */

// The SpeechRecognition API may not be in the TS DOM lib depending on config.
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; [j: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

function getRecognitionClass(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  /** Non-null when SR failed — contains the error code (e.g. "not-allowed") */
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // SSR-safe feature detection on mount
  useEffect(() => {
    setIsSupported(getRecognitionClass() !== null);
  }, []);

  /**
   * Kill the current SR instance and release mic.
   *
   * - Nulls the ref so stale callbacks become no-ops
   * - Keeps onend as a self-cleaning handler (WebKit must fire it to
   *   release its internal audio session)
   * - Calls BOTH stop() and abort() — stop() for graceful shutdown,
   *   abort() as the aggressive follow-up iOS Chrome may need
   */
  const stopSession = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;

    recognitionRef.current = null;
    rec.onresult = null;
    rec.onerror = null;

    // Self-cleaning onend: lets WebKit fire it for its audio-session
    // teardown, then the handler nulls itself to break refs for GC
    rec.onend = () => {
      rec.onend = null;
    };

    // Always call both — iOS Chrome may ignore stop() but honor abort()
    try { rec.stop(); } catch { /* ignore */ }
    try { rec.abort(); } catch { /* ignore */ }
  }, []);

  const start = useCallback((): boolean => {
    const Cls = getRecognitionClass();
    if (!Cls) return false;

    // Stop any existing session first
    stopSession();

    const recognition = new Cls();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript(final || interim);
    };

    // Only update state if this is still the active instance
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        setIsListening(false);
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'aborted' && recognitionRef.current === recognition) {
        setIsListening(false);
        setError(event.error);
      }
    };

    recognitionRef.current = recognition;
    setTranscript('');
    setError(null);
    setIsListening(true);

    try {
      recognition.start();
      return true;
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setError('start-failed');
      return false;
    }
  }, [stopSession]);

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  const reset = useCallback(() => {
    stopSession();
    setTranscript('');
    setIsListening(false);
  }, [stopSession]);

  // Cleanup: component unmount + page hide/unload
  useEffect(() => {
    /**
     * Aggressively kill SR — used on pagehide (page reload, tab close,
     * navigation) where we need to release the mic immediately.
     * On iOS, pagehide is more reliable than beforeunload.
     */
    const killSR = () => {
      const rec = recognitionRef.current;
      if (!rec) return;
      recognitionRef.current = null;
      // On pagehide/unload, null everything — no point in self-cleaning
      // handlers when the page is being destroyed
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try { rec.abort(); } catch { /* ignore */ }
    };

    window.addEventListener('pagehide', killSR);
    window.addEventListener('beforeunload', killSR);

    return () => {
      window.removeEventListener('pagehide', killSR);
      window.removeEventListener('beforeunload', killSR);

      // Component unmount cleanup
      const rec = recognitionRef.current;
      if (rec) {
        recognitionRef.current = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = () => { rec.onend = null; };
        try { rec.stop(); } catch { /* ignore */ }
        try { rec.abort(); } catch { /* ignore */ }
      }
      // NOT calling getUserMedia here — on iOS it re-opens the mic,
      // creating a new audio session that keeps the indicator alive.
    };
  }, []);

  return { isSupported, isListening, transcript, error, start, stop, reset };
}
