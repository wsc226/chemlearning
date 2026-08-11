'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook wrapping the Web Speech API (SpeechRecognition).
 *
 * iOS Safari mic-release strategy:
 *   1. Use stop() (not abort()) — graceful shutdown
 *   2. Set onend to a self-cleaning handler so the browser can fire it,
 *      then the handler nulls itself to break the reference cycle for GC
 *   3. On unmount: getUserMedia({ audio }) → track.stop() as nuclear fallback —
 *      this directly releases the mic hardware even if SR cleanup failed
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

/**
 * Nuclear mic release: request mic via getUserMedia and immediately stop
 * all tracks. This forces iOS Safari to release the mic hardware even if
 * SpeechRecognition's own cleanup didn't.
 */
function forceReleaseMic() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return;
  }
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => stream.getTracks().forEach((track) => track.stop()))
    .catch(() => {});
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  /** Non-null when SR failed — contains the error code (e.g. "not-allowed") */
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  /** Track whether SR was ever used, so we only force-release mic when needed */
  const usedSRRef = useRef(false);

  // SSR-safe feature detection on mount
  useEffect(() => {
    setIsSupported(getRecognitionClass() !== null);
  }, []);

  /**
   * Gracefully stop the current SR session and release mic.
   *
   * - Nulls the ref first so stale callbacks become no-ops
   * - Sets onend to a self-cleaning handler: lets the browser fire it for
   *   its internal cleanup, then the handler nulls itself to break the
   *   reference cycle and allow GC of the instance
   * - Uses stop() for graceful shutdown; abort() only as fallback
   */
  const stopSession = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;

    recognitionRef.current = null;
    rec.onresult = null;
    rec.onerror = null;

    // Self-cleaning onend: lets browser fire it, then breaks all refs
    rec.onend = () => {
      rec.onend = null;
    };

    try {
      rec.stop();
    } catch {
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
    usedSRRef.current = true;
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

  // Cleanup on unmount — stop SR and force-release mic hardware
  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        recognitionRef.current = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = () => { rec.onend = null; };
        try { rec.stop(); } catch {
          try { rec.abort(); } catch { /* ignore */ }
        }
      }

      // Nuclear fallback: force-release mic via getUserMedia → track.stop()
      // Only if we actually used SpeechRecognition during this component's lifetime
      if (usedSRRef.current) {
        forceReleaseMic();
      }
    };
  }, []);

  return { isSupported, isListening, transcript, error, start, stop, reset };
}
