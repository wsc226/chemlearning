'use client';

/**
 * Answer logging — every quiz submission is silently POSTed to a Google Sheet
 * (via a Google Apps Script webhook) for centralized teacher review.
 *
 * Architecture:
 *   1. On each submission, POST to the webhook URL (fire-and-forget).
 *   2. If offline or the POST fails, queue the entry in localStorage.
 *   3. On the next successful POST, flush queued entries in the same request.
 *   4. The webhook URL is set at build time via NEXT_PUBLIC_SHEET_WEBHOOK_URL.
 *      When unset, logging is silently disabled (no error, no UI).
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
// Config
// ---------------------------------------------------------------------------

const SHEET_URL = process.env.NEXT_PUBLIC_SHEET_WEBHOOK_URL ?? '';
const QUEUE_KEY = 'chemassistant-log-queue';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log a quiz answer — silently POSTs to the Google Sheet webhook.
 * Queues entries in localStorage when offline and flushes on next success.
 * No-op when NEXT_PUBLIC_SHEET_WEBHOOK_URL is not configured.
 */
export function logAnswer(entry: LogEntry): void {
  if (!SHEET_URL) return;
  postToSheet(entry);
}

// ---------------------------------------------------------------------------
// Sheet POST + offline queue
// ---------------------------------------------------------------------------

function postToSheet(entry: LogEntry): void {
  const queued = getQueue();
  const payload = queued.length > 0 ? [...queued, entry] : [entry];

  fetch(SHEET_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    // mode: no-cors avoids preflight — Apps Script still receives the body.
    // Trade-off: we can't read the response, but for logging that's fine.
    mode: 'no-cors',
  })
    .then(() => {
      // Request was sent — clear the queue.
      // (With no-cors we can't verify the server accepted it, but the
      // teacher will notice if the sheet stays empty and can re-check setup.)
      clearQueue();
    })
    .catch(() => {
      // True network failure (offline) — queue for next attempt
      queueEntry(entry);
    });
}

// ---------------------------------------------------------------------------
// localStorage queue for offline resilience
// ---------------------------------------------------------------------------

function getQueue(): LogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function queueEntry(entry: LogEntry): void {
  if (typeof window === 'undefined') return;
  const queue = getQueue();
  queue.push(entry);
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full — drop silently
  }
}

function clearQueue(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {
    // ignore
  }
}
