// Datos y utilidades del tablero "Convocatorias y fondos" (port de
// github.com/barbeltran-design/convocatorias-ods). Los textos de las
// convocatorias quedan en español (son datos del proyecto original);
// las etiquetas de la UI son es/en desde el builder.

import RAW from './convocatorias-data.json';

export interface CriteriosConvocatoria {
  alcance_geo: string | null;
  estado: string | null;
  tipos_elegibles: string[];
  ods_num: number[];
  edad_min: number | null;
  edad_max: number | null;
  anios_min_operacion: number | null;
  anios_max_operacion: number | null;
  liderazgo: string | null;
}

export interface Convocatoria {
  convocatoria: string;
  tipo: string;
  ambito: string;
  ods: string;
  descripcion: string;
  requisitos: string;
  monto: string;
  fecha_limite: string;
  estatus: string;
  liga: string;
  criterios?: CriteriosConvocatoria | null;
}

export const DATOS_CONVOCATORIAS: Convocatoria[] = RAW as Convocatoria[];

export const TIPO_LBL: Record<string, string> = {
  osc: 'OSC / asociaciones civiles',
  empresa: 'empresas o microempresas',
  emprendimiento_operacion: 'emprendimientos en operacion',
  emprendimiento_idea: 'proyectos en etapa de idea',
  persona_fisica: 'personas fisicas / profesionistas',
  academia: 'equipos de investigacion / academia',
  comunidad_indigena: 'comunidades o grupos indigenas',
};

export const ODS_NAMES: Record<number, string> = {
  1: 'Fin de la pobreza',
  2: 'Hambre cero',
  3: 'Salud y bienestar',
  4: 'Educacion de calidad',
  5: 'Igualdad de genero',
  6: 'Agua limpia y saneamiento',
  7: 'Energia asequible y no contaminante',
  8: 'Trabajo decente y crecimiento economico',
  9: 'Industria, innovacion e infraestructura',
  10: 'Reduccion de las desigualdades',
  11: 'Ciudades y comunidades sostenibles',
  12: 'Produccion y consumo responsables',
  13: 'Accion por el clima',
  14: 'Vida submarina',
  15: 'Vida de ecosistemas terrestres',
  16: 'Paz, justicia e instituciones solidas',
  17: 'Alianzas para lograr los objetivos',
};

export const ESTADOS_MX: string[] = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
  'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México',
  'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit',
  'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
  'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán',
  'Zacatecas', 'Fuera de México',
];

export interface FuenteInfo {
  nombre: string;
  descripcion: string;
  url: string;
}

export interface SeccionFuentes {
  titulo: string;
  items: FuenteInfo[];
}

export const FUENTES: SeccionFuentes[] = [
  {
    titulo: 'Buscadores internacionales de fondos (guia de las 8 plataformas)',
    items: [
      { nombre: 'GrantStation', descripcion: '6,000+ fondos internacionales; lista inicial amplia. ~USD 119/año.', url: 'https://grantstation.com' },
      { nombre: 'FundsForNGOs', descripcion: 'Historico de donaciones de fundaciones; sirve para validar al donante. ~USD 360/año.', url: 'https://www.fundsforngos.org' },
      { nombre: 'Devex · Funding', descripcion: 'Contratos de cooperacion y convocatorias; rastreo diario. USD 240–1,500/año.', url: 'https://www.devex.com/funding' },
      { nombre: 'Candid · Foundation Directory', descripcion: 'Base mundial de fundaciones privadas y patrones de inversion. USD 419–1,499/año.', url: 'https://candid.org' },
      { nombre: 'Portal UE · Funding & Tenders', descripcion: 'Convocatorias de la Union Europea (Horizon, LIFE, EUROCLIMA+). Gratis.', url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home' },
      { nombre: 'Banco Mundial · eConsultant2', descripcion: 'Contratos de consultoria de USD 200k a 2M. Gratis con registro.', url: 'https://wbgeconsult2.worldbank.org' },
      { nombre: 'Climate Funds Update', descripcion: 'Finanzas climaticas (Fondo Verde, GEF) con flujos por pais. Gratis.', url: 'https://climatefundsupdate.org' },
      { nombre: 'TerraViva Grants Directory', descripcion: 'Fondos ambientales, agricolas y rurales para Latinoamerica. Gratis.', url: 'https://www.terravivagrants.org' },
    ],
  },
  {
    titulo: 'Agregadores de convocatorias en America Latina',
    items: [
      { nombre: 'Innpactia', descripcion: '25 mil+ organizaciones; subvenciones, premios y becas en español, ordenados por ODS.', url: 'https://innpactia.com' },
      { nombre: 'Fondos y Convocatorias MX', descripcion: 'Listado muy amplio en México (incluye gobierno y todos los sectores).', url: 'https://fondosyconvocatorias.com.mx/convocatorias/' },
      { nombre: 'Rossel Consultores', descripcion: 'Convocatorias y fondos para OSC y proyectos sociales.', url: 'https://www.rosselconsultores.org/convocatorias' },
      { nombre: 'Difusión con Causa', descripcion: 'Convocatorias de fondos y premios para OSC en México y la region.', url: 'https://difusionconcausa.com/convocatorias/' },
    ],
  },
  {
    titulo: 'Inteligencia: cuánto dinero entra a México y quién lo entrega',
    items: [
      { nombre: 'IATI Country Data · México', descripcion: 'Datos abiertos de la cooperacion que recibe México: montos, donantes y sectores.', url: 'https://countrydata.iatistandard.org/es/data/recipient-country-or-region/MX/' },
    ],
  },
  {
    titulo: 'Plataformas de fondos en EE.UU. / en inglés (revisar elegibilidad internacional)',
    items: [
      { nombre: 'Grants.gov', descripcion: 'Portal oficial de subvenciones del gobierno de EE.UU. Algunas abiertas a organizaciones extranjeras. Gratis.', url: 'https://www.grants.gov' },
      { nombre: 'Hello Alice', descripcion: 'Plataforma para dueñas/os de pequeños negocios: grants y financiamiento. Enfoque EE.UU. Gratis con registro.', url: 'https://helloalice.com' },
      { nombre: 'GrantWatch', descripcion: 'Gran directorio de grants (EE.UU./Canadá y algunos internacionales). Suscripcion de pago.', url: 'https://www.grantwatch.com' },
      { nombre: 'The Grant Portal', descripcion: 'Directorio de grants y fundaciones, enfoque EE.UU. Suscripcion de pago.', url: 'https://www.thegrantportal.com' },
      { nombre: 'USA Funding Applications', descripcion: 'Agregador de grants y apoyos en EE.UU. Suscripcion (verifica antes de pagar).', url: 'https://www.usafundingapplications.org' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Calculos en tiempo real (como hacia generar_pagina.py al generar el HTML,
// pero vivos: el estatus "Abierta/Cerrada" se calcula contra la fecha de hoy).
// ---------------------------------------------------------------------------

export function estatusReal(c: Convocatoria, hoy: Date): string {
  const d = parseFechaLimite(c.fecha_limite);
  if (d) return d >= hoy ? 'Abierta' : 'Cerrada';
  return c.estatus || '';
}

export function diasRestantes(c: Convocatoria, hoy: Date): number | null {
  const d = parseFechaLimite(c.fecha_limite);
  if (!d) return null;
  return Math.round((d.getTime() - hoy.getTime()) / 86400000);
}

function parseFechaLimite(txt: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(txt)) return null;
  const d = new Date(txt + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

export function estatusYdias(c: Convocatoria, hoy: Date): { estatus: string; dias: number | null } {
  return { estatus: estatusReal(c, hoy), dias: diasRestantes(c, hoy) };
}

/**
 * Grupo de estatus para ordenar el catálogo: Abierta con fecha → Abierta
 * (permanente) → Anual (por confirmar) → Variable → otros sin fecha → Cerrada.
 * Devuelve [grupo, subClave] donde subClave = días restantes dentro del grupo.
 */
function grupoEstatus(c: Convocatoria, hoy: Date): [number, number] {
  const est = estatusReal(c, hoy);
  const d = diasRestantes(c, hoy) ?? 0;
  if (est === 'Cerrada' || est.startsWith('Cerrada')) return [5, d];
  if (est === 'Abierta') return [0, d];
  if (est.startsWith('Abierta')) return [1, d];
  if (est.startsWith('Anual')) return [2, d];
  if (est === 'Variable') return [3, d];
  return [4, d];
}

export function ordenarPorVencimiento(lista: Convocatoria[], hoy: Date): Convocatoria[] {
  const clave = (c: Convocatoria): [number, number] => grupoEstatus(c, hoy);
  return [...lista].sort((a, b) => {
    const [ka1, ka2] = clave(a);
    const [kb1, kb2] = clave(b);
    if (ka1 !== kb1) return ka1 - kb1;
    return ka2 - kb2;
  });
}

export interface MontoEstimado {
  usd: string;
  mxn: string;
  parts: string;
}

export function calcularMontoAbiertas(datos: Convocatoria[], hoy: Date): MontoEstimado {
  const fmt = (v: number): string => {
    if (v >= 1e6) {
      const m = (v / 1e6).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
      return m + ' M';
    }
    if (v >= 1e3) return Math.round(v / 1e3) + ' k';
    return '' + v;
  };
  let usd = 0;
  let mxn = 0;
  for (const c of datos) {
    if (!estatusReal(c, hoy).startsWith('Abierta')) continue;
    const low = (c.monto || '').toLowerCase();
    const re = /(\d[\d.,]*)\s*(millones|millón|mill)?/g;
    let m: RegExpExecArray | null;
    const vals: number[] = [];
    while ((m = re.exec(low))) {
      let num = parseFloat(m[1].replace(/,/g, ''));
      if (isNaN(num)) continue;
      if (m[2]) num *= 1e6;
      if (num < 1000) continue;
      vals.push(num);
    }
    if (!vals.length) continue;
    const val = Math.max(...vals);
    const isMXN = low.includes('mxn') || low.includes('peso');
    const isUSD = low.includes('usd') || low.includes('dólar') || low.includes('dolar') || low.includes('us$');
    if (isMXN && !isUSD) mxn += val;
    else usd += val;
  }
  const parts: string[] = [];
  if (usd) parts.push('≈ ' + fmt(usd) + ' USD');
  if (mxn) parts.push(fmt(mxn) + ' MXN');
  return { usd: fmt(usd), mxn: fmt(mxn), parts: parts.join(' · ') || '—' };
}

// ---------------------------------------------------------------------------
// Evaluacion de elegibilidad con el perfil de la organizacion.
// ---------------------------------------------------------------------------

export interface PerfilBusqueda {
  tipo: string;
  estado: string;
  anios: number | null;
  edad: number | null;
  ods: number[];
  mujeres: boolean;
  indigenas: boolean;
}

export interface Evaluacion {
  elegible: boolean;
  no: string[];
  si: string[];
  odsMatch: number;
}

export function evaluarConvocatoria(c: Convocatoria, perfil: PerfilBusqueda): Evaluacion {
  const cr = c.criterios || ({} as CriteriosConvocatoria);
  const no: string[] = [];
  const si: string[] = [];
  if (cr.alcance_geo === 'estatal') {
    if (perfil.estado && cr.estado && perfil.estado !== cr.estado) no.push('Solo para el estado de ' + cr.estado);
    else if (cr.estado) si.push('Disponible en ' + cr.estado);
  } else if (cr.alcance_geo === 'mexico') {
    if (perfil.estado === 'Fuera de México') no.push('Solo para organizaciones en México');
    else si.push('Abierta a organizaciones en México');
  } else if (cr.alcance_geo === 'internacional') {
    si.push('Convocatoria internacional (México incluido)');
  }
  if (Array.isArray(cr.tipos_elegibles) && cr.tipos_elegibles.length) {
    if (perfil.tipo && !cr.tipos_elegibles.includes(perfil.tipo))
      no.push('Dirigida a: ' + cr.tipos_elegibles.map((t) => TIPO_LBL[t] || t).join(', '));
    else if (perfil.tipo) si.push('Aplica a tu tipo de organización');
  }
  if (cr.edad_max != null && perfil.edad != null && perfil.edad > cr.edad_max)
    no.push('Edad máxima del responsable: ' + cr.edad_max + ' años');
  if (cr.edad_min != null && perfil.edad != null && perfil.edad < cr.edad_min)
    no.push('Edad mínima del responsable: ' + cr.edad_min + ' años');
  if (cr.anios_min_operacion != null && perfil.anios != null && perfil.anios < cr.anios_min_operacion)
    no.push('Requiere al menos ' + cr.anios_min_operacion + ' años de operación');
  if (cr.anios_max_operacion != null && perfil.anios != null && perfil.anios > cr.anios_max_operacion)
    no.push('Para proyectos con máximo ' + cr.anios_max_operacion + ' años de operación');
  if (cr.liderazgo === 'mujeres_indigenas' && !perfil.indigenas)
    no.push('Exclusiva para mujeres/comunidades indígenas');
  if (cr.liderazgo === 'mujeres' && !perfil.mujeres && !perfil.indigenas)
    no.push('Dirigida a proyectos liderados por mujeres');
  let odsMatch = 0;
  if (perfil.ods.length && Array.isArray(cr.ods_num) && cr.ods_num.length) {
    const inter = cr.ods_num.filter((n) => perfil.ods.includes(n));
    odsMatch = inter.length;
    if (inter.length) si.push('Coincide en ODS ' + inter.join(', '));
  }
  return { elegible: no.length === 0, no, si, odsMatch };
}
