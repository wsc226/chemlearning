'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook wrapping the Web Speech API (SpeechRecognition).
 *
 * iOS Safari/Chrome mic-release strategy:
 *   1. Call BOTH stop() AND abort() — iOS Chrome may need abort()
 *   2. Keep onend as self-cleaning handler so WebKit fires its internal teardown
 *   3. getUserMedia({ audio }) → track.stop() as secondary release — gives iOS
 *      a managed audio track it can properly close
 *   4. visibilitychange listener: when user switches apps, force-release the mic
 *      (iOS reliably tears down audio sessions during app-switch)
 *   5. pagehide/beforeunload: force-release on page reload/navigation
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
 * Force-release mic hardware via getUserMedia → track.stop().
 *
 * This gives iOS a managed audio track that it can properly close — without
 * this, iOS keeps the SpeechRecognition audio session alive even after
 * stop()/abort() because WebKit doesn't fully release it from JS.
 */
function forceReleaseMic() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return;
  }
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      stream.getTracks().forEach((track) => {
        track.enabled = false;
        track.stop();
      });
    })
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
   * Kill the current SR instance and release mic.
   * Calls BOTH stop() and abort() — iOS Chrome may ignore stop() but honor abort().
   */
  const stopSession = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;

    recognitionRef.current = null;
    rec.onresult = null;
    rec.onerror = null;

    // Self-cleaning onend: lets WebKit fire it for internal teardown
    rec.onend = () => {
      rec.onend = null;
    };

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

  // Cleanup: unmount + page hide + app switch
  useEffect(() => {
    /** Hard-kill SR and force-release mic — for page/app lifecycle events */
    const fullRelease = () => {
      const rec = recognitionRef.current;
      if (rec) {
        recognitionRef.current = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        try { rec.abort(); } catch { /* ignore */ }
      }
      if (usedSRRef.current) {
        forceReleaseMic();
      }
    };

    /**
     * visibilitychange: fires when user switches apps on iOS.
     * Force-release the mic so iOS can tear down the audio session
     * while Chrome is in the background.
     */
    const handleVisibilityChange = () => {
      if (document.hidden && usedSRRef.current) {
        fullRelease();
      }
    };

    window.addEventListener('pagehide', fullRelease);
    window.addEventListener('beforeunload', fullRelease);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', fullRelease);
      window.removeEventListener('beforeunload', fullRelease);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      // Component unmount: stop + abort + forceReleaseMic
      const rec = recognitionRef.current;
      if (rec) {
        recognitionRef.current = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = () => { rec.onend = null; };
        try { rec.stop(); } catch { /* ignore */ }
        try { rec.abort(); } catch { /* ignore */ }
      }
      if (usedSRRef.current) {
        forceReleaseMic();
      }
    };
  }, []);

  return { isSupported, isListening, transcript, error, start, stop, reset };
}
