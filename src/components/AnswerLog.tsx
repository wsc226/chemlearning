'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getLog,
  clearLog,
  exportJSON,
  exportCSV,
  formatWrongAnswers,
  type LogEntry,
} from '@/lib/quizLog';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnswerLog() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showWrong, setShowWrong] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load log on mount
  useEffect(() => {
    setLog(getLog());
  }, []);

  const wrongAnswers = log.filter((e) => !e.correct);

  // -------------------------------------------------------
  // Export: share on mobile, download on desktop
  // -------------------------------------------------------
  const handleExport = useCallback(
    async (format: 'json' | 'csv') => {
      const content = format === 'json' ? exportJSON() : exportCSV();
      const mime =
        format === 'json' ? 'application/json' : 'text/csv';
      const blob = new Blob([content], { type: mime });
      const file = new File([blob], `chemassistant-log.${format}`, {
        type: mime,
      });

      // Try native share (iOS/Android) for JSON
      if (
        format === 'json' &&
        typeof navigator !== 'undefined' &&
        navigator.share &&
        navigator.canShare?.({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: 'ChemAssistant Answer Log',
          });
          return;
        } catch {
          // User cancelled — fall through to download
        }
      }

      // Fallback: trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    [],
  );

  // -------------------------------------------------------
  // Copy wrong answers to clipboard (for pasting into chat)
  // -------------------------------------------------------
  const handleCopyWrong = useCallback(async () => {
    const text = formatWrongAnswers();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — fall back to prompt
      prompt('Copy this text:', text);
    }
  }, []);

  // -------------------------------------------------------
  // Clear log
  // -------------------------------------------------------
  const handleClear = useCallback(() => {
    if (confirm('Clear all logged answers? This cannot be undone.')) {
      clearLog();
      setLog([]);
    }
  }, []);

  // Don't render if no log entries
  if (log.length === 0) return null;

  const oldest = log[0]?.ts;
  const dateStr = oldest
    ? `Since ${new Date(oldest).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : '';

  return (
    <div className="w-full mt-4">
      <div className="rounded-2xl border border-chem-border bg-chem-surface p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden="true">
            &#x1F4CB;
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-chem-text">
              Answer Log
            </h2>
            <p className="text-sm text-chem-text-muted mt-0.5">
              {log.length} answer{log.length !== 1 ? 's' : ''} &middot;{' '}
              {wrongAnswers.length} wrong &middot; {dateStr}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={() => handleExport('json')}
            className="flex-1 min-w-[80px] py-2 px-3 rounded-lg text-sm font-medium
                       bg-[var(--color-chem-primary)] text-white
                       hover:bg-[var(--color-chem-primary-dark)] transition-colors"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="flex-1 min-w-[80px] py-2 px-3 rounded-lg text-sm font-medium
                       bg-chem-surface border border-chem-border text-chem-text
                       hover:border-[var(--color-chem-primary)] transition-colors"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="py-2 px-3 rounded-lg text-sm font-medium
                       text-red-500 hover:bg-red-50 transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Wrong answers section */}
        {wrongAnswers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-chem-border">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowWrong(!showWrong)}
                className="text-sm font-medium text-[var(--color-chem-primary)]"
              >
                {showWrong ? '▾ Hide' : '▸ Show'} wrong answers (
                {wrongAnswers.length})
              </button>
              <button
                type="button"
                onClick={handleCopyWrong}
                className="text-xs font-medium px-2.5 py-1 rounded-md
                           bg-chem-surface border border-chem-border text-chem-text-muted
                           hover:border-[var(--color-chem-primary)] transition-colors"
              >
                {copied ? '✓ Copied!' : '📋 Copy wrong'}
              </button>
            </div>

            {showWrong && (
              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                {wrongAnswers
                  .slice(-30)
                  .reverse()
                  .map((e, i) => (
                    <div
                      key={i}
                      className="text-xs rounded-lg p-2.5 border
                                 bg-red-50 border-red-200 text-chem-text
                                 dark:bg-red-900/10 dark:border-red-800/30"
                    >
                      <div className="font-medium">
                        {e.voice ? '🎤' : '⌨️'} {e.prompt}
                        <span className="ml-1.5 font-normal text-chem-text-muted">
                          [{e.type}]
                        </span>
                      </div>
                      <div className="mt-0.5 text-chem-text-muted">
                        Said:{' '}
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {e.answer}
                        </span>
                        {' → '}
                        Expected:{' '}
                        <span className="text-green-700 dark:text-green-400 font-medium">
                          {e.expected}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
