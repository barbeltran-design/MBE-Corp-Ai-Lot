// Transcrito literalmente de la hoja "Diagnóstico Inicial" del archivo
// "Evaluación de Madurez Final" (español) y traducido profesionalmente al
// inglés (requerido por las bases del hackatón Build with Gemini XPRIZE).
// Cada tema tiene 6 preguntas (una por nivel de madurez), con su descripción
// (qué hace la empresa en ese nivel) y el entregable esperado como evidencia.
// Los 11 IDs coinciden con las llaves de AssessmentDoc.dimensions en
// src/types/firestore.ts.
//
// getMaturityDimensions(locale) es la única forma de leer este contenido —
// devuelve la lista de 11 temas ya en el idioma pedido. Las etiquetas de
// nivel (Ejecución/Execution, etc.) NO viven aquí: se toman de
// common.maturityLevel en messages/{es,en}.json vía next-intl, para no
// duplicar esas traducciones en dos lugares.
import type { Language, MaturityLevel } from '@/types/firestore';

export type DimensionId =
  | 'strategic'
  | 'finance'
  | 'hr'
  | 'sales'
  | 'operations'
  | 'esg'
  | 'compliance'
  | 'knowledge'
  | 'alliances'
  | 'customerService'
  | 'culture';

export const DIMENSION_IDS: DimensionId[] = [
  'strategic', // 1. Rumbo Estratégico
  'finance', // 2. Finanzas
  'sales', // 3. Marketing y Ventas
  'customerService', // 4. Atención al Cliente
  'compliance', // 5. Cumplimiento Normativo
  'operations', // 6. Operación
  'knowledge', // 7. Conocimiento
  'alliances', // 8. Alianzas
  'esg', // 9. Enfoque SocioAmbiental Congruente
  'hr', // 10. Capital Humano
  'culture', // 11. Cultura Organizacional
];

export interface MaturityLevelDef {
  key: MaturityLevel;
  maxPoints: number;
  description: string;
  deliverable: string;
  // Explicación del nivel desde el tutorial oficial de MBE: cómo se llama el
  // nivel, la pregunta "¿Cómo lo ...?" y la explicación de qué hace la empresa.
  tutorial: { nivel: string; pregunta: string; explicacion: string };
}

export interface MaturityDimensionDef {
  id: DimensionId;
  tema: string;
  explicacion: string;
  levels: MaturityLevelDef[];
}

const LEVEL_META: { key: MaturityLevel; maxPoints: number }[] = [
  { key: 'execution', maxPoints: 10 },
  { key: 'standard', maxPoints: 20 },
  { key: 'control', maxPoints: 20 },
  { key: 'optimization', maxPoints: 20 },
  { key: 'excellence', maxPoints: 20 },
  { key: 'influencer', maxPoints: 30 },
];

// Orden del tutorial: 1 Ejecución, 2 Documentación, 3 Control, 4 Mejora,
// 5 Excelencia, 6 Influencia (mismo orden que LEVEL_META).
const LEVEL_TUTORIAL_ES: {
  nivel: string;
  pregunta: string;
  explicacion: string;
}[] = [
  {
    nivel: 'Ejecución Integral',
    pregunta: '¿Cómo lo ejecuto?',
    explicacion: 'Qué métodos uso y cómo lo registro',
  },
  {
    nivel: 'Documentación Dinámica',
    pregunta: '¿Cómo lo documento?',
    explicacion: 'Documento mis procesos, son dinámicos y están disponibles',
  },
  {
    nivel: 'Control Predictivo',
    pregunta: '¿Cómo lo controlo?',
    explicacion: 'Tengo alertas de desempeño para anticipar fallas',
  },
  {
    nivel: 'Mejora Continua Ágil',
    pregunta: '¿Cómo lo mejoro?',
    explicacion: 'Elimino oportunamete las fallas de raíz',
  },
  {
    nivel: 'Excelencia Automatizada',
    pregunta: '¿Cómo me encamino a ser el mejor?',
    explicacion: 'Automatizo flujos y descentralizo decisiones',
  },
  {
    nivel: 'Influencer',
    pregunta: '¿Cómo influencio en mi industria?',
    explicacion: 'Inspiro y transformo mi mercado y entorno',
  },
];

const LEVEL_TUTORIAL_EN: {
  nivel: string;
  pregunta: string;
  explicacion: string;
}[] = [
  {
    nivel: 'Integral Execution',
    pregunta: 'How do I execute it?',
    explicacion: 'What methods I use and how I record it',
  },
  {
    nivel: 'Dynamic Documentation',
    pregunta: 'How do I document it?',
    explicacion: 'I document my processes; they are dynamic and accessible',
  },
  {
    nivel: 'Predictive Control',
    pregunta: 'How do I control it?',
    explicacion: 'I have performance alerts to anticipate failures',
  },
  {
    nivel: 'Agile Continuous Improvement',
    pregunta: 'How do I improve it?',
    explicacion: 'I promptly eliminate root-cause failures',
  },
  {
    nivel: 'Automated Excellence',
    pregunta: 'How do I get on the path to being the best?',
    explicacion: 'I automate workflows and decentralize decision-making.',
  },
  {
    nivel: 'Influencer',
    pregunta: 'How do I influence my industry?',
    explicacion: 'I inspire and transform my market and environment.',
  },
];

interface DimensionText {
  tema: string;
  explicacion: string;
  levels: [string, string][]; // [description, deliverable] x 6, in LEVEL_META order
}

const CONTENT: Record<Language, Record<DimensionId, DimensionText>> = {
  es: {
    strategic: {
      tema: 'Rumbo Estratégico',
      explicacion: 'Hacia dónde voy',
      levels: [
        ['Registro mi rumbo y acciones analizando mis resultados y entorno', 'Plan estratégico para aprovechar oportunidades y minimizar riesgos'],
        ['Documento como defino mi modelo de negocio para alcanzar metas y generar confianza', 'Formato de Reflexión Estratégica'],
        ['Evalúo resultados de acciones estratégicas', 'Reporte de impacto a los objetivos estratégicos'],
        ['Adapto oportunamente mis prioridades ante imprevistos', 'Bitácora de cambios a la estrategia'],
        ['Analizo escenarios futuros de mi empresa', 'Proyección con IA de modelos de negocios'],
        ['Mi modelo de negocio, productos y/o servicios cambian las reglas en mi industria', 'Publicación de estudio de caso de mi modelo de negocio'],
      ],
    },
    finance: {
      tema: 'Finanzas',
      explicacion: 'Crecer mi Dinero',
      levels: [
        ['Registro ingresos y gastos diarios por operación', 'Software hace la conciliación bancaria diaria'],
        ['Documento presupuestos empresariales por área y por separado el personal', 'Política de presupuestos con límites departamentales'],
        ['Mido rentabilidad por venta y cliente para detectar riesgos de liquidez', 'Cotizador con margen bruto y reportes de cobranza y pagos'],
        ['Optimizo mi capital eliminando fugas y reduciendo costos', 'Reporte de variaciones financieras y plan de reducción de costos'],
        ['Proyecto la salud financiera de mi empresa simulando escenarios', 'Proyección financiera a 3 años automatizada'],
        ['Financio e invierto en empresas del ecosistema', 'Programa de factoraje y crédito a proveedores o fondo de inversión semilla'],
      ],
    },
    sales: {
      tema: 'Marketing y Ventas',
      explicacion: 'Atracción de mi mercado',
      levels: [
        ['Segmento clientes y registro sus oportunidades de venta', 'Gestiono contactos y etapas de oportunidades en un sistema'],
        ['Diseño propuesta de valor y experiencia por segmento', 'Mapa de experiencia y satisfacción del Cliente'],
        ['Mido el retorno de inversión de mis canales de venta', 'Reporte de conversión por etapa y canal'],
        ['Capto la voz del cliente para mejorar las campañas y mis productos y servicios', 'Campañas optimizadas con manejo de objeciones'],
        ['Automatizo todo el ciclo de ventas, entrega, factura y cobro', 'Digitalización desde la prospección hasta la facturación y cobranza'],
        ['Convierto mi marca y/o modelo de venta en referente de la industria', 'Modelo de ventas registrado propiedad de mi empresa'],
      ],
    },
    operations: {
      tema: 'Operación',
      explicacion: 'Entrego en tiempo y forma',
      levels: [
        ['Registro mis actividades al instante', 'Sistema de órdenes de trabajo con tiempos'],
        ['Documento procesos con enfoque al cliente', 'Procesos Operativos accesibles para cualquier operador'],
        ['Controlo los procesos periódica y predictivamente', 'Tablero con inconsistencias en inventario y operación en tiempo real'],
        ['Reduzco errores antes que lleguen al cliente', 'Planes de Mejora Continua y Mantenimiento Preventivo'],
        ['Digitalizo mi operación con el cliente y proveedores', 'Plataforma de Autogestión para Clientes y proveedores'],
        ['Mi sistema de trabajo impulsa a mis competidores a elevar sus estándares', 'Certifico estándares de calidad, tiempo y sustentabilidad'],
      ],
    },
    customerService: {
      tema: 'Atención al Cliente',
      explicacion: 'Satisfacción del cliente',
      levels: [
        ['Registro contactos, solicitudes y quejas del cliente', 'BD de requerimientos y problemas del cliente'],
        ['Diseño la experiencia al cliente en cada contacto', 'Matriz de solicitudes del cliente con tiempos por escenario'],
        ['Mido la satisfacción de mis clientes al finalizar cada servicio', 'Reporte de satisfacción'],
        ['Analizo reclamos frecuentes para evitar que se repitan', 'Cambios al producto o servicio por quejas de clientes'],
        ['Predigo la satisfacción del cliente basado en sus interacciones con la empresa', 'Reporte predictivo de la satisfacción del cliente y atención automatizada'],
        ['Involucro a clientes para desarrollo de nuevos productos y servicios', 'Programa de co-creación de innovaciones'],
      ],
    },
    compliance: {
      tema: 'Cumplimiento Normativo',
      explicacion: 'Manejo de riesgos Legales y Fiscales',
      levels: [
        ['Digitalizo contratos y comprobantes de cumplimiento normativo y fiscal', 'Expedientes digitales de empleados, proveedores, clientes y cumplimiento'], 
        ['Defino la lista de verificación de cumplimiento legal y fiscal', 'Manual de cumplimiento Normativo'],
        ['Recibo alertas de riesgos operativos y legales antes de que multen', 'Reporte de mitigación de multas e incumplimientos'],
        ['Audito periódicamente contratos, contabilidad y cumplimiento normativo', 'Plan de mitigación de Riesgos Normativos'],
        ['Mi empresa se prepara para auditorías gubernamentales y de inversionistas', 'Dictamen de Auditor Externo y Certificado de Cumplimiento normativo'],
        ['Redacto normas de la industria y audito cumplimiento a proveedores', 'Constancia de participación en Comités Técnicos de Normalización'],
      ],
    },
    knowledge: {
      tema: 'Conocimiento',
      explicacion: 'Toma de decisiones con inteligencia',
      levels: [
        ['Registro el conocimiento del negocio', 'Repositorio del conocimiento disponible'],
        ['Defino la toma de decisiones para cada reporte', 'Matriz de conocimiento disponible'],
        ['Monitoreo el desempeño del negocio', 'Tablero de Inteligencia de Negocios en tiempo real'],
        ['Cruzo información de varias áreas para analizar la causa de problemas', 'Correlación de satisfacción del cliente con todas las áreas'],
        ['Predigo tendencias del mercado para automatizar decisiones', 'Motor Predictivo que dispara alertas y acciones'],
        ['Comparto estudios de mercado que mueven a la industria', 'Reporte de Inteligencia de Mercado para el sector'],
      ],
    },
    alliances: {
      tema: 'Alianzas',
      explicacion: 'Estrategia de Ecosistemas',
      levels: [
        ['Registro acuerdos con proveedores y aliados', 'Portal de proveedores y aliados estratégicos con expediente'],
        ['Documento políticas con proveedores y aliados', 'Base de datos de Proveedores, Competidores y Complementadores'],
        ['Mido el número de referidos o beneficios con Aliados', 'Reporte Mensual de Clientes por alianzas'],
        ['Integro la empresa a un grupo empresarial para optimizar recursos y productos', 'Afiliación a una asociación'],
        ['Invito a los grupos de interés a definir soluciones empresariales', 'Acuerdos de colaboración con grupos de interés'],
        ['Mi empresa conecta a la industria con grupos de interés', 'Lidero agrupaciones'],
      ],
    },
    esg: {
      tema: 'Enfoque SocioAmbiental',
      explicacion: 'Sostenibilidad Estratégica',
      levels: [
        ['Registro mi compromiso ético con grupos de interés', 'Código de Ética firmado por el personal'],
        ['Documento el impacto de mis productos y operaciones en mis grupos de interés', 'Matriz de grupos de interés'],
        ['Mido mi impacto económico socioambiental', 'Reporte de Eco-eficiencia social'],
        ['Reduzco mis impactos e incremento mis beneficios socioambientales', 'Reporte Socioambiental público'],
        ['Mis acciones socioambientales están alineadas a mi estrategia', 'Programa de Responsabilidad Socioambiental Congruente'],
        ['Incremento mi Retorno de Inversión Económico-Social', 'Medición en dinero del Retorno de Inversión Social de cada programa sociambiental'],
      ],
    },
    hr: {
      tema: 'Capital Humano',
      explicacion: 'Desarrollo de mi Personal',
      levels: [
        ['Registro la informacióndel personal', 'Sistema de Recursos Humanos con expedientes electrónicos'],
        ['Defino las competencias necesarias de los colaboradores', 'Descriptivos de puestos'],
        ['Evalúo el desempeño de cada colaborador', 'Evaluación de desempeño'],
        ['Programo capacitación para brechas de competencias', 'Plan de carrera y capacitación por persona'],
        ['Atraigo talento de alto nivel con compensación emocional y variable', 'Tabla de bonos amarrados a las metas de la empresa'],
        ['Mi empresa es formadora de talento y líderes', 'Academia de liderazgo y talento'],
      ],
    },
    culture: {
      tema: 'Cultura Organizacional',
      explicacion: 'El ambiente dentro del negocio',
      levels: [
        ['Publico el propósito común, misión, visión y valores', 'Plataforma oficial de comunicación corporativa'],
        ['Escribo los valores y conductas aceptables', 'Reglamento de Trabajo y código de conducta firmados'],
        ['Mido el estrés del equipo y su alineación a los valores de la empresa', 'Encuesta de Riesgos Psicosociales y 360'],
        ['Promuevo una cultura que favorece la innovación', 'Concursos de innovación interáreas'],
        ['Mantengo un equipo autogestionado de alto desempeño', 'Matriz de Talento (Desempeño vs. Valores)'],
        ['La cultura trasciende la empresa y mis colaboradores son embajadores de la marca', 'Colaboradores ponentes en diversos foros externos'],
      ],
    },
  },
  en: {
    strategic: {
      tema: 'Strategic Direction',
      explicacion: 'Where we are headed',
      levels: [
        ['I Track my direction and actions by analyzing results and the business environment', 'Strategic plan to leverage opportunities and minimize risks'],
        ['I Document the definition of my business model to achieve goals and build trust', 'Strategic Reflection Format'],
        ['I Evaluate the results of strategic actions', 'Report on the impact on strategic objectives'],
        ['I adjust priorities in response to unforeseen events', 'Log of strategy changes'],
        ['I Analyze future scenarios for my company', 'AI-driven projection of business models'],
        ['My business model, products, and/or services disrupt the rules of my industry', 'Publication of a case study on my business model'],        
      ],
    },
    finance: {
      tema: 'Finance',
      explicacion: 'Grow the Money',
      levels: [
        ['I Record daily income and expenses by transaction', 'Software performs daily bank reconciliation'],
        ['I Document business budgets by area and separately for personnel', 'Budget policy with departmental limits'],
        ['I Measure profitability by sale and client to detect liquidity risks', 'Quoting tool with gross margin, plus collection and payment reports'],
        ['I Optimize capital by eliminating leakage and reducing costs', 'Financial variance report and cost-reduction plan'],
        ['I Project company financial health by simulating scenarios', 'Automated 3-year financial projection'],
        ['I Finance and invest in ecosystem companies', 'Factoring and supplier credit program or seed investment fund'],
      ],
    },
    sales: {
      tema: 'Marketing and Sales',
      explicacion: 'Attracting my market',
      levels: [
        ['I Segment customers and log sales opportunities', 'Manage contacts and opportunity stages within a system'],
        ['I Design value propositions and experiences by segment', 'Customer experience and satisfaction mapping'],
        ['I Measure the ROI of sales channels', 'Conversion reporting by stage and channel'],
        ['I Capture the voice of the customer to improve campaigns, products, and services', 'Optimized campaigns incorporating objection handling'],
        ['I Automate the entire cycle: sales, delivery, invoicing, and collection', 'Digitization from prospecting through to invoicing and collections'],
        ['I Establish my brand and/or sales model as an industry benchmark', 'Company-owned, registered sales model'],
      ],
    },
    operations: {
      tema: 'Operations',
      explicacion: 'Timely and proper delivery',
      levels: [
        ['I log every activity and task as I perform it', 'Work order system with time tracking'],
        ['I Document processes with a focus on value creation and the customer experience', 'Process maps and operating procedures accessible to any operator'],
        ['I manage processes systematically and predictively', 'Operational dashboard that projects bottlenecks, inventory levels, and defect rates in real time'],
        ['I reduce waste and errors before they reach the customer', 'Data Base of Continuous Improvement and Maintenance Plans'],
        ['I digitally integrate my operations with customers and suppliers', 'Self-service platform for customers and suppliers'],
        ['I implement highly efficient processes that force competitors to raise their standards', 'I certify quality, timing and sustainability standards'],
      ],
    },
    customerService: {
      tema: 'Customer Service',
      explicacion: 'Customer satisfaction',
      levels: [
        ['I Log customer contacts, requests, and complaints', 'Database of customer requirements and issues'],
        ['I Design the customer experience for every touchpoint', 'Customer request matrix with scenario-based timelines'],
        ['I Measure customer satisfaction upon completion of each service', 'Satisfaction report'],
        ['I Analyze frequent complaints to prevent recurrence', 'Product or service changes based on customer complaints'],
        ['I Predict customer satisfaction based on interactions with the company', 'Predictive customer satisfaction and automated service report'],
        ['I Involve customers in the development of new products and services', 'Innovation co-creation program'],
      ],
    },
    compliance: {
      tema: 'Regulatory Compliance',
      explicacion: 'Legal and Tax Risk Management',
      levels: [
        ['I Digitize contracts and proof of regulatory and tax compliance', 'Digital files for employees, suppliers, clients, and compliance records'],
        ['I Define legal and tax compliance checklists', 'Regulatory compliance manual'],
        ['I Receive alerts regarding operational and legal risks before fines are issued', 'Report on fine and non-compliance mitigation'],
        ['I Periodically audit contracts, accounting, and regulatory compliance', 'Regulatory risk mitigation plan'],
        ['I Prepare the company for government and investor audits', 'External auditor’s report and regulatory compliance certificate'],
        ['I Draft industry standards and audit supplier compliance', 'Certificate of participation in Technical Standardization Committees'],
      ],
    },
    knowledge: {
      tema: 'Knowledge',
      explicacion: 'Decision-making with intelligence',
      levels: [
        ['I Document business knowledge', 'Available knowledge repository'],
        ['I Define decision-making for each report', 'Available knowledge matrix'],
        ['I Monitor business performance', 'Real-time Business Intelligence dashboard'],
        ['I Cross-reference data from various areas to analyze root causes of problems', 'Correlation of customer satisfaction across all areas'],
        ['I Predict market trends to automate decisions', 'Predictive engine triggering alerts and actions'],
        ['I Share market studies that drive the industry', 'Sector-specific Market Intelligence report'],
      ],
    },
    alliances: {
      tema: 'Business Alliances',
      explicacion: 'Ecosystem Strategy',
      levels: [
        ['I Record agreements with suppliers and partners', 'Supplier and strategic partner portal with profiles'],
        ['I Document policies regarding suppliers and partners', 'Database of suppliers, competitors, and complementors'],
        ['I Measure the number of referrals or benefits from partnerships', 'Monthly report on clients acquired through partnerships'],
        ['I Integrate the company into a business group to optimize resources and products', 'Affiliation with an association'],
        ['I Invite stakeholders to define business solutions', 'Collaboration agreements with stakeholders'],
        ['My company connects the industry with stakeholders', 'Lead industry groups or clusters'],
      ],
    },
    esg: {
      tema: 'Socio-Environmental Approach',
      explicacion: 'Strategic Sustainability',
      levels: [
        ['I Document my ethical commitment to stakeholders', 'Code of Ethics signed by staff'],
        ['I Document the impact of my products and operations on stakeholders', 'Stakeholder matrix'],
        ['I Measure my socio-environmental economic impact', 'Social eco-efficiency report'],
        ['I Reduce impacts and increase socio-environmental benefits', 'Public socio-environmental report'],
        ['I Align socio-environmental actions with my strategy', 'Aligned Socio-environmental Responsibility Program'],
        ['I Increase my Economic-Social Return on Investment', 'Monetary measurement of the Social Return on Investment for each socio-environmental program'],
      ],
    },
    hr: {
      tema: 'Human Capital',
      explicacion: 'Development of my staff',
      levels: [
        ['I Record personnel information', 'Human Resources system with digital employee files'],
        ['I Define necessary employee competencies', 'Job descriptions'],
        ['I Evaluate each employee’s performance', 'Performance evaluation'],
        ['Training program to address competency gaps', 'Individual career and training plans'],
        ['I Attract top-tier talent with emotional and variable compensation', 'Bonus structure linked to company goals'],
        ['My company develops talent and leaders', 'Leadership and talent academy'],
      ],
    },
    culture: {
      tema: 'Organizational Culture',
      explicacion: 'The environment within the business',
      levels: [
        ['I Communicate the shared purpose, mission, vision, and values', 'Official corporate communication platform'],
        ['I Document values ​​and acceptable behaviors', 'Signed workplace regulations and code of conduct'],
        ['I Measure team stress and alignment with company values', 'Psychosocial risk survey and 360-degree feedback'],
        ['I Foster a culture that encourages innovation', 'Cross-departmental innovation competitions'],
        ['I Maintain a high-performing, self-managed team', 'Talent matrix (Performance vs. Values)'],
        ['Culture extends beyond the company, and employees act as brand ambassadors', 'Employees speaking at various external forums'],
      ],
    },
  },
};

export function getMaturityDimensions(locale: Language): MaturityDimensionDef[] {
  const content = CONTENT[locale] ?? CONTENT.es;
  const tutorial = locale === 'en' ? LEVEL_TUTORIAL_EN : LEVEL_TUTORIAL_ES;
  return DIMENSION_IDS.map((id) => {
    const text = content[id];
    return {
      id,
      tema: text.tema,
      explicacion: text.explicacion,
      levels: LEVEL_META.map((meta, i) => ({
        key: meta.key,
        maxPoints: meta.maxPoints,
        description: text.levels[i][0],
        deliverable: text.levels[i][1],
        tutorial: tutorial[i],
      })),
    };
  });
}
