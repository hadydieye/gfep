import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { THEME_COOKIE, parseTheme } from '@/lib/theme';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GFEP — Guinea Finance Enterprise Portal',
  description: 'Portail de gestion interne GUINEA FINANCE SARL',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Thème enregistré par le navigateur (N8), appliqué dès le rendu serveur : aucun flash
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="fr" className={theme === 'dark' ? 'dark' : undefined} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
