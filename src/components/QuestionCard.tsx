'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Question } from '@/lib/questions';
import { speak } from '@/lib/speech';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  voiceMode: boolean;
  onSubmit: (answer: string) => void;
  disabled?: boolean;
}

type VoiceState = 'mic' | 'listening' | 'input';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  voiceMode,
  onSubmit,
  disabled = false,
}: QuestionCardProps) {
  const [answer, setAnswer] = useState('');
  const [voiceState, setVoiceState] = useState<VoiceState>(
    voiceMode ? 'mic' : 'input',
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const submittedRef = useRef(false);

  const sr = useSpeechRecognition();
  const srRef = useRef(sr);
  srRef.current = sr;

  // Track whether SR has ever actually worked (produced a transcript)
  // null = untried, true = works, false = failed
  const srStatusRef = useRef<boolean | null>(null);

  const progressPercent = (questionNumber / totalQuestions) * 100;

  // -------------------------------------------
  // Track SR success / failure across questions
  // -------------------------------------------
  useEffect(() => {
    if (sr.transcript) {
      srStatusRef.current = true; // SR produced a result — it works
    }
  }, [sr.transcript]);

  useEffect(() => {
    if (sr.error) {
      srStatusRef.current = false; // SR errored — don't try again
    }
  }, [sr.error]);

  // -------------------------------------------
  // Reset state when question changes
  // -------------------------------------------
  useEffect(() => {
    setAnswer('');
    submittedRef.current = false;

    if (!voiceMode) {
      setVoiceState('input');
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }

    // SR has worked before → auto-start listening
    if (srStatusRef.current === true) {
      const timer = setTimeout(() => {
        const started = srRef.current.start();
        setVoiceState(started ? 'listening' : 'input');
      }, 400);
      return () => clearTimeout(timer);
    }

    // SR has failed before → skip mic button, go straight to input
    if (srStatusRef.current === false) {
      setVoiceState('input');
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }

    // First question (untried) → show mic button to try SR
    setVoiceState('mic');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, voiceMode]);

  // -------------------------------------------
  // Voice mode: auto-submit when SR finishes
  // -------------------------------------------
  useEffect(() => {
    if (!voiceMode || voiceState !== 'listening' || sr.isListening || submittedRef.current) {
      return;
    }

    if (sr.transcript) {
      // Voice captured — submit immediately, no timer
      submittedRef.current = true;
      onSubmitRef.current(sr.transcript);
    } else {
      // SR ended without capturing anything — let user retry
      setVoiceState('mic');
    }
  }, [sr.isListening, sr.transcript, voiceMode, voiceState]);

  // -------------------------------------------
  // Handlers
  // -------------------------------------------
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = answer.trim();
    if (trimmed && !disabled) {
      onSubmit(trimmed);
    }
  };

  const handleReadAloud = () => {
    speak(question.speakText);
  };

  const handleMicTap = useCallback(() => {
    if (sr.isSupported && srStatusRef.current !== false) {
      const started = sr.start();
      if (started) {
        setVoiceState('listening');
        return;
      }
    }
    // Fallback: show text input (keyboard dictation)
    setVoiceState('input');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [sr]);

  const handleCancelListening = () => {
    sr.stop();
    setVoiceState('mic');
  };

  const handleRevealInput = () => {
    setVoiceState('input');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // -------------------------------------------
  // Render
  // -------------------------------------------
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--color-chem-text-muted)]">
            Question {questionNumber} / {totalQuestions}
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[var(--color-chem-border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-chem-primary)] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="bg-[var(--color-chem-surface)] rounded-xl border border-[var(--color-chem-border)] p-6 mb-6">
        <div className="text-xs font-semibold text-[var(--color-chem-text-muted)] uppercase tracking-wide mb-2">
          {question.promptLabel}
        </div>
        <div className="text-5xl font-bold text-[var(--color-chem-text)] text-center py-6">
          {question.prompt}
        </div>
        <p className="text-sm text-[var(--color-chem-text-muted)] text-center mb-4">
          {question.instruction}
        </p>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleReadAloud}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-chem-primary)] hover:text-[var(--color-chem-primary-dark)] transition-colors px-3 py-1.5 rounded-lg hover:bg-[var(--color-chem-bg)]"
          >
            <span aria-hidden="true">&#x1F50A;</span> Read Aloud
          </button>
        </div>
      </div>

      {/* ─── Answer area ─── */}

      {/* STATE: Mic button (voice mode, first question, SR untried) */}
      {voiceMode && voiceState === 'mic' && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleMicTap}
            disabled={disabled}
            className="w-full py-8 rounded-xl border-2 border-dashed border-[var(--color-chem-primary)]/40 bg-[var(--color-chem-primary)]/5 transition-all hover:border-[var(--color-chem-primary)] hover:bg-[var(--color-chem-primary)]/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-5xl block mb-3" aria-hidden="true">
              &#x1F399;&#xFE0F;
            </span>
            <span className="text-base font-semibold text-[var(--color-chem-primary)]">
              Tap to speak your answer
            </span>
          </button>
          <button
            type="button"
            onClick={handleRevealInput}
            disabled={disabled}
            className="mt-4 text-sm text-[var(--color-chem-text-muted)] underline underline-offset-2 hover:text-[var(--color-chem-text)] transition-colors disabled:opacity-50"
          >
            Type instead
          </button>
        </div>
      )}

      {/* STATE: Listening (speech recognition active) */}
      {voiceMode && voiceState === 'listening' && (
        <div className="text-center py-4">
          <div className="relative inline-flex items-center justify-center mb-4">
            <div
              className="absolute w-24 h-24 rounded-full bg-[var(--color-chem-primary)]/20"
              style={{ animation: 'chem-pulse-ring 1.5s ease-out infinite' }}
            />
            <div
              className="absolute w-24 h-24 rounded-full bg-[var(--color-chem-primary)]/20"
              style={{
                animation: 'chem-pulse-ring 1.5s ease-out infinite',
                animationDelay: '0.5s',
              }}
            />
            <div className="relative w-20 h-20 rounded-full bg-[var(--color-chem-primary)] flex items-center justify-center shadow-lg">
              <span className="text-4xl" aria-hidden="true">
                &#x1F399;&#xFE0F;
              </span>
            </div>
          </div>

          <p className="text-lg font-semibold text-[var(--color-chem-primary)] mb-1">
            Listening&hellip;
          </p>

          {sr.transcript && (
            <p className="text-base text-[var(--color-chem-text)] mt-2 italic">
              &ldquo;{sr.transcript}&rdquo;
            </p>
          )}

          <button
            type="button"
            onClick={handleCancelListening}
            className="mt-4 text-sm text-[var(--color-chem-text-muted)] underline underline-offset-2 hover:text-[var(--color-chem-text)] transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* STATE: Text input (non-voice mode, or SR failure fallback) */}
      {voiceState === 'input' && (
        <form onSubmit={handleSubmit}>
          <div className="mb-1">
            <input
              ref={inputRef}
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={disabled}
              placeholder="Your answer..."
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              data-form-type="other"
              data-lpignore="true"
              enterKeyHint="done"
              className="w-full px-4 py-3.5 text-lg rounded-xl border border-[var(--color-chem-border)] bg-[var(--color-chem-surface)] text-[var(--color-chem-text)] placeholder:text-[var(--color-chem-text-muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-chem-primary)] focus:border-transparent disabled:opacity-50 transition-shadow"
            />
          </div>

          {/* Hint */}
          <div className="text-center mb-4">
            <p className="text-xs text-[var(--color-chem-text-muted)]">
              Tap &#x1F3A4; on your keyboard to dictate
            </p>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={disabled || !answer.trim()}
            className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-[var(--color-chem-primary)] hover:bg-[var(--color-chem-primary-dark)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Submit
          </button>
        </form>
      )}
    </div>
  );
}
