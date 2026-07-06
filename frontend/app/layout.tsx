import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RegisterSW } from './register-sw';

export const metadata: Metadata = {
  title: 'RunTwi — Voice Running Coach',
  description: 'Local-language running coach for Ghana. Cues in Twi, Ga and Ewe.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'RunTwi' },
};

export const viewport: Viewport = {
  themeColor: '#0b6b3a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
