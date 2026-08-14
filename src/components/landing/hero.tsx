import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';

const HERO_COVER_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_3GKSOWtJRYR8ZbKliULo84biwzL/hf_20260814_015644_b2eab912-9908-446d-9e44-e56c82142d11.png';

export function Hero() {
  const t = useTranslations('landing.hero');

  return (
    <div className="max-w-xl">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        <Sparkles className="h-3.5 w-3.5" />
        {t('eyebrow')}
      </span>
      <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        {t('title')}
      </h1>
      <p className="mt-5 whitespace-pre-line text-lg text-slate-600">{t('subtitle')}</p>
      <p className="mt-4 text-sm text-slate-400">{t('socialProof')}</p>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={HERO_COVER_URL}
        alt={t('title')}
        className="mt-6 w-full max-w-sm rounded-2xl border border-emerald-100 object-cover shadow-lg"
        loading="lazy"
      />
    </div>
  );
}
