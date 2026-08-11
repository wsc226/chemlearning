'use client';

import { useState, useCallback } from 'react';
import type { Question, AssessmentMode } from '@/lib/questions';
import type { GradeResult } from '@/lib/grading';
import { logAnswer } from '@/lib/quizLog';
import QuestionCard from '@/components/QuestionCard';
import ResultCard from '@/components/ResultCard';
import SummaryScreen from '@/components/SummaryScreen';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuizShellProps {
  questions: Question[];
  mode: AssessmentMode;
  quizTitle: string;
  voiceMode: boolean;
  onExit: () => void;
}

interface AnswerRecord {
  question: Question;
  userAnswer: string;
  result: GradeResult;
}

type Phase = 'answering' | 'feedback' | 'summary';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QuizShell({
  questions,
  mode,
  quizTitle,
  voiceMode,
  onExit,
}: QuizShellProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [phase, setPhase] = useState<Phase>('answering');

  // The record for the question just answered (used by ResultCard in immediate mode)
  const latestAnswer = answers[answers.length - 1] as AnswerRecord | undefined;

  const isLastQuestion = currentIndex >= questions.length - 1;

  // -------------------------------------------
  // Submit an answer
  // -------------------------------------------
  const handleSubmit = useCallback(
    (answer: string) => {
      const question = questions[currentIndex];
      const result = question.grade(answer);
      const record: AnswerRecord = { question, userAnswer: answer, result };

      // Persist to answer log (localStorage) for weekly review
      logAnswer({
        ts: new Date().toISOString(),
        type: question.type,
        prompt: question.prompt,
        instruction: question.instruction,
        answer,
        correct: result.correct,
        expected: question.correctDisplay,
        feedback: result.feedback,
        voice: voiceMode,
      });

      setAnswers((prev) => [...prev, record]);

      if (mode === 'immediate') {
        // Show feedback before advancing
        setPhase('feedback');
      } else {
        // Summary mode: advance directly
        if (isLastQuestion) {
          // Need to include the current record in the state that SummaryScreen reads.
          // Since setAnswers is batched, we switch phase in the same render tick.
          setPhase('summary');
        } else {
          setCurrentIndex((prev) => prev + 1);
        }
      }
    },
    [currentIndex, isLastQuestion, mode, questions, voiceMode],
  );

  // -------------------------------------------
  // Advance after feedback (immediate mode)
  // -------------------------------------------
  const handleNext = useCallback(() => {
    if (isLastQuestion) {
      setPhase('summary');
    } else {
      setCurrentIndex((prev) => prev + 1);
      setPhase('answering');
    }
  }, [isLastQuestion]);

  // -------------------------------------------
  // Restart (from SummaryScreen)
  // -------------------------------------------
  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setAnswers([]);
    setPhase('answering');
  }, []);

  // -------------------------------------------
  // Render
  // -------------------------------------------

  // Summary screen
  if (phase === 'summary') {
    return (
      <div className="min-h-dvh bg-[var(--color-chem-bg)]">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-[var(--color-chem-surface)] border-b border-[var(--color-chem-border)]">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-base font-semibold text-[var(--color-chem-text)] truncate">
              {quizTitle}
            </h1>
            <button
              type="button"
              onClick={onExit}
              className="text-sm font-medium text-[var(--color-chem-text-muted)] hover:text-[var(--color-chem-text)] transition-colors shrink-0 ml-4"
            >
              &#x2715; Exit
            </button>
          </div>
        </header>

        <SummaryScreen
          results={answers}
          quizTitle={quizTitle}
          onRestart={handleRestart}
          onHome={onExit}
        />
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="min-h-dvh bg-[var(--color-chem-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[var(--color-chem-surface)] border-b border-[var(--color-chem-border)]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-base font-semibold text-[var(--color-chem-text)] truncate">
            {quizTitle}
          </h1>
          <button
            type="button"
            onClick={onExit}
            className="text-sm font-medium text-[var(--color-chem-text-muted)] hover:text-[var(--color-chem-text)] transition-colors shrink-0 ml-4"
          >
            &#x2715; Exit
          </button>
        </div>
      </header>

      {/* Question or feedback */}
      {phase === 'answering' && (
        <QuestionCard
          question={currentQuestion}
          questionNumber={currentIndex + 1}
          totalQuestions={questions.length}
          voiceMode={voiceMode}
          onSubmit={handleSubmit}
        />
      )}

      {phase === 'feedback' && latestAnswer && (
        <ResultCard
          correct={latestAnswer.result.correct}
          userAnswer={latestAnswer.userAnswer}
          correctDisplay={latestAnswer.question.correctDisplay}
          feedback={latestAnswer.result.feedback}
          funFact={latestAnswer.question.funFact}
          onNext={handleNext}
          isLast={isLastQuestion}
        />
      )}
    </div>
  );
}
