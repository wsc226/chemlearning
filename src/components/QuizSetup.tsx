'use client';

import { useState } from 'react';
import type { AssessmentMode } from '@/lib/questions';
import elementsData from '@/data/elements.json';
import ionsData from '@/data/ions.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuizConfig {
  mode: AssessmentMode;
  voiceMode: boolean;
  /** Max questions per attempt — null means all */
  questionLimit: number | null;
  ionCategories?: {
    cations: boolean;
    monoatomicAnions: boolean;
    polyatomicAnions: boolean;
  };
}

interface QuizSetupProps {
  quizType: 'element' | 'ion';
  onStart: (config: QuizConfig) => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QuizSetup({ quizType, onStart, onBack }: QuizSetupProps) {
  const [mode, setMode] = useState<AssessmentMode | null>(null);
  const [voiceMode, setVoiceMode] = useState(true);
  const [questionLimit, setQuestionLimit] = useState<number | null>(20);
  const [ionCategories, setIonCategories] = useState({
    cations: true,
    monoatomicAnions: true,
    polyatomicAnions: false,
  });

  // Compute total question count based on quiz type and selections
  // Element quiz generates 2 questions per element (symbol + atomic number)
  const questionCount =
    quizType === 'element'
      ? elementsData.elements.length * 2
      : (ionCategories.cations ? ionsData.cations.length : 0) +
        (ionCategories.monoatomicAnions ? ionsData.monoatomicAnions.length : 0) +
        (ionCategories.polyatomicAnions ? ionsData.polyatomicAnions.length : 0);

  const canStart = mode !== null && questionCount > 0;

  const handleStart = () => {
    if (!mode) return;
    const config: QuizConfig = { mode, voiceMode, questionLimit };
    if (quizType === 'ion') {
      config.ionCategories = ionCategories;
    }
    onStart(config);
  };

  const title = quizType === 'element' ? 'Element Quiz' : 'Ion Quiz';
  const description =
    quizType === 'element'
      ? 'Test your knowledge of the first 20 elements. You’ll be shown a symbol or atomic number and asked to name the element.'
      : 'Test your knowledge of common ions. You’ll be shown an ion name and asked for its charge or formula.';

  const toggleCategory = (key: keyof typeof ionCategories) => {
    setIonCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="mb-4 text-sm font-medium text-[var(--color-chem-text-muted)] hover:text-[var(--color-chem-text)] transition-colors"
      >
        ← Back
      </button>

      {/* Quiz title and description */}
      <div className="bg-[var(--color-chem-surface)] rounded-xl border border-[var(--color-chem-border)] p-6 mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-chem-text)] mb-2">
          {title}
        </h1>
        <p className="text-sm text-[var(--color-chem-text-muted)] leading-relaxed">
          {description}
        </p>
      </div>

      {/* Assessment mode selector */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-[var(--color-chem-text-muted)] uppercase tracking-wide mb-3">
          Assessment Mode
        </h2>
        <div className="grid grid-cols-1 gap-3">
          {/* Immediate Feedback card */}
          <button
            type="button"
            onClick={() => setMode('immediate')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              mode === 'immediate'
                ? 'border-[var(--color-chem-primary)] bg-[var(--color-chem-bg)] shadow-md'
                : 'border-[var(--color-chem-border)] bg-[var(--color-chem-surface)]'
            }`}
          >
            <div className="font-semibold text-[var(--color-chem-text)]">
              Immediate Feedback
            </div>
            <div className="text-sm text-[var(--color-chem-text-muted)] mt-1">
              See results after each question
            </div>
          </button>

          {/* Summary card */}
          <button
            type="button"
            onClick={() => setMode('summary')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              mode === 'summary'
                ? 'border-[var(--color-chem-primary)] bg-[var(--color-chem-bg)] shadow-md'
                : 'border-[var(--color-chem-border)] bg-[var(--color-chem-surface)]'
            }`}
          >
            <div className="font-semibold text-[var(--color-chem-text)]">
              Summary
            </div>
            <div className="text-sm text-[var(--color-chem-text-muted)] mt-1">
              See all results at the end
            </div>
          </button>
        </div>
      </div>

      {/* Voice Mode toggle */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-[var(--color-chem-text-muted)] uppercase tracking-wide mb-3">
          Input Mode
        </h2>
        <div className="bg-[var(--color-chem-surface)] rounded-xl border border-[var(--color-chem-border)] p-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex-1 min-w-0 mr-4">
              <div className="flex items-center gap-2">
                <span className="text-lg" aria-hidden="true">&#x1F399;&#xFE0F;</span>
                <span className="font-medium text-[var(--color-chem-text)]">
                  Voice Mode
                </span>
              </div>
              <p className="text-xs text-[var(--color-chem-text-muted)] mt-1 leading-relaxed">
                Encourages speaking answers aloud using your keyboard&apos;s dictation.
                A &ldquo;Type instead&rdquo; fallback is always available.
              </p>
            </div>
            {/* Toggle switch */}
            <button
              type="button"
              role="switch"
              aria-checked={voiceMode}
              onClick={() => setVoiceMode((v) => !v)}
              className={`relative shrink-0 inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${
                voiceMode
                  ? 'bg-[var(--color-chem-primary)]'
                  : 'bg-[var(--color-chem-border)]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  voiceMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Questions per attempt */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-[var(--color-chem-text-muted)] uppercase tracking-wide mb-3">
          Questions Per Attempt
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {[10, 20, 30, null].map((limit) => {
            const label = limit === null ? 'All' : String(limit);
            const isSelected = questionLimit === limit;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setQuestionLimit(limit)}
                className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isSelected
                    ? 'bg-[var(--color-chem-primary)] text-white shadow-md'
                    : 'bg-[var(--color-chem-surface)] border border-[var(--color-chem-border)] text-[var(--color-chem-text)] hover:border-[var(--color-chem-primary)]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--color-chem-text-muted)] mt-2 text-center">
          {questionLimit === null
            ? `All ${questionCount} questions`
            : questionLimit >= questionCount
              ? `All ${questionCount} questions (fewer than ${questionLimit})`
              : `${questionLimit} of ${questionCount} questions (random)`}
        </p>
      </div>

      {/* Ion category checkboxes (ion quiz only) */}
      {quizType === 'ion' && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-[var(--color-chem-text-muted)] uppercase tracking-wide mb-3">
            Ion Categories
          </h2>
          <div className="bg-[var(--color-chem-surface)] rounded-xl border border-[var(--color-chem-border)] divide-y divide-[var(--color-chem-border)]">
            {/* Cations */}
            <label className="flex items-center gap-3 p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={ionCategories.cations}
                onChange={() => toggleCategory('cations')}
                className="w-5 h-5 shrink-0 rounded accent-[var(--color-chem-primary)]"
              />
              <div>
                <span className="font-medium text-[var(--color-chem-text)]">
                  Cations
                </span>
                <span className="text-sm text-[var(--color-chem-text-muted)] ml-2">
                  ({ionsData.cations.length})
                </span>
              </div>
            </label>

            {/* Monoatomic Anions */}
            <label className="flex items-center gap-3 p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={ionCategories.monoatomicAnions}
                onChange={() => toggleCategory('monoatomicAnions')}
                className="w-5 h-5 shrink-0 rounded accent-[var(--color-chem-primary)]"
              />
              <div>
                <span className="font-medium text-[var(--color-chem-text)]">
                  Monoatomic Anions
                </span>
                <span className="text-sm text-[var(--color-chem-text-muted)] ml-2">
                  ({ionsData.monoatomicAnions.length})
                </span>
              </div>
            </label>

            {/* Polyatomic Anions */}
            <label className="flex items-start gap-3 p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={ionCategories.polyatomicAnions}
                onChange={() => toggleCategory('polyatomicAnions')}
                className="w-5 h-5 shrink-0 rounded mt-0.5 accent-[var(--color-chem-primary)]"
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[var(--color-chem-text)]">
                    Polyatomic Anions
                  </span>
                  <span className="text-sm text-[var(--color-chem-text-muted)]">
                    ({ionsData.polyatomicAnions.length})
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-chem-experimental)]/15 text-[var(--color-chem-experimental)]">
                    &#x26A0;&#xFE0F; Experimental
                  </span>
                </div>
                <p className="text-xs text-[var(--color-chem-text-muted)] mt-1.5 leading-relaxed">
                  Formula dictation accuracy is unverified &mdash; test with your
                  device before relying on these questions.
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Start button */}
      <div className="text-center">
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-[var(--color-chem-primary)] hover:bg-[var(--color-chem-primary-dark)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Start Quiz
        </button>
      </div>
    </div>
  );
}
