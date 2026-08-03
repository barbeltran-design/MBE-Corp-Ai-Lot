import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Hero } from '@/components/landing/hero';
import { RegisterForm } from '@/components/landing/register-form';
import { LanguageSwitcher } from '@/components/landing/language-switcher';

export default function LandingPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);

  const tCommon = useTranslations('common');
  const tFooter = useTranslations('footer');

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 to-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mbe.png" alt={tCommon('appName')} className="h-8 w-8 object-contain" />
          <span className="text-lg font-semibold text-slate-900">{tCommon('appName')}</span>
        </div>
        <LanguageSwitcher />
      </header>

      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-10 lg:grid-cols-2 lg:py-20">
        <Hero />
        <div className="flex justify-center lg:justify-end">
          <RegisterForm />
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {tCommon('appName')}. {tFooter('rights')}
      </footer>
    </main>
  );
}
