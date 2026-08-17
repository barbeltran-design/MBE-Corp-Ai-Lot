'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  registerWithEmail,
  registerWithGoogle,
  subscribeToPendingGoogleRedirect,
  mapAuthErrorToMessageKey,
} from '@/lib/auth';
import type { CompanySize, Industry, Language } from '@/types/firestore';

const countries = ['MX', 'CO', 'AR', 'CL', 'PE', 'US', 'ES', 'OTHER'] as const;

const schema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2),
  industry: z.enum(['manufacturing', 'services', 'commerce', 'tech']),
  size: z.enum(['1-5', '6-20', '21-50', '50+']),
  country: z.enum(countries),
});

type FormValues = z.infer<typeof schema>;

export function RegisterForm() {
  const t = useTranslations('register');
  const locale = useLocale() as Language;
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [googleSubmitting, setGoogleSubmitting] = React.useState(false);

  // Consentimiento legal (Términos de Uso + Aviso de Privacidad). Se maneja
  // fuera de react-hook-form/zod porque debe gatear DOS caminos distintos:
  // el submit del formulario y el botón de Google (que no pasa por
  // handleSubmit). Ver createUserAndCompanyDocs() en src/lib/auth.ts.
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [isMinor, setIsMinor] = React.useState(false);
  const [guardianName, setGuardianName] = React.useState('');
  const [guardianEmail, setGuardianEmail] = React.useState('');

  const legalOk = isMinor
    ? acceptedTerms && guardianName.trim().length > 1 && guardianEmail.trim().length > 3
    : acceptedTerms;

  function buildLegalConsent() {
    return {
      aceptoTerminosAt: new Date().toISOString(),
      esMenorDeEdad: isMinor,
      ...(isMinor ? { tutorNombre: guardianName.trim(), tutorEmail: guardianEmail.trim() } : {}),
    };
  }

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { industry: 'services', size: '1-5', country: 'MX' },
  });

  React.useEffect(() => {
    // Picks up sign-in that finished via signInWithRedirect (the fallback used
    // when signInWithPopup gets blocked). This runs on every mount of this
    // page/component, so if the user is already authenticated when it lands
    // here it routes them straight to Inicio.
    const unsubscribe = subscribeToPendingGoogleRedirect(
      () => {
        router.push(`/${locale}/perfil`);
      },
      (err) => {
        console.error('[MBE Auth Error - google redirect]', err);
        setServerError(t(`errors.${mapAuthErrorToMessageKey(err)}`));
      }
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(values: FormValues) {
    if (!legalOk) return;
    setSubmitting(true);
    setServerError(null);
    try {
      await registerWithEmail(values.email, values.password, {
        fullName: values.fullName,
        companyName: values.companyName,
        industry: values.industry as Industry,
        size: values.size as CompanySize,
        country: values.country,
        language: locale,
        ...buildLegalConsent(),
      });
      router.push(`/${locale}/perfil`);
    } catch (err) {
      setServerError(t(`errors.${mapAuthErrorToMessageKey(err)}`));
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogleClick() {
    if (!legalOk) return;
    setGoogleSubmitting(true);
    setServerError(null);
    try {
      // Google sign-in doesn't collect company info first — we still need it,
      // so we fall back to sensible defaults and let the user refine them
      // from Settings later. Blocking the OAuth flow on a second form here
      // would tank conversion on the one CTA this screen exists for.
      const user = await registerWithGoogle({
        fullName: '',
        companyName: '',
        industry: 'services',
        size: '1-5',
        country: 'MX',
        language: locale,
        ...buildLegalConsent(),
      });
      if (user) {
        // signInWithPopup completed right here — no redirect happened, so we
        // navigate directly instead of waiting on the redirect-handling effect.
        router.push(`/${locale}/perfil`);
      }
      // If user is undefined, the popup was blocked and registerWithGoogle
      // fell back to signInWithRedirect, which navigates the browser away —
      // the useEffect above (subscribeToPendingGoogleRedirect) handles routing
      // to Inicio once that redirect comes back.
    } catch (err) {
      setServerError(t(`errors.${mapAuthErrorToMessageKey(err)}`));
    } finally {
      setGoogleSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
      <h2 className="text-xl font-semibold text-slate-900">{t('title')}</h2>
      <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>

      <Button
        type="button"
        variant="outline"
        className="mt-6 w-full"
        onClick={onGoogleClick}
        disabled={googleSubmitting || !legalOk}
      >
        {googleSubmitting ? t('submit') : t('googleCta')}
      </Button>

      <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        {t('orDivider')}
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="fullName">{t('fields.fullName')}</Label>
          <Input id="fullName" placeholder={t('fields.fullNamePlaceholder')} {...register('fullName')} />
          {errors.fullName && <p className="mt-1 text-xs text-red-600">{t('errors.required')}</p>}
        </div>

        <div>
          <Label htmlFor="email">{t('fields.email')}</Label>
          <Input id="email" type="email" placeholder={t('fields.emailPlaceholder')} {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{t('errors.invalidEmail')}</p>}
        </div>

        <div>
          <Label htmlFor="password">{t('fields.password')}</Label>
          <Input id="password" type="password" {...register('password')} />
          {errors.password && <p className="mt-1 text-xs text-red-600">{t('errors.minPassword')}</p>}
        </div>

        <div>
          <Label htmlFor="companyName">{t('fields.companyName')}</Label>
          <Input
            id="companyName"
            placeholder={t('fields.companyNamePlaceholder')}
            {...register('companyName')}
          />
          {errors.companyName && <p className="mt-1 text-xs text-red-600">{t('errors.required')}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="industry">{t('fields.industry')}</Label>
            <Controller
              control={control}
              name="industry"
              render={({ field }) => (
                <Select id="industry" {...field}>
                  <option value="manufacturing">{t('fields.industryOptions.manufacturing')}</option>
                  <option value="services">{t('fields.industryOptions.services')}</option>
                  <option value="commerce">{t('fields.industryOptions.commerce')}</option>
                  <option value="tech">{t('fields.industryOptions.tech')}</option>
                </Select>
              )}
            />
          </div>
          <div>
            <Label htmlFor="size">{t('fields.size')}</Label>
            <Controller
              control={control}
              name="size"
              render={({ field }) => (
                <Select id="size" {...field}>
                  <option value="1-5">{t('fields.sizeOptions.s1')}</option>
                  <option value="6-20">{t('fields.sizeOptions.s2')}</option>
                  <option value="21-50">{t('fields.sizeOptions.s3')}</option>
                  <option value="50+">{t('fields.sizeOptions.s4')}</option>
                </Select>
              )}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="country">{t('fields.country')}</Label>
          <Controller
            control={control}
            name="country"
            render={({ field }) => (
              <Select id="country" {...field}>
                <option value="MX">México</option>
                <option value="CO">Colombia</option>
                <option value="AR">Argentina</option>
                <option value="CL">Chile</option>
                <option value="PE">Perú</option>
                <option value="US">Estados Unidos</option>
                <option value="ES">España</option>
                <option value="OTHER">{locale === 'es' ? 'Otro' : 'Other'}</option>
              </Select>
            )}
          />
        </div>

        {serverError && <p className="text-sm text-red-600">{serverError}</p>}

        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
            />
            {isMinor ? (
              <span>{t('legal.guardianConsent')}</span>
            ) : (
              <span>
                {t('legal.acceptPrefix')}{' '}
                <a
                  href={`/${locale}/legal/terminos`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {t('legal.termsLabel')}
                </a>{' '}
                {t('legal.join')}{' '}
                <a
                  href={`/${locale}/legal/privacidad`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {t('legal.privacyLabel')}
                </a>
                .
              </span>
            )}
          </label>

          {isMinor && (
            <p className="pl-6 text-xs text-slate-500">
              <a href={`/${locale}/legal/terminos`} target="_blank" rel="noopener noreferrer" className="underline">
                {t('legal.termsLabel')}
              </a>{' '}
              {t('legal.join')}{' '}
              <a href={`/${locale}/legal/privacidad`} target="_blank" rel="noopener noreferrer" className="underline">
                {t('legal.privacyLabel')}
              </a>
            </p>
          )}

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={isMinor} onChange={(e) => setIsMinor(e.target.checked)} />
            {t('legal.minorLabel')}
          </label>

          {isMinor && (
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-2">
              <p className="text-xs font-medium text-amber-800">{t('legal.guardianTitle')}</p>
              <Input
                placeholder={t('legal.guardianName')}
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
              />
              <Input
                type="email"
                placeholder={t('legal.guardianEmail')}
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
              />
            </div>
          )}
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting || !legalOk}>
          {submitting ? t('submit') : t('submit')}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-500">
        {t('haveAccountPrefix')}{' '}
        <a href={`/${locale}/login`} className="text-primary underline">
          {t('loginLink')}
        </a>
      </p>
    </div>
  );
}
