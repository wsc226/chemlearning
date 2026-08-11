'use client';

/**
 * Persistent answer log — stores every quiz response in localStorage.
 *
 * Used for weekly review: accumulate SR transcripts and grading results
 * across sessions, then export for analysis to add new aliases and
 * parser improvements.
 */

import type { QuestionType } from './questions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogEntry {
  /** ISO-8601 timestamp */
  ts: string;
  /** Question type (element_name, ion_charge, ion_formula_charge, ion_name) */
  type: QuestionType;
  /** What was shown to the student (e.g. "Na", "Sulfate ion") */
  prompt: string;
  /** Instruction text (e.g. "Name this element") */
  instruction: string;
  /** Student's raw answer text */
  answer: string;
  /** Whether graded correct */
  correct: boolean;
  /** The correct answer (display text) */
  expected: string;
  /** Grading feedback if any */
  feedback?: string;
  /** Whether voice mode was active */
  voice: boolean;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const LOG_KEY = 'chemassistant-answer-log';

export function logAnswer(entry: LogEntry): void {
  const log = getLog();
  log.push(entry);
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    // localStorage full or unavailable — silently drop
  }
}

export function getLog(): LogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearLog(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOG_KEY);
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

/** Pretty-printed JSON export — ideal for analysis. */
export function exportJSON(): string {
  return JSON.stringify(getLog(), null, 2);
}

/** CSV export — for spreadsheet review. */
export function exportCSV(): string {
  const log = getLog();
  if (log.length === 0) return '';

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const headers = [
    'Timestamp',
    'Type',
    'Prompt',
    'Instruction',
    'Answer',
    'Correct',
    'Expected',
    'Feedback',
    'Voice',
  ];

  const rows = log.map((e) =>
    [
      e.ts,
      e.type,
      e.prompt,
      e.instruction,
      e.answer,
      e.correct ? 'Y' : 'N',
      e.expected,
      e.feedback ?? '',
      e.voice ? 'Y' : 'N',
    ]
      .map((v) => escape(String(v)))
      .join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Compact text summary of wrong answers — designed for clipboard copy
 * so the teacher can paste it into a chat for analysis.
 */
export function formatWrongAnswers(): string {
  const log = getLog();
  const wrong = log.filter((e) => !e.correct);

  if (wrong.length === 0) return 'No wrong answers logged.';

  const dateRange =
    log.length > 0
      ? `${new Date(log[0].ts).toLocaleDateString()} – ${new Date(log[log.length - 1].ts).toLocaleDateString()}`
      : '';

  const lines = [
    `ChemAssistant — Wrong Answers`,
    `${dateRange} · ${log.length} total, ${wrong.length} wrong (${Math.round((wrong.length / log.length) * 100)}%)`,
    '',
  ];

  for (const e of wrong) {
    const mode = e.voice ? '🎤' : '⌨️';
    lines.push(
      `${mode} [${e.type}] ${e.prompt}: "${e.answer}" → ${e.expected}`,
    );
  }

  return lines.join('\n');
}
