import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Hero } from '@/components/landing/hero';
import { RegisterForm } from '@/components/landing/register-form';
import { LanguageSwitcher } from '@/components/landing/language-switcher';
import { AgentsPreview } from '@/components/landing/agents-preview';

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tCommon = await getTranslations('common');
  const tFooter = await getTranslations('footer');
  const tNav = await getTranslations('landing.nav');

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 to-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mbe.png" alt={tCommon('appName')} className="h-16 w-16 object-contain" />
          <span className="text-lg font-semibold text-slate-900">{tCommon('appName')}</span>
        </div>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
          <a href="#beneficios" className="transition-colors hover:text-slate-900">
            {tNav('features')}
          </a>
          <a href="#agentes" className="transition-colors hover:text-slate-900">
            {tNav('agents')}
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <a
            href={`/${locale}/login`}
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            {tNav('login')}
          </a>
          <LanguageSwitcher />
        </div>
      </header>

      <section id="beneficios" className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-10 lg:grid-cols-2 lg:py-20">
        <Hero />
        <div className="flex justify-center lg:justify-end">
          <RegisterForm />
        </div>
      </section>

      <AgentsPreview />

      <footer className="mx-auto max-w-6xl px-6 py-10 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {tFooter('brand')}. {tFooter('rights')}
      </footer>
    </main>
  );
}
