'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { useDisplayLang } from '@/components/display-lang-provider';
import { useUserRoles } from '@/lib/use-user-roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { APP_ROLES, ROLE_LABELS, TEMAS_ESPECIALISTA, TEMA_LABELS, PRODUCTOS_PAGO, PRODUCTO_LABELS } from '@/lib/roles';
import { DEFAULT_CATALOG, type CatalogItem } from '@/lib/catalog';

type TabKey = 'catalog' | 'users' | 'pagos' | 'pagosEsp' | 'solicitudes';

const TAB_DEFS: { key: TabKey; es: string; en: string }[] = [
  { key: 'catalog', es: 'Precios y promociones', en: 'Prices & promotions' },
  { key: 'users', es: 'Usuarios y roles', en: 'Users & roles' },
  { key: 'pagos', es: 'Pagos recibidos', en: 'Received payments' },
  { key: 'pagosEsp', es: 'Pagos a especialistas', en: 'Specialist payments' },
  { key: 'solicitudes', es: 'Solicitudes de rol', en: 'Role requests' },
];

const fmtMoney = (n: number | null | undefined) =>
  n == null ? '—' : 'MX$ ' + n.toLocaleString('en-US');

function formatDate(iso: unknown, lang: 'es' | 'en') {
  if (!iso) return '—';
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function RoleBadge({ role, lang }: { role: string; lang: 'es' | 'en' }) {
  const color =
    role === 'admin'
      ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200'
      : role === 'especialista'
        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200'
        : role === 'rep_sale'
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
          : 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200';
  const label = ROLE_LABELS[role as keyof typeof ROLE_LABELS]?.[lang] ?? role;
  return <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + color}>{label}</span>;
}

function PagoStatusBadge({ status, t }: { status: string; t: (es: string, en: string) => string }) {
  const approved = status === 'approved';
  return (
    <span
      className={
        'rounded-full px-2 py-0.5 text-xs font-medium ' +
        (approved
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200')
      }
    >
      {approved ? t('Aprobado', 'Approved') : status}
    </span>
  );
}

function EstatusBadge({ estatus, t }: { estatus?: string; t: (es: string, en: string) => string }) {
  const cancelado = estatus === 'cancelado';
  return (
    <span
      className={
        'rounded-full px-2 py-0.5 text-xs font-medium ' +
        (cancelado
          ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200'
          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200')
      }
    >
      {cancelado ? t('Cancelado', 'Cancelled') : t('Activo', 'Active')}
    </span>
  );
}

function SolicitudBadge({ estado, t }: { estado: string; t: (es: string, en: string) => string }) {
  const color =
    estado === 'pendiente'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
      : estado === 'aprobada'
        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
        : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200';
  const label =
    estado === 'pendiente'
      ? t('Pendiente', 'Pending')
      : estado === 'aprobada'
        ? t('Aprobada', 'Approved')
        : t('Rechazada', 'Rejected');
  return <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + color}>{label}</span>;
}

interface UserRow {
  uid: string;
  name?: string;
  email?: string;
  roles?: string[];
  especialistaTemas?: string[];
  certificado?: boolean;
  estatus?: string;
  companyName?: string;
  totalMaturity?: number | null;
  subscription?: string;
  planStatus?: string;
  planCancelaEn?: string | null;
  accesoManualPremium?: boolean;
  totalInvertido?: number;
  actividad?: { assessments?: number; sesionesBabel?: number; pagos?: number };
}

export default function AdminPage() {
  const params = useParams();
  const routeLocale = typeof params.locale === 'string' ? params.locale : 'es';
  const router = useRouter();
  const { lang } = useDisplayLang();
  const [dispLang, setDispLang] = React.useState<'es' | 'en'>(routeLocale === 'en' ? 'en' : 'es');
  React.useEffect(() => { setDispLang(lang); }, [lang]);
  const t = (es: string, en: string) => (dispLang === 'en' ? en : es);

  const { loading, administracion } = useUserRoles();
  const [user, setUser] = React.useState<User | null>(null);
  const [tab, setTab] = React.useState<TabKey>('catalog');

  // Catálogo
  const [catalog, setCatalog] = React.useState<CatalogItem[]>(DEFAULT_CATALOG);
  const [catalogMsg, setCatalogMsg] = React.useState('');

  // Usuarios y roles
  const [usuarios, setUsuarios] = React.useState<UserRow[]>([]);
  const [userSearch, setUserSearch] = React.useState('');
  const [selUid, setSelUid] = React.useState('');
  const [selRoles, setSelRoles] = React.useState<string[]>([]);
  const [selTemas, setSelTemas] = React.useState<string[]>([]);
  const [selCert, setSelCert] = React.useState(false);
  const [selAccesoPremium, setSelAccesoPremium] = React.useState(false);
  const [rolesMsg, setRolesMsg] = React.useState('');
  const [estatusMsg, setEstatusMsg] = React.useState('');
  const [confirmDeleteUid, setConfirmDeleteUid] = React.useState('');
  const [deletingUid, setDeletingUid] = React.useState('');

  // Pagos
  const [pagos, setPagos] = React.useState<any[]>([]);
  const [pagosEsp, setPagosEsp] = React.useState<any[]>([]);
  const [pagoEspForm, setPagoEspForm] = React.useState({
    especialistaUid: '',
    monto: '',
    concepto: 'Honorarios',
    metodo: 'Transferencia',
    fechaPago: '',
  });
  const [pagoEspMsg, setPagoEspMsg] = React.useState('');
  const [editPagoEspId, setEditPagoEspId] = React.useState('');
  const [editPagoEspForm, setEditPagoEspForm] = React.useState({
    monto: '',
    concepto: '',
    metodo: 'Transferencia',
    fechaPago: '',
  });
  const [pagoEspEditMsg, setPagoEspEditMsg] = React.useState('');

  // Solicitudes
  const [solicitudes, setSolicitudes] = React.useState<any[]>([]);

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  const tokenHeaders = React.useCallback(
    async (): Promise<Record<string, string>> => {
      const token = user ? await user.getIdToken() : null;
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
    [user]
  );

  const loadCatalog = React.useCallback(async () => {
    const headers = await tokenHeaders();
    const res = await fetch('/api/admin/catalog', { headers });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.items)) {
      setCatalog(
        DEFAULT_CATALOG.map((d) => data.items.find((i: CatalogItem) => i.id === d.id) ?? d)
      );
    }
  }, [tokenHeaders]);

  const loadUsers = React.useCallback(async () => {
    const headers = await tokenHeaders();
    const res = await fetch('/api/admin/users', { headers });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.users)) setUsuarios(data.users);
  }, [tokenHeaders]);

  const loadPagos = React.useCallback(async () => {
    const headers = await tokenHeaders();
    const [resPagos, resEsp] = await Promise.all([
      fetch('/api/admin/pagos', { headers }),
      fetch('/api/admin/pagos-especialistas', { headers }),
    ]);
    if (resPagos.ok) {
      const data = await resPagos.json();
      if (Array.isArray(data.pagos)) setPagos(data.pagos);
    }
    if (resEsp.ok) {
      const data = await resEsp.json();
      if (Array.isArray(data.pagos)) setPagosEsp(data.pagos);
    }
  }, [tokenHeaders]);

  const loadSolicitudes = React.useCallback(async () => {
    const headers = await tokenHeaders();
    const res = await fetch('/api/admin/solicitudes', { headers });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.solicitudes)) setSolicitudes(data.solicitudes);
  }, [tokenHeaders]);

  React.useEffect(() => {
    if (!administracion || !user) return;
    const loaders: Record<TabKey, () => Promise<void>> = {
      catalog: loadCatalog,
      users: loadUsers,
      pagos: loadPagos,
      pagosEsp: loadPagos,
      solicitudes: loadSolicitudes,
    };
    loaders[tab]().catch(() => {});
  }, [administracion, user, tab, loadCatalog, loadUsers, loadPagos, loadSolicitudes]);

  async function saveCatalogItem(id: string, patch: Partial<CatalogItem>) {
    const headers = await tokenHeaders();
    const res = await fetch('/api/admin/catalog', {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) throw new Error('save failed');
    setCatalogMsg(t('Catálogo guardado. Los nuevos precios se aplican al siguiente pago.', 'Catalog saved. New prices apply on the next payment.'));
  }

  async function saveRoles() {
    if (!selUid) return;
    const headers = await tokenHeaders();
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: selUid, roles: selRoles, especialistaTemas: selTemas, certificado: selCert, accesoManualPremium: selAccesoPremium }),
    });
    if (!res.ok) {
      setRolesMsg(t('No se pudieron guardar los roles.', 'Could not save roles.'));
      return;
    }
    setRolesMsg(t('Roles guardados.', 'Roles saved.'));
    await loadUsers();
  }

  const usuariosFiltrados = React.useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => {
      const nombre = (u.name || '').toLowerCase();
      const correo = (u.email || '').toLowerCase();
      const empresa = (u.companyName || '').toLowerCase();
      return nombre.includes(q) || correo.includes(q) || empresa.includes(q);
    });
  }, [usuarios, userSearch]);

  async function setUserEstatus(uid: string, estatus: 'activo' | 'cancelado') {
    const headers = await tokenHeaders();
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, estatus }),
    });
    if (!res.ok) {
      setEstatusMsg(t('No se pudo cambiar el estatus.', 'Could not change status.'));
      return;
    }
    setEstatusMsg('');
    await loadUsers();
  }

  async function deleteUsuario(uid: string) {
    setDeletingUid(uid);
    const headers = await tokenHeaders();
    const res = await fetch(`/api/admin/users?uid=${encodeURIComponent(uid)}`, {
      method: 'DELETE',
      headers,
    });
    setDeletingUid('');
    setConfirmDeleteUid('');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setEstatusMsg(data?.error || t('No se pudo borrar el usuario.', 'Could not delete the user.'));
      return;
    }
    if (selUid === uid) setSelUid('');
    await loadUsers();
  }

  async function savePagoEsp() {
    const headers = await tokenHeaders();
    const res = await fetch('/api/admin/pagos-especialistas', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        especialistaUid: pagoEspForm.especialistaUid,
        monto: Number(pagoEspForm.monto),
        concepto: pagoEspForm.concepto,
        metodo: pagoEspForm.metodo,
        fechaPago: pagoEspForm.fechaPago || new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      setPagoEspMsg(t('No se pudo registrar el pago.', 'Could not register the payment.'));
      return;
    }
    setPagoEspMsg(t('Pago registrado.', 'Payment registered.'));
    setPagoEspForm({ especialistaUid: '', monto: '', concepto: 'Honorarios', metodo: 'Transferencia', fechaPago: '' });
    await loadPagos();
  }

  async function setPagoEspEstatus(id: string, estatus: 'activo' | 'cancelado') {
    const headers = await tokenHeaders();
    const res = await fetch('/api/admin/pagos-especialistas', {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estatus }),
    });
    if (res.ok) await loadPagos();
  }

  function startEditPagoEsp(p: any) {
    setEditPagoEspId(p.id);
    setEditPagoEspForm({
      monto: p.monto != null ? String(p.monto) : '',
      concepto: p.concepto || '',
      metodo: p.metodo || 'Transferencia',
      fechaPago: p.fechaPago ? String(p.fechaPago).slice(0, 10) : '',
    });
    setPagoEspEditMsg('');
  }

  async function guardarEdicionPagoEsp() {
    if (!editPagoEspId) return;
    const headers = await tokenHeaders();
    const res = await fetch('/api/admin/pagos-especialistas', {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editPagoEspId,
        monto: Number(editPagoEspForm.monto),
        concepto: editPagoEspForm.concepto,
        metodo: editPagoEspForm.metodo,
        fechaPago: editPagoEspForm.fechaPago || undefined,
      }),
    });
    if (!res.ok) {
      setPagoEspEditMsg(t('No se pudo guardar el cambio.', 'Could not save the change.'));
      return;
    }
    setEditPagoEspId('');
    setPagoEspEditMsg('');
    await loadPagos();
  }

  async function procesarSolicitud(id: string, aprobar: boolean) {
    const headers = await tokenHeaders();
    const res = await fetch('/api/admin/solicitudes', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, aprobar }),
    });
    if (res.ok) await loadSolicitudes();
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">{t('Cargando...', 'Loading...')}</div>;
  }
  if (!administracion) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-10 text-center">
        <h1 className="text-xl font-semibold">{t('Administración', 'Administration')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('No tienes permisos de administración.', 'You do not have administrator permissions.')}
        </p>
        <Button type="button" variant="outline" onClick={() => router.push(`/${routeLocale}/inicio`)}>
          {t('Ir al inicio', 'Go home')}
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('Administración', 'Administration')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Gestiona precios, roles, usuarios, pagos y solicitudes.', 'Manage prices, roles, users, payments and requests.')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TAB_DEFS.map((m) => (
            <Button
              key={m.key}
              type="button"
              variant={tab === m.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(m.key)}
            >
              {dispLang === 'en' ? m.en : m.es}
            </Button>
          ))}
        </div>

        {tab === 'catalog' && (
          <div className="space-y-4">
            {catalogMsg && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{catalogMsg}</p>}
            <div className="grid gap-4 md:grid-cols-2">
              {catalog.map((item) => (
                <CatalogCard
                  key={item.id}
                  item={item}
                  lang={dispLang}
                  onSave={(patch) =>
                    saveCatalogItem(item.id, patch).catch(() => setCatalogMsg(t('Error al guardar.', 'Save error.')))
                  }
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('Los precios y títulos se usan en los cobros de Mercado Pago. Si hay una promoción activa, se cobra el precio promocional.', 'Prices and titles are used in Mercado Pago charges. If a promotion is active, the promotional price is charged.')}
            </p>
          </div>
        )}

        {tab === 'users' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('Lista de usuarios', 'User list')}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('Usuarios con sus roles, empresa, madurez y actividad registrada en la aplicación.', 'Users with roles, company, maturity and app activity.')}
              </p>
            </div>

            <Input
              type="search"
              placeholder={t('Buscar por nombre, correo o empresa...', 'Search by name, email or company...')}
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="max-w-sm"
            />
            {estatusMsg && <p className="text-sm text-red-700">{estatusMsg}</p>}

            <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('Usuario', 'User')}</th>
                    <th className="px-3 py-2 font-medium">{t('Roles', 'Roles')}</th>
                    <th className="px-3 py-2 font-medium">{t('Estatus', 'Status')}</th>
                    <th className="px-3 py-2 font-medium">{t('Madurez', 'Maturity')}</th>
                    <th className="px-3 py-2 font-medium">{t('Actividad', 'Activity')}</th>
                    <th className="px-3 py-2 font-medium">{t('Plan', 'Plan')}</th>
                    <th className="px-3 py-2 font-medium">{t('Invertido', 'Invested')}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((u) => (
                    <tr key={u.uid} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{u.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(u.roles) && u.roles.map((r) => <RoleBadge key={r} role={r} lang={dispLang} />)}
                          {(!u.roles || u.roles.length === 0) && <span className="text-xs text-muted-foreground">{t('Usuario', 'User')}</span>}
                          {u.certificado && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
                              ✓ {t('Certificación MBE Corp', 'MBE Corp Certification')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <EstatusBadge estatus={u.estatus} t={t} />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {u.totalMaturity != null ? `${u.totalMaturity}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        <div>{t('Evaluaciones: ', 'Assessments: ') + (u.actividad?.assessments ?? 0)}</div>
                        <div>{t('Babel: ', 'Babel: ') + (u.actividad?.sesionesBabel ?? 0)}</div>
                        <div>{t('Pagos: ', 'Payments: ') + (u.actividad?.pagos ?? 0)}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {u.subscription === 'pro' && u.planStatus === 'active' ? (
                          <span className="text-emerald-700">{t('Pro activo', 'Pro active')}</span>
                        ) : u.planStatus === 'pending_cancellation' && u.planCancelaEn ? (
                          <span className="text-amber-700">
                            {t('Cancela el ', 'Cancels on ') +
                              new Date(u.planCancelaEn).toLocaleDateString(
                                dispLang === 'en' ? 'en-US' : 'es-MX'
                              )}
                          </span>
                        ) : u.accesoManualPremium ? (
                          <span className="text-teal-700">{t('Acceso manual', 'Manual access')}</span>
                        ) : (
                          <span>{u.subscription || 'free'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {typeof u.totalInvertido === 'number' && u.totalInvertido > 0
                          ? `$${u.totalInvertido.toLocaleString('es-MX')} MXN`
                          : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelUid(u.uid);
                              setSelRoles(Array.isArray(u.roles) ? u.roles : []);
                              setSelTemas(Array.isArray(u.especialistaTemas) ? u.especialistaTemas : []);
                              setSelCert(u.certificado === true);
                              setSelAccesoPremium(u.accesoManualPremium === true);
                            }}
                          >
                            {t('Asignar roles', 'Assign roles')}
                          </Button>
                          {u.estatus === 'cancelado' ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => setUserEstatus(u.uid, 'activo')}>
                              {t('Reactivar', 'Reactivate')}
                            </Button>
                          ) : (
                            <Button type="button" variant="outline" size="sm" onClick={() => setUserEstatus(u.uid, 'cancelado')}>
                              {t('Cancelar', 'Cancel')}
                            </Button>
                          )}
                          {confirmDeleteUid === u.uid ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-red-700">
                                {t('¿Borrar permanentemente?', 'Delete permanently?')}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-red-500 bg-red-600 text-white hover:bg-red-700"
                                disabled={deletingUid === u.uid}
                                onClick={() => deleteUsuario(u.uid)}
                              >
                                {deletingUid === u.uid ? t('Borrando...', 'Deleting...') : t('Sí, borrar', 'Yes, delete')}
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDeleteUid('')}>
                                {t('No', 'No')}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-red-700 hover:bg-red-50 dark:text-red-300"
                              onClick={() => setConfirmDeleteUid(u.uid)}
                            >
                              {t('Borrar', 'Delete')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {usuariosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        {usuarios.length === 0
                          ? t('Sin usuarios todavía.', 'No users yet.')
                          : t('Ningún usuario coincide con la búsqueda.', 'No users match your search.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selUid && (
              <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-foreground">{t('Asignar roles a usuario', 'Assign roles to user')}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {(() => {
                    const su = usuarios.find((x) => x.uid === selUid);
                    return su?.name || su?.email || selUid;
                  })()}
                </p>
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {APP_ROLES.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() =>
                          setSelRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
                        }
                        className={
                          'rounded-full border px-3 py-1 text-sm transition-colors ' +
                          (selRoles.includes(r)
                            ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300'
                            : 'border-slate-300 text-muted-foreground hover:border-teal-400 dark:border-slate-600')
                        }
                      >
                        {ROLE_LABELS[r][dispLang === 'en' ? 'en' : 'es']}
                      </button>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('Temas del especialista (si aplica):', 'Specialist themes (if applicable):')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {TEMAS_ESPECIALISTA.map((tm) => (
                        <button
                          key={tm}
                          type="button"
                          onClick={() =>
                            setSelTemas((prev) => (prev.includes(tm) ? prev.filter((x) => x !== tm) : [...prev, tm]))
                          }
                          className={
                            'rounded-full border px-3 py-1 text-xs transition-colors ' +
                            (selTemas.includes(tm)
                              ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                              : 'border-slate-300 text-muted-foreground hover:border-indigo-400 dark:border-slate-600')
                          }
                        >
                          {TEMA_LABELS[tm][dispLang === 'en' ? 'en' : 'es']}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <div>
                      <p className="text-sm font-medium text-foreground">{t('Certificación MBE Corp', 'MBE Corp Certification')}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('Marca la empresa como Empresa con Certificación MBE Corp (se muestra con insignia ✓ en Reference Place).', 'Mark the company as an MBE Corp Certified Company (shown with a ✓ badge in Reference Place).')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelCert((prev) => !prev)}
                      className={
                        'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ' +
                        (selCert
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-300 text-muted-foreground hover:border-emerald-400 dark:border-slate-600')
                      }
                    >
                      {selCert ? '✓ ' + t('Certificado', 'Certified') : t('Sin certificación', 'Not certified')}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <div>
                      <p className="text-sm font-medium text-foreground">{t('Acceso a Mundos Premium', 'Premium Worlds access')}</p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          'Otorga acceso a los Mundos Premium sin necesidad de que el usuario haya pagado el plan. Los administradores siempre tienen acceso.',
                          'Grants access to the Premium Worlds without the user having paid for the plan. Admins always have access.'
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelAccesoPremium((prev) => !prev)}
                      className={
                        'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ' +
                        (selAccesoPremium
                          ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300'
                          : 'border-slate-300 text-muted-foreground hover:border-teal-400 dark:border-slate-600')
                      }
                    >
                      {selAccesoPremium ? '✓ ' + t('Acceso otorgado', 'Access granted') : t('Sin acceso manual', 'No manual access')}
                    </button>
                  </div>
                  {rolesMsg && <p className="text-sm text-emerald-700">{rolesMsg}</p>}
                  <div className="flex gap-2">
                    <Button type="button" onClick={saveRoles}>
                      {t('Guardar roles', 'Save roles')}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setSelUid('')}>
                      {t('Cancelar', 'Cancel')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'pagos' && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">{t('Pagos recibidos (Mercado Pago)', 'Received payments (Mercado Pago)')}</h2>
            <div className="max-h-[480px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('Producto', 'Product')}</th>
                    <th className="px-3 py-2 font-medium">{t('Usuario', 'User')}</th>
                    <th className="px-3 py-2 font-medium">{t('Monto', 'Amount')}</th>
                    <th className="px-3 py-2 font-medium">{t('Estado', 'Status')}</th>
                    <th className="px-3 py-2 font-medium">{t('Fecha', 'Date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 text-muted-foreground">
                        {PRODUCTO_LABELS[p.productoId as keyof typeof PRODUCTO_LABELS]?.[dispLang === 'en' ? 'en' : 'es'] ?? p.productoId}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {(() => {
                          const up = usuarios.find((x) => x.uid === p.uid);
                          return up?.name || up?.email || p.uid;
                        })()}
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground">{fmtMoney(p.monto)}</td>
                      <td className="px-3 py-2">
                        <PagoStatusBadge status={p.status} t={t} />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(p.fechaPago ?? p.createdAt, dispLang)}</td>
                    </tr>
                  ))}
                  {pagos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        {t('Aún no se han recibido pagos.', 'No payments received yet.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'pagosEsp' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('Registrar pago a un especialista', 'Register a payment to a specialist')}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('Registra los pagos que haces a los especialistas por sus servicios.', 'Register the payments you make to specialists for their services.')}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Select
                value={pagoEspForm.especialistaUid}
                onChange={(e) => setPagoEspForm((f) => ({ ...f, especialistaUid: e.target.value }))}
              >
                <option value="">{t('Especialista', 'Specialist')}</option>
                {usuarios
                  .filter((u) => Array.isArray(u.roles) && u.roles.includes('especialista'))
                  .map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.name || u.email || u.uid}
                    </option>
                  ))}
              </Select>
              <Input
                type="number"
                min="0"
                placeholder={t('Monto MXN', 'Amount MXN')}
                value={pagoEspForm.monto}
                onChange={(e) => setPagoEspForm((f) => ({ ...f, monto: e.target.value }))}
              />
              <Input
                placeholder={t('Concepto', 'Concept')}
                value={pagoEspForm.concepto}
                onChange={(e) => setPagoEspForm((f) => ({ ...f, concepto: e.target.value }))}
              />
              <Select
                value={pagoEspForm.metodo}
                onChange={(e) => setPagoEspForm((f) => ({ ...f, metodo: e.target.value }))}
              >
                <option value="Transferencia">Transferencia</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta</option>
              </Select>
              <Button type="button" onClick={savePagoEsp}>
                {t('Registrar', 'Register')}
              </Button>
            </div>
            {pagoEspMsg && <p className="text-sm text-emerald-700">{pagoEspMsg}</p>}

            <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('Especialista', 'Specialist')}</th>
                    <th className="px-3 py-2 font-medium">{t('Monto', 'Amount')}</th>
                    <th className="px-3 py-2 font-medium">{t('Concepto', 'Concept')}</th>
                    <th className="px-3 py-2 font-medium">{t('Método', 'Method')}</th>
                    <th className="px-3 py-2 font-medium">{t('Fecha', 'Date')}</th>
                    <th className="px-3 py-2 font-medium">{t('Estatus', 'Status')}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {pagosEsp.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 text-muted-foreground">
                        {(() => {
                          const ue = usuarios.find((x) => x.uid === p.especialistaUid);
                          return p.especialistaNombre || ue?.name || ue?.email || p.especialistaUid;
                        })()}
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground">{fmtMoney(p.monto)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.concepto ?? '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.metodo ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(p.fechaPago ?? p.createdAt, dispLang)}</td>
                      <td className="px-3 py-2">
                        <EstatusBadge estatus={p.estatus} t={t} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Button type="button" variant="outline" size="sm" onClick={() => startEditPagoEsp(p)}>
                            {t('Editar', 'Edit')}
                          </Button>
                          {p.estatus === 'cancelado' ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => setPagoEspEstatus(p.id, 'activo')}>
                              {t('Reactivar', 'Reactivate')}
                            </Button>
                          ) : (
                            <Button type="button" variant="outline" size="sm" onClick={() => setPagoEspEstatus(p.id, 'cancelado')}>
                              {t('Cancelar', 'Cancel')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pagosEsp.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        {t('Sin pagos registrados.', 'No payments registered yet.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {editPagoEspId && (
              <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-foreground">{t('Modificar pago', 'Edit payment')}</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <Label>{t('Monto MXN', 'Amount MXN')}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editPagoEspForm.monto}
                      onChange={(e) => setEditPagoEspForm((f) => ({ ...f, monto: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('Concepto', 'Concept')}</Label>
                    <Input
                      value={editPagoEspForm.concepto}
                      onChange={(e) => setEditPagoEspForm((f) => ({ ...f, concepto: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('Método', 'Method')}</Label>
                    <Select
                      value={editPagoEspForm.metodo}
                      onChange={(e) => setEditPagoEspForm((f) => ({ ...f, metodo: e.target.value }))}
                    >
                      <option value="Transferencia">Transferencia</option>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Tarjeta">Tarjeta</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{t('Fecha', 'Date')}</Label>
                    <Input
                      type="date"
                      value={editPagoEspForm.fechaPago}
                      onChange={(e) => setEditPagoEspForm((f) => ({ ...f, fechaPago: e.target.value }))}
                    />
                  </div>
                </div>
                {pagoEspEditMsg && <p className="mt-3 text-sm text-red-700">{pagoEspEditMsg}</p>}
                <div className="mt-4 flex gap-2">
                  <Button type="button" onClick={guardarEdicionPagoEsp}>
                    {t('Guardar cambios', 'Save changes')}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditPagoEspId('')}>
                    {t('Cancelar', 'Cancel')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'solicitudes' && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">{t('Solicitudes para ser especialista o rep sale', 'Requests to become a specialist or rep sale')}</h2>
            <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('Usuario', 'User')}</th>
                    <th className="px-3 py-2 font-medium">{t('Tipo', 'Type')}</th>
                    <th className="px-3 py-2 font-medium">{t('Temas', 'Themes')}</th>
                    <th className="px-3 py-2 font-medium">{t('Estado', 'Status')}</th>
                    <th className="px-3 py-2 font-medium">{t('Fecha', 'Date')}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {solicitudes.map((s) => (
                    <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">
                        {(() => {
                          const us = usuarios.find((x) => x.uid === s.uid);
                          const nombreMostrar = s.nombre || us?.name || us?.email || s.uid;
                          const correoMostrar = s.email || us?.email;
                          return (
                            <>
                              <div className="font-medium text-foreground">{nombreMostrar || '—'}</div>
                              {correoMostrar && <div className="text-xs text-muted-foreground">{correoMostrar}</div>}
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {s.tipo === 'especialista' ? t('Especialista', 'Specialist') : t('Rep Sale', 'Rep Sale')}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {Array.isArray(s.temas) && s.temas.length > 0
                          ? s.temas.map((tm: string) => TEMA_LABELS[tm as keyof typeof TEMA_LABELS]?.[dispLang === 'en' ? 'en' : 'es'] ?? tm).join(', ')
                          : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <SolicitudBadge estado={s.estado} t={t} />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(s.createdAt, dispLang)}</td>
                      <td className="px-3 py-2">
                        {s.estado === 'pendiente' && (
                          <div className="flex gap-1.5">
                            <Button type="button" size="sm" onClick={() => procesarSolicitud(s.id, true)}>
                              {t('Aprobar', 'Approve')}
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => procesarSolicitud(s.id, false)}>
                              {t('Rechazar', 'Reject')}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {solicitudes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        {t('No hay solicitudes.', 'No requests yet.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CatalogCard({
  item,
  lang,
  onSave,
}: {
  item: CatalogItem;
  lang: 'es' | 'en';
  onSave: (patch: Partial<CatalogItem>) => void;
}) {
  const [precio, setPrecio] = React.useState(String(item.precio));
  const [promo, setPromo] = React.useState(item.promocion == null ? '' : String(item.promocion));
  const [promoActiva, setPromoActiva] = React.useState(item.promocionActiva);
  const [activo, setActivo] = React.useState(item.activo);
  const [saving, setSaving] = React.useState(false);
  const [titulo, setTitulo] = React.useState(item.titulo);
  const [tituloEn, setTituloEn] = React.useState(item.tituloEn);

  React.useEffect(() => {
    setPrecio(String(item.precio));
    setPromo(item.promocion == null ? '' : String(item.promocion));
    setPromoActiva(item.promocionActiva);
    setActivo(item.activo);
    setTitulo(item.titulo);
    setTituloEn(item.tituloEn);
  }, [item]);

  const label = (es: string, en: string) => (lang === 'en' ? en : es);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="font-semibold text-foreground">
        {PRODUCTO_LABELS[item.id as keyof typeof PRODUCTO_LABELS]?.[lang] ?? item.id}
      </h3>
      <div className="mt-3 space-y-2.5">
        <div className="space-y-1">
          <Label>{label('Título (es)', 'Title (es)')}</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>{label('Título (en)', 'Title (en)')}</Label>
          <Input value={tituloEn} onChange={(e) => setTituloEn(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label>{label('Precio (MXN)', 'Price (MXN)')}</Label>
            <Input type="number" min="0" value={precio} onChange={(e) => setPrecio(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{label('Precio promocional', 'Promo price')}</Label>
            <Input type="number" min="0" placeholder="—" value={promo} onChange={(e) => setPromo(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={promoActiva} onChange={(e) => setPromoActiva(e.target.checked)} />
            {label('Promoción activa', 'Promo active')}
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            {label('Activo', 'Active')}
          </label>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={() => {
            setSaving(true);
            onSave({
              precio: Number(precio) || 0,
              promocion: promo === '' ? null : Number(promo) || 0,
              promocionActiva: promoActiva,
              activo,
              titulo,
              tituloEn,
            });
            setTimeout(() => setSaving(false), 600);
          }}
        >
          {saving ? label('Guardando...', 'Saving...') : label('Guardar', 'Save')}
        </Button>
      </div>
    </div>
  );
}