'use client';

import { useState, useCallback } from 'react';
import QuizSetup from '@/components/QuizSetup';
import type { QuizConfig } from '@/components/QuizSetup';
import QuizShell from '@/components/QuizShell';
import {
  generateElementQuestions,
  generateIonChargeQuestions,
  generateIonNameQuestions,
  generateIonFormulaQuestions,
} from '@/lib/questions';
import type { Question, AssessmentMode } from '@/lib/questions';

type View =
  | { screen: 'home' }
  | { screen: 'setup'; quizType: 'element' | 'ion' }
  | { screen: 'quiz'; questions: Question[]; mode: AssessmentMode; voiceMode: boolean; title: string };

export default function Home() {
  const [view, setView] = useState<View>({ screen: 'home' });

  const handleQuizStart = useCallback(
    (quizType: 'element' | 'ion', config: QuizConfig) => {
      let questions: Question[] = [];
      let title = '';

      if (quizType === 'element') {
        questions = generateElementQuestions();
        title = 'Element Quiz';
      } else {
        const cats = config.ionCategories ?? {
          cations: true,
          monoatomicAnions: true,
          polyatomicAnions: false,
        };
        const chargeQs = generateIonChargeQuestions({
          cations: cats.cations,
          monoatomicAnions: cats.monoatomicAnions,
        });
        // Variable-charge cations get name-from-symbol questions
        const nameQs = cats.cations ? generateIonNameQuestions() : [];
        const formulaQs = cats.polyatomicAnions
          ? generateIonFormulaQuestions()
          : [];
        questions = [...chargeQs, ...nameQs, ...formulaQs];
        // Shuffle the combined set
        for (let i = questions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [questions[i], questions[j]] = [questions[j], questions[i]];
        }
        title = 'Ion Quiz';
      }

      // Apply question limit (questions are already shuffled)
      if (config.questionLimit !== null && config.questionLimit < questions.length) {
        questions = questions.slice(0, config.questionLimit);
      }

      setView({ screen: 'quiz', questions, mode: config.mode, voiceMode: config.voiceMode, title });
    },
    [],
  );

  if (view.screen === 'setup') {
    return (
      <div className="max-w-lg mx-auto p-4">
        <QuizSetup
          quizType={view.quizType}
          onStart={(config) => handleQuizStart(view.quizType, config)}
          onBack={() => setView({ screen: 'home' })}
        />
      </div>
    );
  }

  if (view.screen === 'quiz') {
    return (
      <div className="max-w-lg mx-auto p-4">
        <QuizShell
          questions={view.questions}
          mode={view.mode}
          voiceMode={view.voiceMode}
          quizTitle={view.title}
          onExit={() => setView({ screen: 'home' })}
        />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 flex flex-col items-center justify-center min-h-dvh">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-chem-text">
          <span className="mr-2" aria-hidden="true">&#x2697;&#xFE0F;</span>
          ChemAssistant
        </h1>
        <p className="text-chem-text-muted mt-1">Voice-Answer Chemistry Quiz</p>
      </div>

      {/* Quiz Cards */}
      <div className="w-full space-y-4">
        {/* Element Quiz */}
        <button
          type="button"
          onClick={() => setView({ screen: 'setup', quizType: 'element' })}
          className="w-full text-left rounded-2xl border border-chem-border bg-chem-surface p-5
                     shadow-sm hover:shadow-md transition-shadow active:scale-[0.98] transition-transform"
        >
          <div className="flex items-start gap-4">
            <span className="text-4xl" aria-hidden="true">&#x1F9EA;</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-chem-text">Element Quiz</h2>
                <span className="shrink-0 rounded-full bg-chem-primary/15 px-2.5 py-0.5 text-xs font-medium text-chem-primary">
                  20 elements
                </span>
              </div>
              <p className="text-sm text-chem-text-muted mt-1">
                Identify elements by their symbol or atomic number
              </p>
            </div>
          </div>
        </button>

        {/* Ion Quiz */}
        <button
          type="button"
          onClick={() => setView({ screen: 'setup', quizType: 'ion' })}
          className="w-full text-left rounded-2xl border border-chem-border bg-chem-surface p-5
                     shadow-sm hover:shadow-md transition-shadow active:scale-[0.98] transition-transform"
        >
          <div className="flex items-start gap-4">
            <span className="text-4xl" aria-hidden="true">&#x26A1;</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-chem-text">Ion Quiz</h2>
                <span className="shrink-0 rounded-full bg-chem-primary/15 px-2.5 py-0.5 text-xs font-medium text-chem-primary">
                  70+ ions
                </span>
              </div>
              <p className="text-sm text-chem-text-muted mt-1">
                Identify ion charges and formulas
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Footer */}
      <p className="text-xs text-chem-text-muted mt-10 text-center">
        Speak your answers using your keyboard&apos;s dictation mic{' '}
        <span aria-hidden="true">&#x1F399;&#xFE0F;</span>
      </p>
    </div>
  );
}
