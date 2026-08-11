import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import PasswordGate from '@/components/PasswordGate';

export const metadata: Metadata = {
  title: 'ChemAssistant',
  description: 'Voice-answer chemistry quiz app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ChemAssistant',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0d9488',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-dvh" suppressHydrationWarning>
        <PasswordGate>
          {children}
        </PasswordGate>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
