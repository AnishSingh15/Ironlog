import { AppShell } from '@/components/AppShell';
import { BottomNav } from '@/components/BottomNav';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { PWANotifications } from '@/components/PWANotifications';
import { PWAOfflineIndicator } from '@/components/PWAOfflineIndicator';
import { PWAStatusChecker } from '@/components/PWAStatusChecker';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
// import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0a0a0c',
};

export const metadata: Metadata = {
  title: 'IronLog - Track Your Fitness Journey',
  description: 'Professional fitness tracking application for serious athletes',
  keywords: ['fitness', 'workout', 'tracking', 'gym', 'exercise'],
  authors: [{ name: 'IronLog Team' }],
  creator: 'IronLog Team',
  publisher: 'IronLog',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'IronLog',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icon-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icon-512x512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
    apple: '/icon-192x192.svg',
  },
  formatDetection: {
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ironlog.app',
    title: 'IronLog - Track Your Fitness Journey',
    description: 'Professional fitness tracking application for serious athletes',
    siteName: 'IronLog',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IronLog - Track Your Fitness Journey',
    description: 'Professional fitness tracking application for serious athletes',
    creator: '@ironlog',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <Providers>
          <AppShell>{children}</AppShell>
          <BottomNav />
          <ServiceWorkerRegistration />
          <PWAInstallPrompt />
          <PWANotifications />
          <PWAStatusChecker />
          <PWAOfflineIndicator />
          {/* <Analytics /> */}
        </Providers>
      </body>
    </html>
  );
}
