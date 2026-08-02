'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { onAuthStateChanged, signOut, updateProfile, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useDisplayLang } from '@/components/display-lang-provider';
import type { CompanySize, Industry, Language, UserDoc } from '@/types/firestore';

const COUNTRIES = ['MX', 'CO', 'AR', 'CL', 'PE', 'US', 'ES', 'OTHER'] as const;
const INDUSTRIES: { value: Industry; es: string; en: string }[] = [
  { value: 'manufacturing', es: 'Manufactura', en: 'Manufacturing' },
  { value: 'services', es: 'Servicios', en: 'Services' },
  { value: 'commerce', es: 'Comercio', en: 'Commerce' },
  { value: 'tech', es: 'Tecnología', en: 'Technology' },
];
const SIZES: { value: CompanySize; es: string; en: string }[] = [
  { value: '1-5', es: '1 a 5 personas', en: '1-5 people' },
  { value: '6-20', es: '6 a 20 personas', en: '6-20 people' },
  { value: '21-50', es: '21 a 50 personas', en: '21-50 people' },
  { value: '50+', es: 'Más de 50 personas', en: '50+ people' },
];
const COUNTRY_NAMES: Record<string, string> = {
  MX: 'México',
  CO: 'Colombia',
  AR: 'Argentina',
  CL: 'Chile',
  PE: 'Perú',
  US: 'Estados Unidos',
  ES: 'España',
  OTHER: 'Otro',
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ? parts[0][0] : '';
  const second = parts.length > 1 ? parts[1][0] : '';
  return (first + second).toUpperCase() || '?';
}

function ProfilePageInner() {
  const locale = useLocale() as 'es' | 'en';
  const router = useRouter();
  const searchParams = useSearchParams();
  const pagoParam = searchParams.get('pago');
  const { lang: ctxLang, setLang } = useDisplayLang();
  const [dispLang, setDispLang] = React.useState<'es' | 'en'>(locale);
  React.useEffect(() => { setDispLang(ctxLang); }, [ctxLang]);
  const t = (es: string, en: string) => (dispLang === 'en' ? en : es);

  const [user, setUser] = React.useState<User | null | undefined>(undefined);
  const [loaded, setLoaded] = React.useState(false);

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [photoURL, setPhotoURL] = React.useState('');
  const [companyName, setCompanyName] = React.useState('');
  const [industry, setIndustry] = React.useState<Industry>('services');
  const [size, setSize] = React.useState<CompanySize>('1-5');
  const [country, setCountry] = React.useState<string>('MX');
  const [website, setWebsite] = React.useState('');
  const [language, setLanguage] = React.useState<Language>('es');

  const [saving, setSaving] = React.useState(false);
  const [savedMsg, setSavedMsg] = React.useState('');
  const [saveError, setSaveError] = React.useState('');

  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState('');

  const [subscription, setSubscription] = React.useState<string>('');
  const [planStatus, setPlanStatus] = React.useState<string>('');
  const [planActivatedAt, setPlanActivatedAt] = React.useState<string>('');

  const [payLoading, setPayLoading] = React.useState(false);
  const [payError, setPayError] = React.useState('');

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        router.replace(`/${locale}`);
        return;
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const db = getFirebaseDb();
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data() as UserDoc;
          setName(data.name || '');
          setEmail(data.email || user.email || '');
          setPhotoURL(data.photoURL || user.photoURL || '');
          setCountry(data.country || 'MX');
          setLanguage(data.language || 'es');
          setSubscription(data.subscription || 'free');
          setPlanStatus(data.planStatus || '');
          setPlanActivatedAt(data.planActivatedAt || '');
        }
        const companySnap = await getDoc(doc(db, 'companies', user.uid));
        if (!cancelled && companySnap.exists()) {
          const data = companySnap.data() as { name?: string; industry?: Industry; size?: CompanySize; country?: string; website?: string };
          setCompanyName(data.name || '');
          if (data.industry) setIndustry(data.industry);
          if (data.size) setSize(data.size);
          if (data.country) setCountry(data.country);
          setWebsite(data.website || '');
        }
      } catch (err) {
        console.error('[perfil] failed to load', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSavedMsg('');
    setSaveError('');
    try {
      const db = getFirebaseDb();
      await Promise.all([
        setDoc(
          doc(db, 'users', user.uid),
          { name: name.trim(), language, country },
          { merge: true }
        ),
        setDoc(
          doc(db, 'companies', user.uid),
          { name: companyName.trim(), industry, size, country, website: website.trim() },
          { merge: true }
        ),
      ]);
      if (user.displayName !== name.trim()) {
        await updateProfile(user, { displayName: name.trim() }).catch(() => {});
      }
      setSavedMsg(t('Datos guardados correctamente.', 'Data saved successfully.'));
    } catch (err) {
      console.error('[perfil] save failed', err);
      setSaveError(t('No se pudieron guardar los datos. Intenta de nuevo.', 'Could not save your data. Try again.'));
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user) return;
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const storage = getFirebaseStorage();
      const fileRef = ref(storage, 'profile-photos/' + user.uid + '/' + Date.now().toString(36) + '.' + (file.name.split('.').pop() || 'jpg'));
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setPhotoURL(url);
      await updateProfile(user, { photoURL: url }).catch(() => {});
      const db = getFirebaseDb();
      await setDoc(doc(db, 'users', user.uid), { photoURL: url }, { merge: true });
    } catch (err) {
      console.error('[perfil] photo upload failed', err);
      setUploadError(t('No se pudo subir la foto.', 'Could not upload the photo.'));
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  }

  async function handleRemovePhoto() {
    if (!user) return;
    try {
      setPhotoURL('');
      await updateProfile(user, { photoURL: '' }).catch(() => {});
      const db = getFirebaseDb();
      await setDoc(doc(db, 'users', user.uid), { photoURL: '' }, { merge: true });
    } catch (err) {
      console.error('[perfil] photo remove failed', err);
    }
  }

  async function handleLanguageChange(newLang: Language) {
    setLanguage(newLang);
    setLang(newLang);
    if (user) {
      try {
        const db = getFirebaseDb();
        await setDoc(doc(db, 'users', user.uid), { language: newLang }, { merge: true });
      } catch (err) {
        console.error('[perfil] failed to save language', err);
      }
    }
    router.replace('/' + newLang + '/perfil');
  }

  async function handlePagar() {
    if (!user) return;
    setPayLoading(true);
    setPayError('');
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/pagos/crear-preferencia', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locale, returnPath: '/perfil' }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || 'No se pudo iniciar el pago.');
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error(err);
      setPayError(t('No se pudo iniciar el pago. Intenta de nuevo en unos segundos.', 'Could not start the payment. Try again in a few seconds.'));
      setPayLoading(false);
    }
  }

  async function handleLogout() {
    const auth = getFirebaseAuth();
    await signOut(auth);
    router.push('/' + locale);
  }

  if (user === undefined) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">{t('Cargando...', 'Loading...')}</div>;
  }
  if (user === null) {
    return null;
  }

  const esPro = subscription === 'pro' && planStatus === 'active';
  const countryName = COUNTRY_NAMES[country] || country;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('Mi perfil', 'My profile')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Completa tus datos, sube tu foto y administra tu plan.', 'Complete your data, upload your photo and manage your plan.')}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
          {t('Cerrar sesión', 'Log out')}
        </Button>
      </div>

      {pagoParam === 'exitoso' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {t('Tu pago se está confirmando. En unos segundos verás tu plan activado aquí abajo.', 'Your payment is being confirmed. In a few seconds your plan will appear as active below.')}
        </div>
      )}
      {pagoParam === 'pendiente' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t('Tu pago quedó pendiente de confirmación por Mercado Pago.', 'Your payment is pending confirmation from Mercado Pago.')}
        </div>
      )}
      {pagoParam === 'fallido' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {t('El pago no se completó. Puedes intentarlo de nuevo cuando quieras.', 'The payment was not completed. You can try again whenever you want.')}
        </div>
      )}

      <Card className="p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xl font-bold text-primary-foreground">
            {photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoURL} alt={name} className="h-full w-full object-cover" />
            ) : (
              initialsOf(name)
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="image/*"
              id="profile-photo-input"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('profile-photo-input')?.click()}>
                {uploading ? t('Subiendo...', 'Uploading...') : t('Subir foto', 'Upload photo')}
              </Button>
              {photoURL && (
                <Button type="button" variant="ghost" size="sm" onClick={handleRemovePhoto}>
                  {t('Quitar foto', 'Remove photo')}
                </Button>
              )}
            </div>
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          </div>
        </div>
      </Card>

      {!loaded && (
        <div className="flex min-h-[20vh] items-center justify-center text-sm text-muted-foreground">{t('Cargando...', 'Loading...')}</div>
      )}

      {loaded && (
        <>
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-foreground">{t('Datos personales', 'Personal data')}</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="perfil-name">{t('Nombre completo', 'Full name')}</Label>
                <Input id="perfil-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="perfil-email">{t('Correo electrónico', 'Email')}</Label>
                <Input id="perfil-email" value={email} disabled />
              </div>
              <div className="space-y-1">
                <Label htmlFor="perfil-country">{t('País', 'Country')}</Label>
                <Select id="perfil-country" value={country} onChange={(e) => setCountry(e.target.value)}>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {COUNTRY_NAMES[c]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="perfil-language">{t('Idioma de la plataforma', 'Platform language')}</Label>
                <Select id="perfil-language" value={language} onChange={(e) => handleLanguageChange(e.target.value as Language)}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-foreground">{t('Tu empresa', 'Your company')}</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="perfil-company">{t('Nombre de la empresa', 'Company name')}</Label>
                <Input id="perfil-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="perfil-website">{t('Sitio web', 'Website')}</Label>
                <Input id="perfil-website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://tusitio.com" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="perfil-industry">{t('Giro / industria', 'Industry')}</Label>
                <Select id="perfil-industry" value={industry} onChange={(e) => setIndustry(e.target.value as Industry)}>
                  {INDUSTRIES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {dispLang === 'en' ? opt.en : opt.es}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="perfil-size">{t('Tamaño de la empresa', 'Company size')}</Label>
                <Select id="perfil-size" value={size} onChange={(e) => setSize(e.target.value as CompanySize)}>
                  {SIZES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {dispLang === 'en' ? opt.en : opt.es}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? t('Guardando...', 'Saving...') : t('Guardar cambios', 'Save changes')}
              </Button>
              {savedMsg && <p className="text-sm text-emerald-700">{savedMsg}</p>}
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-foreground">{t('Tu plan', 'Your plan')}</h2>
            <div className="mt-4 flex flex-col gap-3">
              {esPro ? (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div>
                    <p className="font-medium text-emerald-800">{t('Plan completo activo', 'Full plan active')}</p>
                    <p className="mt-0.5 text-sm text-emerald-700">
                      {planActivatedAt
                        ? t('Activado el ' + new Date(planActivatedAt).toLocaleDateString(dispLang === 'en' ? 'en-US' : 'es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), 'Activated on ' + new Date(planActivatedAt).toLocaleDateString(dispLang === 'en' ? 'en-US' : 'es-MX', { year: 'numeric', month: 'long', day: 'numeric' }))
                        : t('Acceso completo a todas las herramientas de MBE Corpilot AI.', 'Full access to all MBE Corpilot AI tools.')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="font-medium text-foreground">{t('Plan gratuito', 'Free plan')}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t('Estás en el diagnóstico gratuito. Desbloquea el plan completo para acceder a todas las herramientas.', 'You are on the free diagnostic plan. Unlock the full plan to access all the tools.')}
                  </p>
                  <Button className="mt-4" onClick={handlePagar} disabled={payLoading}>
                    {payLoading ? t('Abriendo Mercado Pago...', 'Opening Mercado Pago...') : t('Pagar plan completo', 'Pay for full plan')}
                  </Button>
                  {payError && <p className="mt-2 text-sm text-red-600">{payError}</p>}
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      }
    >
      <ProfilePageInner />
    </React.Suspense>
  );
}
