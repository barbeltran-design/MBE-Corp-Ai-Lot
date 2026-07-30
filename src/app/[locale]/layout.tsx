import { NextIntlClientProvider, useMessages } from 'next-intl';
import { notFound } from 'next/navigation';
import localFont from 'next/font/local';
import { locales } from '@/i18n/routing';
import { ThemeProvider } from '@/components/theme-provider';
import '@/app/globals.css'; // ← ESTA LÍNEA ES LA QUE FALTA

const geistSans = localFont({
  src: '../fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
  display: 'swap',
});

const geistMono = localFont({
  src: '../fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
  display: 'swap',
});

// Script inline que corre de forma síncrona antes de que React hidrate: lee el tema
// persistido (o la preferencia del sistema) y aplica la clase `.dark` al <html> ANTES
// del primer pintado, evitando el "flash" de tema incorrecto. También expone el valor
// resuelto en `window.__MBE_THEME__` para que <ThemeProvider> inicialice su estado de
// React ya sincronizado con el DOM real, sin un segundo render ni warning de hidratación.
const NO_FLASH_THEME_SCRIPT = `(function(){try{var s=localStorage.getItem('mbe-theme');var t=(s==='light'||s==='dark')?s:'dark';window.__MBE_THEME__=t;if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){window.__MBE_THEME__='dark';document.documentElement.classList.add('dark');}})();`;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!locales.includes(locale as any)) {
    notFound();
  }

  const messages = useMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
