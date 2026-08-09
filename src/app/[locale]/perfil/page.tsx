'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { onAuthStateChanged, signOut, updateProfile, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useDisplayLang } from '@/components/display-lang-provider';
import { AVATAR_COLORS, avatarBgColor, initialsOf } from '@/lib/avatar';
import { TEMAS_ESPECIALISTA, TEMA_LABELS, ROLE_LABELS } from '@/lib/roles';
import { nivelLabel, nivelPorPuntos } from '@/lib/refplace';
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
  const [photoBroken, setPhotoBroken] = React.useState(false);
  const [avatarColor, setAvatarColor] = React.useState<number | undefined>(undefined);
  const [companyName, setCompanyName] = React.useState('');
  const [industry, setIndustry] = React.useState<Industry>('services');
  const [size, setSize] = React.useState<CompanySize>('1-5');
  const [country, setCountry] = React.useState<string>('MX');
  const [website, setWebsite] = React.useState('');
  const [language, setLanguage] = React.useState<Language>('es');
  const [telefono, setTelefono] = React.useState('');

  const [saving, setSaving] = React.useState(false);
  const [savedMsg, setSavedMsg] = React.useState('');
  const [saveError, setSaveError] = React.useState('');

  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState('');

  const [subscription, setSubscription] = React.useState<string>('');
  const [planStatus, setPlanStatus] = React.useState<string>('');
  const [planActivatedAt, setPlanActivatedAt] = React.useState<string>('');

  // Club de juntas semanales
  const [puntosClub, setPuntosClub] = React.useState(0);
  const [semanasJunta, setSemanasJunta] = React.useState(0);
  const [primerJuntaAt, setPrimerJuntaAt] = React.useState('');

  const [payLoading, setPayLoading] = React.useState(false);
  const [payError, setPayError] = React.useState('');

  // ── Solicitar rol de especialista / rep sale ─────────────────────────
  const [roles, setRoles] = React.useState<string[]>([]);
  const [solicitudTipo, setSolicitudTipo] = React.useState<'especialista' | 'rep_sale'>('especialista');
  const [solicitudTemas, setSolicitudTemas] = React.useState<string[]>([]);
  const [solicitudMsg, setSolicitudMsg] = React.useState('');
  const [solicitudError, setSolicitudError] = React.useState('');

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
          setPhotoBroken(false);
          if (typeof data.avatarColor === 'number') setAvatarColor(data.avatarColor);
          setCountry(data.country || 'MX');
          setLanguage(data.language || 'es');
          setTelefono((data.telefono as string) || '');
          setPuntosClub(typeof data.puntosClub === 'number' ? data.puntosClub : 0);
          setSemanasJunta(typeof data.semanasJunta === 'number' ? data.semanasJunta : 0);
          setPrimerJuntaAt((data.primerJuntaAt as string) || '');
          setSubscription(data.subscription || 'free');
          setPlanStatus(data.planStatus || '');
          setPlanActivatedAt(data.planActivatedAt || '');
          if (Array.isArray(data.roles)) setRoles(data.roles.map(String));
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
          {
            name: name.trim(),
            language,
            country,
            telefono: telefono.trim(),
          },
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

  async function handleSaveTelefono() {
    if (!user) return;
    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'users', user.uid), { telefono: telefono.trim() }, { merge: true });
    } catch (err) {
      console.error('[perfil] telefono save failed', err);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user) return;
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(t('La imagen es muy pesada (máx. 5 MB).', 'The image is too large (max 5 MB).'));
      if (e.target) e.target.value = '';
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const idToken = await user.getIdToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/perfil/foto', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'upload failed');
      }
      const url: string = data.url;
      setPhotoURL(url);
      setPhotoBroken(false);
      await updateProfile(user, { photoURL: url }).catch(() => {});
      const db = getFirebaseDb();
      await setDoc(doc(db, 'users', user.uid), { photoURL: url }, { merge: true });
      setSavedMsg(t('Foto actualizada.', 'Photo updated.'));
    } catch (err) {
      console.error('[perfil] photo upload failed', err);
      const msg = err instanceof Error ? err.message : '';
      setUploadError(
        t('No se pudo subir la foto: ' + msg, 'Could not upload the photo: ' + msg)
      );
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  }

  async function handleSelectAvatarColor(index: number) {
    if (!user) return;
    setAvatarColor(index);
    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'users', user.uid), { avatarColor: index }, { merge: true });
      setSavedMsg(t('Avatar actualizado.', 'Avatar updated.'));
    } catch (err) {
      console.error('[perfil] avatar color failed', err);
      setSaveError(t('No se pudo guardar el color del avatar.', 'Could not save the avatar color.'));
    }
  }

  async function handleRemovePhoto() {
    if (!user) return;
    try {
      setPhotoURL('');
      setPhotoBroken(false);
      await updateProfile(user, { photoURL: '' }).catch(() => {});
      const db = getFirebaseDb();
      await setDoc(doc(db, 'users', user.uid), { photoURL: '' }, { merge: true });
      setSavedMsg(t('Foto eliminada.', 'Photo removed.'));
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

  async function handleSolicitarRol() {
    if (!user) return;
    setSolicitudMsg('');
    setSolicitudError('');
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/solicitar-rol', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tipo: solicitudTipo,
          temas: solicitudTipo === 'especialista' ? solicitudTemas : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'solicitud failed');
      }
      setSolicitudMsg(t('Solicitud enviada. Administración la revisará.', 'Request sent. Administration will review it.'));
    } catch (err) {
      console.error('[perfil] solicitud rol failed', err);
      setSolicitudError(
        (err instanceof Error ? err.message + '. ' : '') +
          t('No se pudo enviar la solicitud. Intenta de nuevo.', 'Could not send the request. Try again.')
      );
    }
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
          <div
            style={{ backgroundColor: avatarBgColor(avatarColor) }}
            className={'flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-bold text-white'}
          >
            {photoURL && !photoBroken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoURL} alt={name} className="h-full w-full object-cover" onError={() => setPhotoBroken(true)} />
            ) : (
              initialsOf(name)
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="profile-photo-input"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'cursor-pointer'
                )}
              >
                {uploading ? t('Subiendo...', 'Uploading...') : t('Subir foto', 'Upload photo')}
              </label>
              <input
                type="file"
                accept="image/*"
                id="profile-photo-input"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              {photoURL && (
                <Button type="button" variant="ghost" size="sm" onClick={handleRemovePhoto}>
                  {t('Quitar foto', 'Remove photo')}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {t('Color del avatar (si no hay foto):', 'Avatar color (when there is no photo):')}
              </span>
              {AVATAR_COLORS.map((color, i) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  onClick={() => handleSelectAvatarColor(i)}
                  style={{ backgroundColor: color }}
                  className={
                    'h-6 w-6 rounded-full transition-transform hover:scale-110 ' +
                    (avatarColor === i ? ' ring-2 ring-offset-2 ring-primary' : '')
                  }
                />
              ))}
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
                <Label htmlFor="perfil-telefono">
                  {t('Teléfono celular (visible en tu perfil público)', 'Cell phone (shown on your public profile)')}
                </Label>
                <Input
                  id="perfil-telefono"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  onBlur={handleSaveTelefono}
                  placeholder="+52 55 0000 0000"
                />
                <p className="text-xs text-muted-foreground">
                  {t('Se guarda automáticamente al salir del campo.', 'It is saved automatically when you leave the field.')}
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="perfil-nivel">
                  {t('Nivel en la comunidad', 'Community level')}
                </Label>
                <div className="rounded-lg border border-glass-border bg-glass p-3 text-sm">
                  <span className="font-semibold text-teal-700 dark:text-teal-300">{nivelLabel(nivelPorPuntos(puntosClub), dispLang)}</span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(
                      'Se calcula automáticamente con los puntos acumulados en la app y las juntas semanales. No se elige manualmente.',
                      'It is calculated automatically with the points you earn in the app and the weekly meetings. It is not chosen manually.'
                    )}
                  </p>
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>{t('Comunidad de Mentoría Semanal', 'Weekly Mentoring Community')}</Label>
                <div className="rounded-lg border border-glass-border bg-glass p-3 text-sm">
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <span className="text-muted-foreground">
                      {t('Puntos de la comunidad:', 'Community points:')}{' '}
                      <span className="font-semibold text-foreground">{puntosClub}</span>
                    </span>
                    {semanasJunta > 0 && (
                      <span className="text-muted-foreground">
                        {t('Juntas asistidas:', 'Meetings attended:')}{' '}
                        <span className="font-semibold text-foreground">{semanasJunta}</span>
                      </span>
                    )}
                    {primerJuntaAt && (
                      <span className="text-muted-foreground">
                        {t('Primera junta:', 'First meeting:')}{' '}
                        <span className="font-semibold text-foreground">
                          {new Date(primerJuntaAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t(
                      'Al acumular puntos en la app y en las juntas semanales tu nivel avanza automáticamente: 50 Freelancero, 200 Emprendedor, 500 Empresario Orquesta, 900 Director General, 1,500 Presidente, 2,500 Inversionista y 4,000 Mentor.',
                      'Earning points in the app and at weekly meetings automatically advances your level: 50 Freelancer, 200 Entrepreneur, 500 Orchestra Business Owner, 900 CEO, 1,500 President, 2,500 Investor and 4,000 Mentor.'
                    )}
                  </p>
                </div>
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

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-foreground">{t('Mi rol en la plataforma', 'My platform role')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('Solicita convertirte en Especialista (para dar apoyo On Demand a otros usuarios por tema) o en Rep Sale (para publicar necesidades de grandes empresas en el Reference Place). Administración aprobará tu solicitud.', 'Request to become a Specialist (to give On-Demand support to other users per topic) or a Rep Sale (to publish large-company needs in the Reference Place). Administration will approve your request.')}
            </p>

            {roles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {roles.map((r) => (
                  <span key={r} className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-500/20 dark:text-teal-200">
                    {ROLE_LABELS[r as keyof typeof ROLE_LABELS]?.[dispLang === 'en' ? 'en' : 'es'] ?? r}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Select value={solicitudTipo} onChange={(e) => setSolicitudTipo(e.target.value as 'especialista' | 'rep_sale')}>
                <option value="especialista">{t('Especialista', 'Specialist')}</option>
                <option value="rep_sale">{t('Rep Sale', 'Rep Sale')}</option>
              </Select>
              {solicitudTipo === 'especialista' && (
                <select
                  multiple
                  value={solicitudTemas}
                  onChange={(e) => {
                    const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setSolicitudTemas(opts);
                  }}
                  className="h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-foreground dark:border-slate-700 dark:bg-slate-900"
                >
                  {TEMAS_ESPECIALISTA.map((tm) => (
                    <option key={tm} value={tm} className="py-0.5">
                      {TEMA_LABELS[tm][dispLang === 'en' ? 'en' : 'es']}
                    </option>
                  ))}
                </select>
              )}
              <Button type="button" variant="outline" onClick={handleSolicitarRol}>
                {t('Enviar solicitud', 'Send request')}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('Para ser Especialista selecciona los temas en los que quieres asesorar (Ctrl para varios).', 'To become a Specialist, select the themes you want to advise on (Ctrl to pick multiple).')}
            </p>
            {solicitudMsg && <p className="mt-2 text-sm text-emerald-700">{solicitudMsg}</p>}
            {solicitudError && <p className="mt-2 text-sm text-red-600">{solicitudError}</p>}
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
