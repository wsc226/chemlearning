'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook wrapping the Web Speech API (SpeechRecognition).
 *
 * - `continuous: false` — stops after one utterance (student answers, then silence).
 * - `interimResults: true` — shows real-time transcript while speaking.
 * - Falls back gracefully when the API is unavailable or blocked (e.g. non-HTTPS).
 *
 * Requires HTTPS (or localhost) on most browsers. Over plain HTTP the API
 * constructor exists but start() fails — the `error` field exposes this so
 * callers can skip the mic button on subsequent questions.
 *
 * iOS Safari mic release:
 * iOS Safari only releases the microphone (orange dot) when `onend` fires
 * through the browser's internal cleanup path. We must:
 *   1. Use `stop()` (not `abort()`) for graceful shutdown
 *   2. NEVER null `onend` before stopping — the browser needs it
 *   3. Guard callbacks with an instance identity check so stale sessions
 *      don't corrupt state after a new session starts
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
   * Gracefully stop the current SR session.
   * Uses stop() so iOS Safari can complete its mic-release lifecycle.
   * Nulls the ref first so stale onend/onerror callbacks become no-ops.
   * NEVER nulls onend — the browser must fire it to release the mic.
   */
  const stopSession = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;

    // Null the ref FIRST — any callbacks that fire after this point
    // will see recognitionRef.current !== rec and become no-ops
    recognitionRef.current = null;

    // Remove data handlers but KEEP onend — iOS Safari needs it to
    // fire through the browser's internal mic-release path
    rec.onresult = null;
    rec.onerror = null;

    // Graceful stop — lets the browser complete its lifecycle
    try {
      rec.stop();
    } catch {
      // Already stopped or never started — force abort as fallback
      try { rec.abort(); } catch { /* ignore */ }
    }
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

    // Only update state if this is still the active instance —
    // prevents stale sessions from corrupting state
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        setIsListening(false);
      }
      // Even if this is a stale instance, the browser fires onend
      // to complete its mic-release cycle. Don't interfere.
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

  // Cleanup on unmount — stop gracefully so the browser releases the mic
  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        recognitionRef.current = null;
        // Keep onend alive — iOS Safari needs it for mic release
        rec.onresult = null;
        rec.onerror = null;
        try { rec.stop(); } catch {
          try { rec.abort(); } catch { /* ignore */ }
        }
      }
    };
  }, []);

  return { isSupported, isListening, transcript, error, start, stop, reset };
}
