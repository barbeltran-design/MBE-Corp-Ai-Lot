// Catalogo de Buenas Practicas de negocio (fase 1 de un catalogo mayor).
// Cada practica tiene el Tema (que coincide con los temas de la Evaluacion
// de Madurez), la Buena Practica, la Perspectiva del BSC que impacta y el
// Mentor sugerido (Babel, Fisnando, Karmetin, Normau, Atech, Ecori).
//
// Se usa como contexto estatico en la ruta /api/babel/extractor-plan-accion
// (paso 'acciones') para que Babel proponga acciones alineadas con el
// catalogo. En una fase 2, este catalogo crecera y cada mentor podra
// sugerir practicas directamente.
export interface BuenaPractica {
  tema: string;
  practica: string;
  perspectiva: string;
  mentor: string;
}

export const BUENAS_PRACTICAS: BuenaPractica[] = [
  // Orden de los temas = orden de la Evaluación de Madurez.
  { tema: 'Rumbo Estrategico', practica: 'Reflexion estrategica', perspectiva: 'Financiera', mentor: 'Babel' },
  { tema: 'Finanzas', practica: 'Breakeven mensual', perspectiva: 'Financiera', mentor: 'Fisnando' },
  { tema: 'Finanzas', practica: 'Cash Flow proyectado a 12 meses', perspectiva: 'Financiera', mentor: 'Fisnando' },
  { tema: 'Finanzas', practica: 'Control de gastos fijos', perspectiva: 'Financiera', mentor: 'Fisnando' },
  { tema: 'Finanzas', practica: 'Politica de precios', perspectiva: 'Financiera', mentor: 'Fisnando' },
  { tema: 'Finanzas', practica: 'Descuentos por pronto pago', perspectiva: 'Financiera', mentor: 'Fisnando' },
  { tema: 'Finanzas', practica: 'Facturacion electronica automatizada', perspectiva: 'Financiera', mentor: 'Fisnando' },
  { tema: 'Finanzas', practica: 'Separacion de cuentas personales/negocio', perspectiva: 'Financiera', mentor: 'Fisnando' },
  { tema: 'Finanzas', practica: 'Metricas de indicadores', perspectiva: 'Financiera', mentor: 'Fisnando' },
  { tema: 'Marketing y Ventas', practica: 'Plan de marketing', perspectiva: 'Clientes', mentor: 'Karmetin' },
  { tema: 'Marketing y Ventas', practica: 'Embudo de ventas', perspectiva: 'Clientes', mentor: 'Karmetin' },
  { tema: 'Marketing y Ventas', practica: 'Segmentacion y perfil de cliente', perspectiva: 'Clientes', mentor: 'Karmetin' },
  { tema: 'Marketing y Ventas', practica: 'Redes sociales y contenido', perspectiva: 'Clientes', mentor: 'Karmetin' },
  { tema: 'Marketing y Ventas', practica: 'Promociones y descuentos controlados', perspectiva: 'Clientes', mentor: 'Karmetin' },
  { tema: 'Marketing y Ventas', practica: 'CRM basico', perspectiva: 'Clientes', mentor: 'Karmetin' },
  { tema: 'Marketing y Ventas', practica: 'Ventas consultivas', perspectiva: 'Clientes', mentor: 'Karmetin' },
  { tema: 'Atencion al Cliente', practica: 'Encuestas de satisfaccion', perspectiva: 'Clientes', mentor: 'Karmetin' },
  { tema: 'Atencion al Cliente', practica: 'Quejas y reclamos gestionados', perspectiva: 'Clientes', mentor: 'Karmetin' },
  { tema: 'Atencion al Cliente', practica: 'Seguimiento post-venta', perspectiva: 'Clientes', mentor: 'Karmetin' },
  { tema: 'Cumplimiento Normativo', practica: 'Legalizacion y permisos', perspectiva: 'Procesos Internos', mentor: 'Normau' },
  { tema: 'Cumplimiento Normativo', practica: 'Contratos y polizas', perspectiva: 'Procesos Internos', mentor: 'Normau' },
  { tema: 'Cumplimiento Normativo', practica: 'Proteccion de datos', perspectiva: 'Procesos Internos', mentor: 'Normau' },
  { tema: 'Cumplimiento Normativo', practica: 'Cumplimiento fiscal', perspectiva: 'Procesos Internos', mentor: 'Normau' },
  { tema: 'Operacion', practica: 'Procesos documentados', perspectiva: 'Procesos Internos', mentor: 'Atech' },
  { tema: 'Operacion', practica: 'Organigrama y responsabilidades', perspectiva: 'Procesos Internos', mentor: 'Atech' },
  { tema: 'Operacion', practica: 'Automatizacion de procesos', perspectiva: 'Procesos Internos', mentor: 'Atech' },
  { tema: 'Operacion', practica: 'Gestion de inventarios', perspectiva: 'Procesos Internos', mentor: 'Atech' },
  { tema: 'Operacion', practica: 'Proveedores confiables', perspectiva: 'Procesos Internos', mentor: 'Atech' },
  { tema: 'Operacion', practica: 'Plan de contingencia', perspectiva: 'Procesos Internos', mentor: 'Atech' },
  { tema: 'Conocimiento', practica: 'Documentacion de procesos y aprendizaje', perspectiva: 'Aprendizaje y Crecimiento', mentor: 'Atech' },
  { tema: 'Conocimiento', practica: 'Pasantias y formacion continua', perspectiva: 'Aprendizaje y Crecimiento', mentor: 'Atech' },
  { tema: 'Enfoque SocioAmbiental Congruente', practica: 'Transparencia socioambiental', perspectiva: 'Procesos Internos', mentor: 'Ecori' },
  { tema: 'Enfoque SocioAmbiental Congruente', practica: 'Estrategia ESG documentada', perspectiva: 'Procesos Internos', mentor: 'Ecori' },
  { tema: 'Capital Humano', practica: 'Perfiles y Descriptivos de Puestos y Onboarding', perspectiva: 'Aprendizaje y Crecimiento', mentor: 'Babel' },
  { tema: 'Capital Humano', practica: 'Capacitacion y certificaciones', perspectiva: 'Aprendizaje y Crecimiento', mentor: 'Babel' },
  { tema: 'Capital Humano', practica: 'Evaluacion de desempeno', perspectiva: 'Aprendizaje y Crecimiento', mentor: 'Babel' },
  { tema: 'Capital Humano', practica: 'Beneficios e incentivos', perspectiva: 'Aprendizaje y Crecimiento', mentor: 'Babel' },
];
