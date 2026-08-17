import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
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
// Las rutas con el logotipo MBE (landing/registro `/{locale}`, login y recuperar
// contraseña) se fuerzan SIEMPRE en light: el logotipo usa tinta oscura y no se
// distingue sobre el fondo dark. ThemeProvider replica esta regla (y la revierte al
// navegar), ver theme-provider.tsx.
const NO_FLASH_THEME_SCRIPT = `(function(){var seg=window.location.pathname.split('/').filter(Boolean);var forcedLight=seg.length<=1||(seg.length===2&&(seg[1]==='login'||seg[1]==='recuperar-contrasena'));try{var s=localStorage.getItem('mbe-theme');var t=(s==='light'||s==='dark')?s:'dark';window.__MBE_THEME__=t;if(t==='dark'&&!forcedLight){document.documentElement.classList.add('dark');}}catch(e){window.__MBE_THEME__='dark';if(!forcedLight){document.documentElement.classList.add('dark');}}})();`;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as any)) {
    notFound();
  }
  setRequestLocale(locale);

  const messages = await getMessages();

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
        <div className="galaxy-bg" aria-hidden="true">
          <svg className="galaxy-spiral" viewBox="0 0 1200 1200" preserveAspectRatio="xMidYMid meet">
            <defs>
              <radialGradient id="galaxy-core" cx="50%" cy="50%" r="58%">
                <stop offset="0%" stopColor="#cfeefc" stopOpacity="0.95" />
                <stop offset="30%" stopColor="#7c5cf5" stopOpacity="0.5" />
                <stop offset="62%" stopColor="#2dd4bf" stopOpacity="0.18" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>
            <circle cx="600" cy="600" r="575" fill="url(#galaxy-core)" />
            <path d="M634.4 608.8 L637.4 614.7 L639.5 621.4 L640.3 628.9 L639.9 636.8 L638.1 645.0 L634.8 653.3 L630.1 661.4 L623.8 669.1 L616.1 676.1 L607.0 682.2 L596.6 687.1 L585.1 690.7 L572.7 692.6 L559.6 692.9 L546.1 691.2 L532.4 687.6 L518.8 681.9 L505.6 674.2 L493.1 664.4 L481.7 652.7 L471.6 639.0 L463.2 623.7 L456.6 606.9 L452.2 588.8 L450.1 569.7 L450.5 550.0 L453.6 529.9 L459.4 509.8 L468.0 490.2 L479.3 471.3 L493.3 453.6 L509.9 437.4 L528.9 423.2 L550.0 411.3 L573.1 401.9 L597.7 395.4 L623.4 392.0 L650.0 391.9 L676.9 395.2 L703.8 402.1 L730.1 412.6 L755.3 426.6 L779.1 444.0 L800.8 464.6 L820.2 488.3 L836.7 514.7 L850.0 543.5 L859.7 574.3 L865.6 606.6 L867.4 640.0 L865.0 674.0 L858.2 707.9 L847.0 741.3 L831.4 773.4 L811.6 803.9 L787.8 832.1 L760.3 857.5 L729.3 877.8 L695.2 897.8 L658.6 911.9 L620.0 921.5 L579.9 926.2 L539.0 925.8 L497.8 920.4 L457.2 909.5 L417.6 893.5 L379.8 872.4 L344.5 846.5 L312.3 815.9 L283.8 781.1 L259.6 742.6 L240.1 700.8 L225.7 656.3 L217.0 609.8 L214.0 562.1 L217.0 513.7 L226.2 465.6 L241.4 418.4 L262.7 372.9 L289.7 330.0 L322.2 290.3 L359.9 254.5 L402.1 223.4 L448.4 197.4 L498.1 177.3 L550.5 163.3 L604.8 155.1 L660.2 155.1 L715.8 161.4 L770.7 174.6 L824.2 194.8 L875.2 221.8 L922.9 255.2 L966.6 294.6 L1005.2 339.6 L1038.7 389.6 L1065.7 443.6 L1086.0 501.5 L1099.2 561.8 L1104.0 623.9 L1102.6 686.7 L1092.6 749.4 L1074.7 810.9 L1049.0 870.3 L1016.0 926.5 L975.9 978.6 L929.2 1025.8 L876.5 1067.2 L818.7 1102.0 L756.1 1129.7" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M565.6 591.2 L562.6 585.3 L560.5 578.6 L559.7 571.1 L560.1 563.2 L561.9 555.0 L565.2 546.7 L569.9 538.6 L576.2 530.9 L583.9 523.9 L593.0 517.8 L603.4 512.9 L614.9 509.3 L627.3 507.4 L640.4 507.1 L653.9 508.8 L667.6 512.4 L681.2 518.1 L694.4 525.8 L706.9 535.6 L718.3 547.3 L728.4 561.0 L736.8 576.3 L743.4 593.1 L747.8 611.2 L749.9 630.3 L749.5 650.0 L746.4 670.1 L740.6 690.2 L732.0 709.8 L720.7 728.7 L706.7 746.4 L690.1 762.6 L671.1 776.8 L650.0 788.7 L626.9 798.1 L602.3 804.6 L576.6 808.0 L550.0 808.1 L523.1 804.8 L496.2 797.9 L469.9 787.4 L444.7 773.4 L420.9 756.0 L399.2 735.4 L379.8 711.7 L363.3 685.3 L350.0 656.5 L340.3 625.7 L334.4 593.4 L332.6 560.0 L335.0 526.0 L341.8 492.1 L353.0 458.7 L368.6 426.6 L388.4 396.1 L412.2 367.9 L439.7 342.5 L470.7 320.4 L504.8 302.2 L541.4 288.1 L580.0 278.5 L620.1 273.8 L661.0 274.2 L702.2 279.7 L742.8 290.5 L782.4 306.5 L820.2 327.6 L855.5 353.5 L887.7 384.1 L916.2 418.9 L940.4 457.4 L959.9 499.2 L974.3 543.7 L983.0 590.2 L986.0 637.9 L983.0 686.3 L973.8 734.4 L958.6 781.6 L937.3 827.1 L910.3 870.0 L877.8 909.7 L840.1 945.5 L797.9 976.6 L751.6 1002.6 L701.9 1022.7 L649.5 1036.7 L595.2 1044.2 L539.8 1044.9 L484.2 1038.6 L429.3 1025.4 L375.8 1005.2 L324.8 978.2 L277.1 944.8 L233.4 905.4 L194.6 860.4 L161.3 810.4 L134.3 756.2 L114.0 698.5 L100.8 638.2 L95.2 576.1 L97.4 513.3 L107.5 450.6 L125.3 389.1 L151.0 329.7 L184.0 273.5 L224.1 221.4 L270.8 174.2 L323.5 132.8 L381.3 98.0 L443.6 70.3" fill="none" stroke="#bee8ff" strokeOpacity="0.6" strokeWidth="9" strokeLinecap="round" />
            <path d="M634.4 608.8 L637.4 614.7 L639.5 621.4 L640.3 628.9 L639.9 636.8 L638.1 645.0 L634.8 653.3 L630.1 661.4 L623.8 669.1 L616.1 676.1 L607.0 682.2 L596.6 687.1 L585.1 690.7 L572.7 692.6 L559.6 692.9 L546.1 691.2 L532.4 687.6 L518.8 681.9 L505.6 674.2 L493.1 664.4 L481.7 652.7 L471.6 639.0 L463.2 623.7 L456.6 606.9 L452.2 588.8 L450.1 569.7 L450.5 550.0 L453.6 529.9 L459.4 509.8 L468.0 490.2 L479.3 471.3 L493.3 453.6 L509.9 437.4 L528.9 423.2 L550.0 411.3 L573.1 401.9 L597.7 395.4 L623.4 392.0 L650.0 391.9 L676.9 395.2 L703.8 402.1 L730.1 412.6 L755.3 426.6 L779.1 444.0 L800.8 464.6 L820.2 488.3 L836.7 514.7 L850.0 543.5 L859.7 574.3 L865.6 606.6 L867.4 640.0 L865.0 674.0 L858.2 707.9 L847.0 741.3 L831.4 773.4 L811.6 803.9 L787.8 832.1 L760.3 857.5 L729.3 879.6 L695.2 897.8 L658.6 911.9 L620.0 921.5 L579.9 926.2 L539.0 925.8 L497.8 920.3 L457.2 909.5 L417.6 893.5 L379.8 872.4 L344.5 846.5 L312.3 815.9 L283.8 781.1 L259.6 742.6 L240.1 700.8 L225.7 656.3 L217.0 609.8 L214.0 562.1 L217.0 513.7 L226.2 465.6 L241.4 418.4 L262.7 372.9 L289.7 330.0 L322.2 290.3 L359.9 254.5 L402.1 223.4 L448.4 197.4 L498.1 177.3 L550.5 163.3 L604.8 155.8 L660.2 155.1 L715.8 161.4 L770.7 174.6 L824.2 194.8 L875.2 221.8 L922.9 255.2 L966.6 294.6 L1005.4 339.6 L1038.7 389.6 L1065.7 443.8 L1086.0 501.5 L1099.2 561.8 L1104.8 623.9 L1102.6 686.7 L1092.5 749.4 L1074.7 810.9 L1049.0 870.3 L1016.0 926.5 L975.9 978.6 L929.2 1025.8 L876.5 1067.2 L818.7 1102.0 L756.4 1129.7" fill="none" stroke="#2dd4bf" strokeOpacity="0.3" strokeWidth="10" strokeLinecap="round" />
            <path d="M565.6 591.2 L562.6 585.3 L560.5 578.6 L559.7 571.1 L560.1 563.2 L561.9 555.0 L565.2 546.7 L569.9 538.6 L576.2 530.9 L583.9 523.9 L593.0 517.8 L603.4 512.9 L614.9 509.3 L627.3 507.4 L640.4 507.1 L653.9 508.8 L667.6 512.4 L681.2 518.1 L694.4 525.8 L706.9 535.6 L718.3 547.3 L728.4 561.0 L736.8 576.3 L743.4 593.1 L747.8 611.2 L749.9 630.3 L749.5 650.0 L746.4 670.1 L740.6 690.2 L732.0 709.8 L720.7 728.7 L706.7 746.4 L690.1 762.6 L671.1 776.8 L650.0 788.7 L626.9 798.1 L602.3 804.6 L576.6 808.0 L550.0 808.1 L523.1 804.8 L496.2 797.9 L469.9 787.4 L444.7 773.4 L420.9 756.0 L399.2 735.4 L379.8 711.7 L363.3 685.3 L350.0 656.5 L340.3 625.7 L334.4 593.4 L332.6 560.0 L335.0 526.0 L341.8 492.1 L353.0 458.7 L368.6 426.6 L388.4 396.1 L412.2 367.9 L439.7 342.5 L470.7 320.4 L504.8 302.2 L541.4 288.1 L580.0 278.5 L620.1 273.8 L661.0 274.2 L702.2 279.7 L742.8 290.5 L782.4 306.5 L820.2 327.6 L855.5 353.5 L887.7 384.1 L916.2 418.9 L940.4 457.4 L959.9 499.2 L974.3 543.7 L983.0 590.2 L986.0 637.9 L983.0 686.3 L973.8 734.4 L958.6 781.6 L937.3 827.1 L910.3 870.0 L877.8 909.7 L840.1 945.5 L797.9 976.6 L751.6 1002.6 L701.9 1022.7 L649.5 1036.7 L595.2 1044.2 L539.8 1044.9 L484.2 1038.6 L429.3 1025.4 L375.8 1005.2 L324.8 978.2 L277.1 944.8 L233.4 905.4 L194.6 860.4 L161.3 810.4 L134.3 756.2 L114.0 698.5 L100.8 638.2 L95.2 576.1 L97.4 513.3 L107.5 450.6 L125.3 389.1 L151.0 329.7 L184.0 273.5 L224.1 221.4 L270.8 174.2 L323.5 132.8 L381.3 98.0 L443.6 70.3" fill="none" stroke="#7c5cf5" strokeOpacity="0.35" strokeWidth="10" strokeLinecap="round" />
            <circle cx="855" cy="372" r="2.6" fill="#ffffff" fillOpacity="0.9" />
            <circle cx="310" cy="820" r="3" fill="#ffffff" fillOpacity="0.8" />
            <circle cx="950" cy="700" r="2.2" fill="#ffffff" fillOpacity="0.7" />
            <circle cx="240" cy="480" r="2.4" fill="#ffffff" fillOpacity="0.75" />
            <circle cx="700" cy="1080" r="2.8" fill="#ffffff" fillOpacity="0.85" />
            <circle cx="480" cy="140" r="2.2" fill="#ffffff" fillOpacity="0.7" />
            <circle cx="860" cy="260" r="2.6" fill="#ffffff" fillOpacity="0.8" />
          </svg>
        </div>
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
