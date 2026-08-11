'use client';
import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Use relative path so it works with basePath on GitHub Pages
      const base = document.querySelector('base')?.href ?? '';
      const swUrl = base ? new URL('sw.js', base).href : '/sw.js';
      navigator.serviceWorker.register(swUrl).catch(() => {});
    }
  }, []);
  return null;
}
