import type { Metadata, Viewport } from 'next';
import { Hanken_Grotesk } from 'next/font/google';
import { PRODUCT_NAME, TAGLINE } from '@/lib/brand';
import './globals.css';

const sans = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: `${PRODUCT_NAME}: ${TAGLINE}`,
  description: 'Prepare a Canadian T2 corporate tax return for a small incorporated business, in plain language.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
