import type { DimensionId } from '@/lib/maturity-dimensions';

// Roles y temas del ecosistema MBE (cliente y servidor).

export const APP_ROLES = ['admin', 'rep_sale', 'especialista', 'usuario'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, { es: string; en: string }> = {
  admin: { es: 'Administración', en: 'Administration' },
  rep_sale: { es: 'Rep Sale', en: 'Rep Sale' },
  especialista: { es: 'Especialista', en: 'Specialist' },
  usuario: { es: 'Usuario', en: 'User' },
};

export const TEMAS_ESPECIALISTA = [
  'rumbo_estrategico',
  'finanzas',
  'marketing_ventas',
  'atencion_cliente',
  'cumplimiento_legal',
  'cumplimiento_fiscal',
  'operacion',
  'conocimiento',
  'alianzas',
  'socioambiental',
  'capital_humano',
  'cultura',
  'convocatorias_certificacion',
] as const;
export type TemaEspecialista = (typeof TEMAS_ESPECIALISTA)[number];

export const TEMA_LABELS: Record<TemaEspecialista, { es: string; en: string }> = {
  rumbo_estrategico: { es: 'Rumbo Estratégico', en: 'Strategic Direction' },
  finanzas: { es: 'Finanzas', en: 'Finance' },
  marketing_ventas: { es: 'Marketing y Ventas', en: 'Marketing & Sales' },
  atencion_cliente: { es: 'Atención al Cliente', en: 'Customer Service' },
  cumplimiento_legal: { es: 'Cumplimiento Normativo Legal', en: 'Legal Compliance' },
  cumplimiento_fiscal: { es: 'Cumplimiento Normativo Fiscal', en: 'Tax Compliance' },
  operacion: { es: 'Operación', en: 'Operations' },
  conocimiento: { es: 'Conocimiento', en: 'Knowledge' },
  alianzas: { es: 'Alianzas', en: 'Alliances' },
  socioambiental: { es: 'Enfoque SocioAmbiental Congruente', en: 'Congruent Socio-Environmental Focus' },
  capital_humano: { es: 'Capital Humano', en: 'Human Capital' },
  cultura: { es: 'Cultura Organizacional', en: 'Organizational Culture' },
  convocatorias_certificacion: { es: 'Convocatorias y Certificación', en: 'Grants & Certification' },
};

// Productos de pago sincronizados con el catálogo de precios de administración.
export const PRODUCTOS_PAGO = [
  'plan_mensual',
  'apoyo_ondemand',
  'certificacion_mbe',
  'paquete_especialista',
] as const;
export type ProductoPago = (typeof PRODUCTOS_PAGO)[number];

export const PRODUCTO_LABELS: Record<ProductoPago, { es: string; en: string }> = {
  plan_mensual: { es: 'Plan Mensual Corpilot', en: 'Corpilot Monthly Plan' },
  apoyo_ondemand: { es: 'Apoyo On Demand', en: 'On Demand Support' },
  certificacion_mbe: { es: 'Certificación MBE', en: 'MBE Certification' },
  paquete_especialista: { es: 'Paquete de Especialista', en: 'Specialist Package' },
};

export function hasRole(roles: string[] | undefined, role: AppRole): boolean {
  return Array.isArray(roles) && roles.includes(role);
}

// Cada tema de especialista corresponde a una dimensión de madurez
// (DimensionId), salvo convocatorias_certificacion que no tiene dimensión.
export const TEMA_A_DIMENSION: Record<string, DimensionId | null> = {
  rumbo_estrategico: 'strategic',
  finanzas: 'finance',
  marketing_ventas: 'sales',
  atencion_cliente: 'customerService',
  cumplimiento_legal: 'compliance',
  cumplimiento_fiscal: 'compliance',
  operacion: 'operations',
  conocimiento: 'knowledge',
  alianzas: 'alliances',
  socioambiental: 'esg',
  capital_humano: 'hr',
  cultura: 'culture',
  convocatorias_certificacion: null,
};

export function dimensionDeTema(tema: string): DimensionId | null {
  return TEMA_A_DIMENSION[tema] ?? null;
}

export function esAdmin(roles: string[] | undefined): boolean {
  return hasRole(roles, 'admin');
}

export function esEspecialista(roles: string[] | undefined): boolean {
  return hasRole(roles, 'especialista');
}

export function esRepSale(roles: string[] | undefined): boolean {
  return hasRole(roles, 'rep_sale');
}

// ---------------------------------------------------------------------------
// Administración por sección: un usuario puede tener facultades de
// administrador SOLO para pestañas específicas del panel /admin sin ser
// administrador general. Se guarda en users/{uid}.adminSecciones (array de
// claves de SECCIONES_ADMIN). Un 'admin' general siempre pasa; un admin de
// sección solo ve/edita su pestaña. La asignación de secciones (y de roles)
// queda reservada al admin general para evitar escalamiento de privilegios.
// ---------------------------------------------------------------------------

// Las claves coinciden con las pestañas del panel (TabKey en admin/page.tsx).
export const SECCIONES_ADMIN = [
  'catalog',
  'users',
  'pagos',
  'pagosEsp',
  'solicitudes',
  'refplace',
  'convocatorias',
  'club',
] as const;
export type SeccionAdmin = (typeof SECCIONES_ADMIN)[number];

export const SECCION_ADMIN_LABELS: Record<SeccionAdmin, { es: string; en: string }> = {
  catalog: { es: 'Precios y promociones', en: 'Prices & promotions' },
  users: { es: 'Usuarios', en: 'Users' },
  pagos: { es: 'Pagos recibidos', en: 'Received payments' },
  pagosEsp: { es: 'Pagos a especialistas', en: 'Specialist payments' },
  solicitudes: { es: 'Solicitudes de rol', en: 'Role requests' },
  refplace: { es: 'Referencias (Reference Place)', en: 'Referrals (Reference Place)' },
  convocatorias: { es: 'Convocatorias', en: 'Funding calls' },
  club: { es: 'Club: puntos y niveles', en: 'Club: points & levels' },
};

export function esAdminDeSeccion(
  roles: string[] | undefined,
  adminSecciones: string[] | undefined,
  seccion: SeccionAdmin
): boolean {
  if (esAdmin(roles)) return true;
  return Array.isArray(adminSecciones) && adminSecciones.includes(seccion);
}

// ¿Tiene facultades administrativas en ALGUNA sección? Se usa para decidir si
// puede entrar al panel /admin aunque no sea admin general.
export function tieneAlgunaSeccionAdmin(adminSecciones: string[] | undefined): boolean {
  return Array.isArray(adminSecciones) && adminSecciones.length > 0;
}
