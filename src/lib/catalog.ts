import { PRODUCTO_LABELS, PRODUCTOS_PAGO, type ProductoPago } from '@/lib/roles';

// ─────────────────────────────────────────────────────────────────────────
// Catálogo de precios y promociones.
//
// Fuente de verdad: colección `catalog/{productoId}` en Firestore
// (docs con { titulo, tituloEn, precio, promocion, promocionActiva,
//   activo, updatedAt }), administrada desde /admin.
// Estos valores son SOLO los defaults iniciales (primera vez que existe
// la plataforma, o si el doc aún no se creó).
// ─────────────────────────────────────────────────────────────────────────

export interface CatalogItem {
  id: string;
  titulo: string;
  tituloEn: string;
  precio: number;
  moneda: 'MXN';
  promocion: number | null; // precio promocional (null = sin promo)
  promocionActiva: boolean;
  activo: boolean;
  updatedAt: string;
}

export const DEFAULT_CATALOG: CatalogItem[] = [
  {
    id: 'plan_mensual',
    titulo: 'MBE Corpilot AI — Plan completo',
    tituloEn: 'MBE Corpilot AI — Full plan',
    precio: 99,
    moneda: 'MXN',
    promocion: null,
    promocionActiva: false,
    activo: true,
    updatedAt: '',
  },
  {
    id: 'apoyo_ondemand',
    titulo: 'Apoyo On Demand',
    tituloEn: 'On Demand Support',
    precio: 4000,
    moneda: 'MXN',
    promocion: null,
    promocionActiva: false,
    activo: true,
    updatedAt: '',
  },
  {
    id: 'certificacion_mbe',
    titulo: 'Certificación MBE',
    tituloEn: 'MBE Certification',
    precio: 5000,
    moneda: 'MXN',
    promocion: null,
    promocionActiva: false,
    activo: true,
    updatedAt: '',
  },
  {
    id: 'paquete_especialista',
    titulo: 'Paquete de Especialista',
    tituloEn: 'Specialist Package',
    precio: 10000,
    moneda: 'MXN',
    promocion: null,
    promocionActiva: false,
    activo: true,
    updatedAt: '',
  },
];

export function defaultCatalogItem(productoId: string): CatalogItem | undefined {
  return DEFAULT_CATALOG.find((c) => c.id === productoId);
}

export function productIdValido(productoId: string): productoId is ProductoPago {
  return (PRODUCTOS_PAGO as readonly string[]).includes(productoId);
}

export function productoLabel(productoId: string, lang: 'es' | 'en'): string {
  const lbl = (PRODUCTO_LABELS as Record<string, { es: string; en: string }>)[productoId];
  if (lbl) return lang === 'en' ? lbl.en : lbl.es;
  return productoId;
}
