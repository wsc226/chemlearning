'use client';

import { useState, useEffect } from 'react';

/**
 * Client-side password gate.
 *
 * The SHA-256 hash of the correct password is embedded at build time.
 * Once the user enters the right password, a flag is stored in
 * sessionStorage so they don't have to re-enter it on every page load
 * within the same browser session.
 *
 * This is NOT real security — it just keeps casual visitors out while
 * the app is in testing. The static files are still public on GitHub Pages.
 */

const CORRECT_HASH =
  'e79485634a1cb9a66c7cc1f6b3bc32129f0deae1ab343d91da401bd3763b6e20';
const STORAGE_KEY = 'chemassistant-auth';

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function PasswordGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check sessionStorage on mount
  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === 'true') {
      setAuthorized(true);
    }
    setChecking(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    const hash = await sha256(password.trim());
    if (hash === CORRECT_HASH) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      setAuthorized(true);
    } else {
      setError(true);
      setPassword('');
    }
  };

  // Don't flash the gate while checking sessionStorage
  if (checking) return null;

  if (authorized) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center min-h-dvh px-4">
      <div className="w-full max-w-sm">
        <div className="bg-[var(--color-chem-surface)] rounded-2xl border border-[var(--color-chem-border)] p-8 shadow-sm">
          <div className="text-center mb-6">
            <span className="text-5xl block mb-3" aria-hidden="true">
              &#x1F512;
            </span>
            <h1 className="text-xl font-bold text-[var(--color-chem-text)]">
              ChemAssistant
            </h1>
            <p className="text-sm text-[var(--color-chem-text-muted)] mt-1">
              Enter the class code to continue
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Class code"
              autoComplete="off"
              autoFocus
              className="w-full px-4 py-3 text-lg text-center rounded-xl border border-[var(--color-chem-border)] bg-[var(--color-chem-bg)] text-[var(--color-chem-text)] placeholder:text-[var(--color-chem-text-muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-chem-primary)] focus:border-transparent transition-shadow"
            />

            {error && (
              <p className="text-sm text-[var(--color-chem-incorrect)] text-center mt-2">
                Incorrect code. Try again.
              </p>
            )}

            <button
              type="submit"
              disabled={!password.trim()}
              className="w-full mt-4 py-3 px-6 rounded-xl font-semibold text-white bg-[var(--color-chem-primary)] hover:bg-[var(--color-chem-primary-dark)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
