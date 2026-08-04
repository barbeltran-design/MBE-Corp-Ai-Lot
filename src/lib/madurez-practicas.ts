// Catalogo de 66 Buenas Practicas de Madurez (11 temas x 6 niveles) — la
// tabla que entrego el usuario (Nivel -> Buena Practica -> Mentor). Cada tema
// tiene exactamente una practica por nivel, en el orden oficial de la
// Evaluacion de Madurez (Rumbo Estrategico -> Finanzas -> Marketing y Ventas
// -> Atencion al Cliente -> Cumplimiento Normativo -> Operacion -> Conocimiento
// -> Alianzas -> Enfoque SocioAmbiental Congruente -> Capital Humano -> Cultura
// Organizacional) y en el orden de niveles Ejecucion..Influencer (mismas
// claves que MaturityLevel y la misma posicion que las respuestas del
// assessment en maturity-scoring.DimensionAnswers).
//
// Se usa en el Plan de Madurez (MaturityPlanBuilder) para sugerir la practica
// a trabajar: el nivel mas bajo NO marcado como "yes" en la evaluacion (o el
// siguiente nivel despues del completado) de cada tema, trabajada con su
// mentor, una practica por agente por mes, en orden ciclico hasta regresar.
import type { DimensionId } from '@/lib/maturity-dimensions';
import type { MaturityLevel } from '@/types/firestore';

export type MentorAgente = 'Babel' | 'Fisnando' | 'Karmetin' | 'Normau' | 'Atech';

export const MENTORES: MentorAgente[] = ['Babel', 'Fisnando', 'Karmetin', 'Normau', 'Atech'];

export interface PracticaMadurez {
  nivel: MaturityLevel; // en orden Ejecucion..Influencer
  practica: string;
  mentor: MentorAgente;
}

const p = (nivel: MaturityLevel, practica: string, mentor: MentorAgente): PracticaMadurez => ({
  nivel,
  practica,
  mentor,
});

export const PRACTICAS_POR_TEMA: Record<DimensionId, PracticaMadurez[]> = {
  strategic: [
    p('execution', 'Balanced Score Card', 'Babel'),
    p('standard', 'Plan estrategico', 'Babel'),
    p('control', 'Reporte de Resultados del Balanced Score Card', 'Babel'),
    p('optimization', 'Reflexion estrategica', 'Babel'),
    p('excellence', 'Consejo Directivo', 'Babel'),
    p('influencer', 'Innovacion del modelo de negocio de mi empresa', 'Babel'),
  ],
  finance: [
    p('execution', 'Punto de Equilibrio y metas de ingresos', 'Fisnando'),
    p('standard', 'Proyeccion financiera anual', 'Fisnando'),
    p('control', 'Cotizador', 'Fisnando'),
    p('optimization', 'Costeo operativo', 'Fisnando'),
    p('excellence', 'Analisis de variaciones financieras y plan de reduccion de costos', 'Fisnando'),
    p('influencer', 'Modelo de proyeccion financiera automatizado', 'Fisnando'),
  ],
  sales: [
    p('execution', 'BD de prospectos y Canales de Ventas', 'Karmetin'),
    p('standard', 'Manual de identidad corporativa, Kit de Ventas', 'Karmetin'),
    p('control', 'ROI de los canales de ventas', 'Karmetin'),
    p('optimization', 'Manual con las mejores practicas de mercadotecnia y ventas', 'Karmetin'),
    p('excellence', 'Digitalizacion desde la prospeccion hasta la facturacion y cobranza al cliente', 'Karmetin'),
    p('influencer', 'Modelo de ventas exclusivo y registrado propiedad de tu empresa', 'Karmetin'),
  ],
  customerService: [
    p('execution', 'BD de Quejas', 'Karmetin'),
    p('standard', 'BD de Requerimientos y Problemas del Cliente', 'Karmetin'),
    p('control', 'Evaluacion de satisfaccion', 'Karmetin'),
    p('optimization', 'Experiencia del cliente', 'Karmetin'),
    p('excellence', 'Prediccion de la satisfaccion de clientes', 'Karmetin'),
    p('influencer', 'Consejo de clientes para desarrollo de productos', 'Karmetin'),
  ],
  compliance: [
    p('execution', 'Alta fiscal, Acta Constitutiva, Registro de Marca', 'Fisnando'),
    p('standard', 'Contratos marco y Carpeta de Normatividad', 'Normau'),
    p('control', 'Matriz de Riesgos Legales y Fiscales y reportes de cumplimiento normativo', 'Normau'),
    p('optimization', 'Plan de mitigacion de Riesgos Normativos', 'Normau'),
    p('excellence', 'Manual de Cumplimiento Legal Corporativo, Dictamen Fiscal de Auditor Externo y Certificado de Cumplimiento total normativo', 'Normau'),
    p('influencer', 'Codigo de Cumplimiento Regulatorio para Proveedores y constancia de participacion en Comites Tecnicos de Normalizacion', 'Normau'),
  ],
  operations: [
    p('execution', 'Plan diario de trabajo', 'Atech'),
    p('standard', 'Procesos de la cadena de valor con enfoque socioambiental', 'Atech'),
    p('control', 'Reportes por area de tiempos de entrega y calidad', 'Atech'),
    p('optimization', 'Plan de Mejora Continua y Mantenimiento', 'Atech'),
    p('excellence', 'Plataforma de Autogestion para Clientes y proveedores', 'Atech'),
    p('influencer', 'Certifico estandares de calidad y tiempo', 'Atech'),
  ],
  knowledge: [
    p('execution', 'BD de solicitudes de cambios a los procesos', 'Atech'),
    p('standard', 'Bases de Datos de la cadena de valor al cliente', 'Atech'),
    p('control', 'Tablero de Control con graficas y datos clave del negocio', 'Atech'),
    p('optimization', 'Modelo de Analisis de Variaciones y Correlaciones de Rentabilidad por Cliente, Producto y Canal', 'Atech'),
    p('excellence', 'Reportes predictivos que alertan para modificar acciones de forma oportuna en la parte administrativa, comercial y operativa', 'Atech'),
    p('influencer', 'Sistema Autonomo de Decisiones Operativas y reporte de Benchmarking', 'Atech'),
  ],
  alliances: [
    p('execution', 'Directorio de contactos de la zona o industria', 'Babel'),
    p('standard', 'Base de datos de sinergias con Proveedores, Competidores y Complementadores', 'Babel'),
    p('control', 'Reporte Mensual de Clientes Referidos de Aliados', 'Babel'),
    p('optimization', 'BD de asociaciones empresariales del giro y clientes', 'Babel'),
    p('excellence', 'Firma de acuerdos de colaboracion con los grupos de interes', 'Babel'),
    p('influencer', 'Constitucion de grupo empresarial', 'Babel'),
  ],
  esg: [
    p('execution', 'Cooperacion con la comunidad', 'Babel'),
    p('standard', 'Codigo de Etica Comercial y Politica de No Discriminacion firmada', 'Babel'),
    p('control', 'Tablero de Eco-eficiencia (Consumo/Mermas) y Reporte de impacto socioambiental', 'Babel'),
    p('optimization', 'Programa de Responsabilidad Socioambiental Congruente', 'Babel'),
    p('excellence', 'Reporte Socioambiental auditado externamente', 'Babel'),
    p('influencer', 'Medicion en dinero del Retorno de Inversion Social de cada programa sociambiental', 'Babel'),
  ],
  hr: [
    p('execution', 'Directorio basico con los nombres y telefonos del personal actual', 'Normau'),
    p('standard', 'Organigrama y Perfiles de Puesto', 'Normau'),
    p('control', 'Evaluacion de desempeno individual', 'Normau'),
    p('optimization', 'Plan de carrera y capacitacion por persona', 'Normau'),
    p('excellence', 'Tabla de comisiones o bonos economicos amarrados a las metas de la empresa', 'Normau'),
    p('influencer', 'Programa de mentoria o academia interna reconocida en el gremio', 'Normau'),
  ],
  culture: [
    p('execution', 'Registro de quejas del personal', 'Normau'),
    p('standard', 'Reglamento de Trabajo y codigo de conduta firmado', 'Normau'),
    p('control', 'Encuesta de Clima Laboral, Riesgos Psicosociales y Buzon de denuncias', 'Normau'),
    p('optimization', 'Programas de integracion y lealtad de colaboradores', 'Normau'),
    p('excellence', 'Manual de Cultura y Matriz de Talento (Desempeno vs. Valores)', 'Normau'),
    p('influencer', 'Programa de Embajadores de Marca', 'Normau'),
  ],
};