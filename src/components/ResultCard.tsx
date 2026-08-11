'use client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResultCardProps {
  correct: boolean;
  userAnswer: string;
  correctDisplay: string;
  feedback?: string;
  funFact?: string;
  onNext: () => void;
  isLast: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ResultCard({
  correct,
  userAnswer,
  correctDisplay,
  feedback,
  funFact,
  onNext,
  isLast,
}: ResultCardProps) {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Result icon and status */}
      <div className="bg-[var(--color-chem-surface)] rounded-xl border border-[var(--color-chem-border)] p-6 mb-4">
        <div className="flex flex-col items-center text-center mb-4">
          {/* Large icon */}
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-3 ${
              correct
                ? 'bg-[var(--color-chem-correct)]/10 text-[var(--color-chem-correct)]'
                : 'bg-[var(--color-chem-incorrect)]/10 text-[var(--color-chem-incorrect)]'
            }`}
          >
            {correct ? '✓' : '✗'}
          </div>

          {/* Status text */}
          <h2
            className={`text-xl font-bold ${
              correct
                ? 'text-[var(--color-chem-correct)]'
                : 'text-[var(--color-chem-incorrect)]'
            }`}
          >
            {correct ? 'Correct!' : 'Incorrect'}
          </h2>
        </div>

        {/* Answer comparison (shown when incorrect) */}
        {!correct && (
          <div className="space-y-2 mt-4">
            <div className="flex items-start gap-2 text-sm">
              <span className="font-medium text-[var(--color-chem-text-muted)] shrink-0">
                Your answer:
              </span>
              <span className="text-[var(--color-chem-incorrect)] font-medium">
                {userAnswer}
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="font-medium text-[var(--color-chem-text-muted)] shrink-0">
                Correct answer:
              </span>
              <span className="text-[var(--color-chem-correct)] font-medium">
                {correctDisplay}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Feedback (convention tip, etc.) */}
      {feedback && (
        <div className="rounded-xl border border-[var(--color-chem-border)] bg-[var(--color-chem-surface)] p-4 mb-4">
          <p className="text-sm text-[var(--color-chem-text-muted)] leading-relaxed">
            {feedback}
          </p>
        </div>
      )}

      {/* Fun fact */}
      {funFact && (
        <div className="rounded-xl border border-[var(--color-chem-border)] bg-[var(--color-chem-bg)] p-4 mb-4">
          <div className="flex items-start gap-2">
            <span className="text-lg shrink-0" aria-hidden="true">
              &#x1F4A1;
            </span>
            <p className="text-sm text-[var(--color-chem-text)] leading-relaxed">
              {funFact}
            </p>
          </div>
        </div>
      )}

      {/* Next button */}
      <button
        type="button"
        onClick={onNext}
        className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-[var(--color-chem-primary)] hover:bg-[var(--color-chem-primary-dark)] transition-colors"
      >
        {isLast ? 'See Results' : 'Next Question'}
      </button>
    </div>
  );
}
