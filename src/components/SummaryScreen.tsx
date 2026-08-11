'use client';

import { useState } from 'react';
import type { Question } from '@/lib/questions';
import type { GradeResult } from '@/lib/grading';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SummaryResult {
  question: Question;
  userAnswer: string;
  result: GradeResult;
}

interface SummaryScreenProps {
  results: SummaryResult[];
  quizTitle: string;
  onRestart: () => void;
  onHome: () => void;
}

// ---------------------------------------------------------------------------
// Score Ring (SVG)
// ---------------------------------------------------------------------------

function ScoreRing({
  correct,
  total,
}: {
  correct: number;
  total: number;
}) {
  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = total > 0 ? correct / total : 0;
  const offset = circumference * (1 - fraction);
  const percentage = Math.round(fraction * 100);

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-chem-border)"
          strokeWidth={strokeWidth}
        />
        {/* Score ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={fraction >= 0.7 ? 'var(--color-chem-correct)' : 'var(--color-chem-incorrect)'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Score text centered over the ring */}
      <div className="flex flex-col items-center -mt-[110px] mb-[50px]">
        <span className="text-3xl font-bold text-[var(--color-chem-text)]">
          {correct} / {total}
        </span>
        <span className="text-sm text-[var(--color-chem-text-muted)]">
          {percentage}%
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Performance message
// ---------------------------------------------------------------------------

function performanceMessage(fraction: number): string {
  if (fraction >= 0.9) return '🎉 Excellent!';
  if (fraction >= 0.7) return '👍 Good job!';
  return '📚 Keep practicing!';
}

// ---------------------------------------------------------------------------
// PNG image generation (Canvas API, no dependencies)
// ---------------------------------------------------------------------------

const IMG_COLORS = {
  bg: '#f0fdfa',
  surface: '#ffffff',
  text: '#134e4a',
  muted: '#5f9ea0',
  primary: '#0d9488',
  correct: '#16a34a',
  incorrect: '#dc2626',
  border: '#ccf5ee',
  rowAlt: '#f7fffe',
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}

async function generateSummaryPNG(
  results: SummaryResult[],
  quizTitle: string,
): Promise<Blob | null> {
  const total = results.length;
  const correct = results.filter((r) => r.result.correct).length;
  const percentage = Math.round((correct / total) * 100);
  const fraction = total > 0 ? correct / total : 0;

  const PAD = 32;
  const WIDTH = 750;
  const ROW_H = 44;
  const WRONG_EXTRA = 20; // extra height for wrong-answer detail
  const HEADER_H = 220;
  const FOOTER_H = 50;

  // Calculate total height
  let contentH = 0;
  for (const r of results) {
    contentH += ROW_H + (r.result.correct ? 0 : WRONG_EXTRA);
  }
  const HEIGHT = HEADER_H + contentH + FOOTER_H + PAD * 2;

  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 2, 3);
  canvas.width = WIDTH * dpr;
  canvas.height = HEIGHT * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = IMG_COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ─── Header card ───
  const cardX = PAD;
  const cardY = PAD;
  const cardW = WIDTH - PAD * 2;
  const cardH = HEADER_H - 16;

  ctx.fillStyle = IMG_COLORS.surface;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 16);
  ctx.fill();
  ctx.strokeStyle = IMG_COLORS.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Title
  ctx.fillStyle = IMG_COLORS.primary;
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`⚗️ ChemAssistant — ${quizTitle}`, WIDTH / 2, cardY + 40);

  // Date
  ctx.fillStyle = IMG_COLORS.muted;
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  ctx.fillText(dateStr, WIDTH / 2, cardY + 65);

  // Score
  ctx.fillStyle = IMG_COLORS.text;
  ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${correct} / ${total}`, WIDTH / 2, cardY + 125);

  // Percentage + performance
  const perfColor = fraction >= 0.7 ? IMG_COLORS.correct : IMG_COLORS.incorrect;
  ctx.fillStyle = perfColor;
  ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
  const perf =
    fraction >= 0.9
      ? `${percentage}% — Excellent!`
      : fraction >= 0.7
        ? `${percentage}% — Good job!`
        : `${percentage}% — Keep practicing!`;
  ctx.fillText(perf, WIDTH / 2, cardY + 160);

  // ─── Results table ───
  let y = HEADER_H + PAD;
  ctx.textAlign = 'left';

  // Table header
  ctx.fillStyle = IMG_COLORS.muted;
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('#', PAD + 8, y + 14);
  ctx.fillText('PROMPT', PAD + 44, y + 14);
  ctx.fillText('YOUR ANSWER', PAD + 260, y + 14);
  ctx.fillText('CORRECT ANSWER', PAD + 480, y + 14);
  y += 24;

  // Divider
  ctx.strokeStyle = IMG_COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(WIDTH - PAD, y);
  ctx.stroke();
  y += 4;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const rowH = ROW_H + (r.result.correct ? 0 : WRONG_EXTRA);

    // Alternating row background
    if (i % 2 === 1) {
      ctx.fillStyle = IMG_COLORS.rowAlt;
      ctx.fillRect(PAD, y, cardW, rowH);
    }

    // Wrong answer: light red background
    if (!r.result.correct) {
      ctx.fillStyle = '#fef2f2';
      ctx.fillRect(PAD, y, cardW, rowH);
    }

    const textY = y + ROW_H / 2 + 5;

    // Number
    ctx.fillStyle = IMG_COLORS.muted;
    ctx.font = '13px system-ui, -apple-system, sans-serif';
    ctx.fillText(String(i + 1), PAD + 8, textY);

    // Result icon
    ctx.fillStyle = r.result.correct ? IMG_COLORS.correct : IMG_COLORS.incorrect;
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(r.result.correct ? '✓' : '✗', PAD + 26, textY);

    // Prompt
    ctx.fillStyle = IMG_COLORS.text;
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    const promptText = truncateText(ctx, r.question.prompt, 200);
    ctx.fillText(promptText, PAD + 44, textY);

    // User answer
    ctx.fillStyle = r.result.correct ? IMG_COLORS.text : IMG_COLORS.incorrect;
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    const userText = truncateText(ctx, r.userAnswer, 200);
    ctx.fillText(userText, PAD + 260, textY);

    // Correct answer (show for wrong answers)
    if (!r.result.correct) {
      ctx.fillStyle = IMG_COLORS.correct;
      ctx.font = '13px system-ui, -apple-system, sans-serif';
      const correctText = truncateText(
        ctx,
        `→ ${r.question.correctDisplay}`,
        200,
      );
      ctx.fillText(correctText, PAD + 480, textY);
    }

    y += rowH;
  }

  // ─── Footer ───
  y += 16;
  ctx.fillStyle = IMG_COLORS.muted;
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Generated by ChemAssistant', WIDTH / 2, y);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

async function saveOrShareImage(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: 'image/png' });

  // Try native share with file — on iOS this opens the share sheet
  // with "Save Image" which saves directly to Photos
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'ChemAssistant Results',
      });
      return;
    } catch {
      // User cancelled or share failed — fall through
    }
  }

  // Fallback: open image in a new tab
  // On iOS the user can long-press → "Save to Photos"
  // On desktop the user can right-click → "Save image as..."
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank');
  if (!opened) {
    // Popup blocked — fall back to download link
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  // Keep the URL alive for a minute so the new tab can load it
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SummaryScreen({
  results,
  quizTitle,
  onRestart,
  onHome,
}: SummaryScreenProps) {
  const [saving, setSaving] = useState(false);
  const total = results.length;
  const correct = results.filter((r) => r.result.correct).length;
  const fraction = total > 0 ? correct / total : 0;

  const handleSaveImage = async () => {
    setSaving(true);
    try {
      const blob = await generateSummaryPNG(results, quizTitle);
      if (blob) {
        const date = new Date()
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, '');
        const filename = `ChemAssistant_${quizTitle.replace(/\s/g, '_')}_${date}.png`;
        await saveOrShareImage(blob, filename);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Score display */}
      <div className="bg-[var(--color-chem-surface)] rounded-xl border border-[var(--color-chem-border)] p-6 mb-6">
        <ScoreRing correct={correct} total={total} />

        <p className="text-xl font-semibold text-[var(--color-chem-text)] text-center">
          {performanceMessage(fraction)}
        </p>
      </div>

      {/* Save as Image button */}
      <button
        type="button"
        onClick={handleSaveImage}
        disabled={saving}
        className="w-full mb-6 py-3 px-6 rounded-xl font-semibold text-[var(--color-chem-primary)] bg-[var(--color-chem-primary)]/10 border border-[var(--color-chem-primary)]/30 hover:bg-[var(--color-chem-primary)]/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        <span aria-hidden="true">&#x1F4F7;</span>
        {saving ? 'Generating…' : 'Save Results as Image'}
      </button>

      {/* Question-by-question breakdown */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-[var(--color-chem-text-muted)] uppercase tracking-wide mb-3">
          Results
        </h2>
        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className="bg-[var(--color-chem-surface)] rounded-xl border border-[var(--color-chem-border)] p-4"
            >
              {/* Question header row */}
              <div className="flex items-start gap-3">
                {/* Correct / incorrect icon */}
                <span
                  className={`text-lg font-bold shrink-0 ${
                    r.result.correct
                      ? 'text-[var(--color-chem-correct)]'
                      : 'text-[var(--color-chem-incorrect)]'
                  }`}
                >
                  {r.result.correct ? '✓' : '✗'}
                </span>

                <div className="flex-1 min-w-0">
                  {/* Prompt */}
                  <p className="font-medium text-[var(--color-chem-text)]">
                    {r.question.prompt}
                  </p>

                  {/* Incorrect: show answers */}
                  {!r.result.correct && (
                    <div className="mt-1.5 space-y-0.5 text-sm">
                      <p>
                        <span className="text-[var(--color-chem-text-muted)]">
                          Your answer:{' '}
                        </span>
                        <span className="text-[var(--color-chem-incorrect)]">
                          {r.userAnswer}
                        </span>
                      </p>
                      <p>
                        <span className="text-[var(--color-chem-text-muted)]">
                          Correct:{' '}
                        </span>
                        <span className="text-[var(--color-chem-correct)]">
                          {r.question.correctDisplay}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Fun fact */}
                  {r.question.funFact && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-[var(--color-chem-text-muted)] leading-relaxed">
                      <span className="shrink-0" aria-hidden="true">
                        &#x1F4A1;
                      </span>
                      <span>{r.question.funFact}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-[var(--color-chem-primary)] hover:bg-[var(--color-chem-primary-dark)] transition-colors"
        >
          Try Again
        </button>
        <button
          type="button"
          onClick={onHome}
          className="w-full py-3.5 px-6 rounded-xl font-semibold text-[var(--color-chem-text)] bg-[var(--color-chem-surface)] border border-[var(--color-chem-border)] hover:bg-[var(--color-chem-bg)] transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
