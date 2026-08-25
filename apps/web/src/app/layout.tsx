import { AppShell } from '@/components/AppShell';
import { BottomNav } from '@/components/BottomNav';
import { PWAOfflineIndicator } from '@/components/PWAOfflineIndicator';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { Toaster } from '@/components/ui/Toast';
// import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import { Geist_Mono, Manrope } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  weight: ['400', '500', '600', '700'],
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
  themeColor: '#0e0e10',
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
    apple: '/icons/apple-touch-icon.png',
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
        className={`${manrope.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <Providers>
          <AppShell>{children}</AppShell>
          <BottomNav />
          <Toaster />
          <ServiceWorkerRegistration />
          <PWAOfflineIndicator />
          {/* <Analytics /> */}
        </Providers>
      </body>
    </html>
  );
}
