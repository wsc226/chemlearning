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

  const start = useCallback((): boolean => {
    const Cls = getRecognitionClass();
    if (!Cls) return false;

    // Abort any existing session
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

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

    recognition.onend = () => setIsListening(false);

    recognition.onerror = (event) => {
      // 'aborted' is intentional (we called .abort()), don't treat as error
      if (event.error !== 'aborted') {
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
      setIsListening(false);
      setError('start-failed');
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    setTranscript('');
    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return { isSupported, isListening, transcript, error, start, stop, reset };
}
