import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ForgotPasswordForm } from '@/components/landing/forgot-password-form';
import { LanguageSwitcher } from '@/components/landing/language-switcher';

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tCommon = await getTranslations('common');

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-emerald-50/40 to-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <a href={`/${locale}`} className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mbe.png" alt={tCommon('appName')} className="h-16 w-16 object-contain" />
          <span className="text-lg font-semibold text-slate-900">{tCommon('appName')}</span>
        </a>
        <LanguageSwitcher />
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
