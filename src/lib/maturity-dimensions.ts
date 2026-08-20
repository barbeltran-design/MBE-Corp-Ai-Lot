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
    nivel: 'Ejecución Sistémica',
    pregunta: '¿Cómo lo ejecuto?',
    explicacion: 'Opero el día a día utilizando metodologías probadas de la industria, dejando un rastro de datos trazable',
  },
  {
    nivel: 'Documentación Dinámica',
    pregunta: '¿Cómo lo documento?',
    explicacion: 'Mis procesos son activos y no manuales empolvados; viven en plataformas centralizadas que el equipo consulta y retroalimenta orgánicamente',
  },
  {
    nivel: 'Control Predictivo',
    pregunta: '¿Cómo lo controlo?',
    explicacion: 'Mido el desempeño organizacional utilizando indicadores clave, combinando analítica descriptiva con alertas tempranas para anticipar fallas',
  },
  {
    nivel: 'Mejora Continua Ágil',
    pregunta: '¿Cómo lo mejoro?',
    explicacion: 'Analizo las fallas, encuentro la causa raíz y optimizo mis procesos para ser más eficiente',
  },
  {
    nivel: 'Excelencia Automatizada',
    pregunta: '¿Cómo me encamino a ser el mejor?',
    explicacion: 'Mi empresa opera con automatización de flujos y toma de decisiones ágil y descentralizada',
  },
  {
    nivel: 'Influencia',
    pregunta: '¿Cómo influencio en mi industria?',
    explicacion: 'Dicto las reglas del juego, inspiro al mercado y transformo mi entorno',
  },
];

const LEVEL_TUTORIAL_EN: {
  nivel: string;
  pregunta: string;
  explicacion: string;
}[] = [
  {
    nivel: 'Systemic Execution',
    pregunta: 'How do I execute it?',
    explicacion: 'I manage day-to-day operations using proven industry methodologies, leaving a traceable data trail',
  },
  {
    nivel: 'Dynamic Documentation',
    pregunta: 'How do I document it?',
    explicacion: 'My processes are active, not dusty manuals; they live on centralized platforms that the team consults and provides organic feedback on',
  },
  {
    nivel: 'Predictive Control',
    pregunta: 'How do I control it?',
    explicacion: 'I measure organizational performance using key indicators, combining descriptive analytics with early warnings to anticipate failures',
  },
  {
    nivel: 'Agile Continuous Improvement',
    pregunta: 'How do I improve it?',
    explicacion: 'I analyze failures, find the root cause and improve my processes to be more efficient',
  },
  {
    nivel: 'Automated Excellence',
    pregunta: 'How do I get on the path to being the best?',
    explicacion: 'My company operates using workflow automation and agile, decentralized decision-making',
  },
  {
    nivel: 'Influence',
    pregunta: 'How do I influence my industry?',
    explicacion: 'I set the rules of the game, inspire the market and transform my environment',
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
        ['Registro hacia dónde quiero ir y cómo lograrlo a partir del análisis de resultados de la empresa y los retos del entorno', 'Plan de acción con objetivos estratégicos para aprovechar las oportunidades del mercado y minimizar los problemas'],
        ['Documento los pasos para definir el modelo de negocio que ayude a lograr mis objetivos y genere confianza en mis grupos de interés', 'Lista con los temas a analizar dentro y fuera de mi empresa que pueden impactar en el logro de mis objetivos'],
        ['Evalúo constantemente los avances y el impacto de mis decisiones para ajustar oportunamente', 'Un tablero de Inteligencia de Negocios que relacione los resultados operativos, con los del cliente y financieros en tiempo real'],
        ['Ajusto ágilmente mis prioridades ante imprevistos internos o externos', 'Una bitácora digital de cómo adapté la empresa a la nueva situación'],
        ['Analizo escenarios futuros de mi empresa', 'Modelos de negocios por escenario'],
        ['Mi modelo de negocio, productos y/o servicios están cambiando las reglas en mi industria', 'Publicación que establece el estándar de innovación y ética en la industria'],
      ],
    },
    finance: {
      tema: 'Finanzas',
      explicacion: 'Crecer mi Dinero',
      levels: [
        ['Registro cada entrada y salida de dinero diariamente, vinculando los movimientos a las operaciones de la empresa', 'Software contable en la nube conectado directo al banco, con conciliación automatizada al día'],
        ['Diseño los presupuestos de la empresa separando el capital personal del empresarial', 'Política de presupuestos con límites de gasto departamentales'],
        ['Mido la rentabilidad de cada producto/servicio y cliente identificando riesgos de flujo de dinero', 'Mi calculadora de precios con margen bruto e informe semanal de cuentas por cobrar y pagar'],
        ['Detecto fugas de dinero, reduzco costos innecesarios y optimizo el uso de mi capital de trabajo', 'Mi reporte de análisis de variaciones financieras y plan de reducción de costos'],
        ['Proyecto a varios años el flujo de caja y la salud financiera de mi negocio con diferentes escenarios', 'Mi modelo de proyección financiera a 3 años automatizado'],
        ['Creo un fondo de inversión o programa de crédito para financiar y fortalecer a los negocios de mi ecosistema', 'Programa corporativo de factoraje, crédito a proveedores o fondo de inversión semilla operando activamente en el sector'],
      ],
    },
    sales: {
      tema: 'Marketing y Ventas',
      explicacion: 'Atracción de mi mercado',
      levels: [
        ['Registro cada oportunidad de venta y segmento a los clientes', 'Sistema donde gestiono contactos y etapa en la que está cada oportunidad'],
        ['Diseño una propuesta de valor y experiencia del cliente por cada segmento', 'Mapa interactivo del Viaje del Cliente  para asegurar su satisfacción'],
        ['Mido el retorno de inversión de mis canales de venta', 'Reporte del Costo de Adquisición de Clientes y % de conversión por etapa y canal'],
        ['Capto la voz del cliente para mejorar las campañas y mis productos y servicios', 'Bitácora de pruebas por segmento y matriz de manejo de objeciones actualizada semanalmente'],
        ['He automatizado el proceso de buscar clientes, cotizar, entregar, cobrar, facturar y mandar el recibo', 'Sistema digital desde la prospección hasta la facturación y cobranza al cliente'],
        ['Convierto a mi marca en referente del mercado y tengo un modelo de comercialización que es enseñado e imitado por el resto de la industria', 'Modelo de ventas exclusivo y registrado propiedad de tu empresa'],
      ],
    },
    customerService: {
      tema: 'Atención al Cliente',
      explicacion: 'Satisfacción del cliente',
      levels: [
        ['Registro cada contacto, solicitud o queja del cliente', 'Sistema de atención al cliente'],
        ['Diseño una experiencia al cliente en todos los tipos de contacto', 'Base de datos de solicitudes del cliente con tiempos de respuesta para cada escenario'],
        ['Mido constantemente la satisfacción de mis clientes mediante evaluaciones breves al finalizar cada servicio', 'Reporte mensual con las calificaciones de clientes'],
        ['Estudio los reclamos más frecuentes para modificar la percepción y asegurar que no vuelvan a ocurrir', 'Lista de cambios hechos al producto/servicio basados en lo que no le gustó a los clientes'],
        ['Predigo la satisfacción del cliente basado en los eventos e interacciones con la empresa', 'Reporte de Predicción automatizada de la satisfacción del cliente y atención automatizada'],
        ['Involucro a clientes para desarrollo de nuevos productos y servicios que dicten las tendencias', 'Programa de co-creación de innovaciones'],
      ],
    },
    compliance: {
      tema: 'Cumplimiento Normativo',
      explicacion: 'Manejo de riesgos Legales y Fiscales',
      levels: [
        ['Digitalizo el 100% de mis comprobantes de cumplimiento fiscal y contratos vigentes', 'Expedientes electrónicos de empleados, proveedores, clientes y cumplimiento fiscal en la nube'], 
        ['Defino una lista de verificación de cumplimiento normativo legal y fiscal', 'Acta Constitutiva, Registro de Marca, Contrato marco, Código de ética y Manual de cumplimiento Normativo'],
        ['Establezco alertas  de riesgos operativos y legales  antes de incurrir en una infracción', 'Tablero  que rastrea vencimientos de contratos, permisos gubernamentales y litigios laborales en tiempo real'],
        ['Audito periódicamente mis contratos, acuerdos de confidencialidad, contabilidad y el cumplimiento normativo', 'Plan de mitigación de Riesgos Normativos'],
        ['Mantengo mi empresa 100% preparada ante revisiones gubernamentales o demandas, lista para recibir socios o capital', 'Dictamen Fiscal de Auditor Externo y Certificado de Cumplimiento total normativo'],
        ['Participo en comités que redactan las normas de la industria e impongo criterios de cumplimiento a mis proveedores', 'Código de Cumplimiento Regulatorio para Proveedores y constancia de participación en Comités Técnicos de Normalización'],
      ],
    },
    operations: {
      tema: 'Operación',
      explicacion: 'Entrego en tiempo y forma',
      levels: [
        ['Registro cada actividad y tarea al momento de realizarla', 'Sistema de órdenes de trabajo con registro de tiempos'],
        ['Documento procesos con un enfoque centrado en la creación de valor y la experiencia del cliente', 'Mapas de proceso y Procedimientos Operativos accesibles para cualquier operador'],
        ['Controlo los procesos de manera sistemática y predictiva', 'Tablero operativo que proyecta cuellos de botella, niveles de inventario y tasas de defectos en tiempo real'],
        ['Reduzco los desperdicios y errores antes de que lleguen al cliente', 'Base de Datos de Planes de Mejora Continua y Mantenimiento'],
        ['Integración digital de mi operación con el cliente y proveedores', 'Plataforma de Autogestión para Clientes y proveedores'],
        ['Implemento procesos de máxima eficiencia que obligan a mis competidores a elevar sus estándares', 'Certifico estándares de calidad, tiempo y sustentabilidad'],
      ],
    },
    knowledge: {
      tema: 'Conocimiento',
      explicacion: 'Toma de decisiones con inteligencia',
      levels: [
        ['Realizo reportes del conocimiento del negocio en tiempo real', 'Repositorio de reportes en la nube'],
        ['Defino la toma de decisiones de cada reporte', 'Base de Conocimiento en la nube'],
        ['Monitoreo el desempeño y disponibilidad de los reportes que muestran la salud del negocio', 'Tablero de Inteligencia de Negocios en tiempo real'],
        ['Se cruza información de varias fuentes para entender la causa raíz de los problemas', 'Modelo de Análisis de Correlaciones de Rentabilidad por Cliente, Producto y Canal'],
        ['Utilizo inteligencia artificial y modelos predictivos que analizan tendencias del mercado y sugieren decisiones', 'Motor Predictivo que dispara alertas y recomendaciones'],
        ['Comparto tendencias, indicadores referenciales y estudios de mercado que fijan los estándares en la industria', 'Reporte de Inteligencia de Mercado publicado que es el referente para el sector'],
      ],
    },
    alliances: {
      tema: 'Alianzas',
      explicacion: 'Estrategia de Ecosistemas',
      levels: [
        ['Registro los acuerdos con proveedores y aliados', 'Portal de proveedores con altas y expediente digitalizado'],
        ['Documento mis alcances de relacionamiento con proveedores, clientes y competencia', 'Base de datos de Proveedores, Competidores y Complementadores'],
        ['Establezco alianzas comerciales con empresas complementarias y mido el número de clientes o beneficios intercambiados', 'Convenio de Alianza Comercial firmado y Reporte Mensual de Clientes Referidos'],
        ['Integro a la empresa a un grupo empresarial para optimizar esfuerzos y productos/servicios en favor de los grupos de interes', 'Comprobante de Afiliación Vigente a una cámara'],
        ['Invito a los grupos de interés en definir las soluciones que ofrece la comunidad empresarial', 'Firma de acuerdos de colaboración con los grupos de interés'],
        ['La empresa se convierte en el organismo que conecta a otras empresas con sus grupos de interés dentro de la industria', 'Acta Constitutiva de la agrupación'],
      ],
    },
    esg: {
      tema: 'Enfoque SocioAmbiental',
      explicacion: 'Sostenibilidad Estratégica',
      levels: [
        ['Registro mi compromiso ético con mis grupos de interéss', 'Código de Ética Comercial y Política de No Discriminación firmada por el personal'],
        ['Documento el impacto de mis productos y operaciones en mis grupos de interés', 'Matriz de grupos de interés'],
        ['Mido el consumo de recursos y el impacto económico de mis programas socioambientales', 'Tablero de Eco-eficiencia (Consumo/Mermas) y Reporte de impacto socioambiental'],
        ['Reduzco mis impactos e incremento mis beneficios socioambientales a mis grupos de interés', 'Reporte Socioambiental auditado externamente'],
        ['Mis acciones socioambientales están alineadas a mi estrategia, mis operaciones y mis productos/servicios', 'Programa de Responsabilidad Socioambiental Congruente'],
        ['Incremento mi Retorno de Inversión Económico-Social', 'Medición en dinero del Retorno de Inversión Social de cada programa sociambiental'],
      ],
    },
    hr: {
      tema: 'Capital Humano',
      explicacion: 'Desarrollo de mi Personal',
      levels: [
        ['Registro la información y expediente del personal', 'Sistema de Recursos Humanos con expedientes electrónicos completos'],
        ['Defino las competencias necesarias de los colaboradores', 'Descriptivos de puestos'],
        ['Evalúo periódicamente si cada colaborador está cumpliendo con los objetivos asignados a su puesto ', 'Evaluación de desempeño'],
        ['Detecto las faltas de competencia en mi equipo y diseño un programa de capacitación para cubrirlas', 'Plan de carrera y capacitación por persona'],
        ['Atraigo talento de alto nivel con compensación emocional y variable', 'Tabla de comisiones o bonos económicos amarrados a las metas de la empresa'],
        ['Convierto a mi empresa en un imán de talento y en una escuela formadora de líderes. El liderazgo alinea la operación con la estrategia', 'Programa de mentoría o academia interna reconocida en el gremio'],
      ],
    },
    culture: {
      tema: 'Cultura Organizacional',
      explicacion: 'El ambiente dentro del negocio',
      levels: [
        ['Registro el propósito común, misión, visión, valores, principios y directrices', 'Plataforma oficial de comunicación corporativa'],
        ['Escribo el Reglamento de la oficina con las conductas prohibidas y los valores del negocio', 'Reglamento de Trabajo y código de conduta firmado por todos'],
        ['Mido si el equipo trabaja muy estresado y si están alineados a los valores de la empresa', 'Encuesta de Clima Laboral, Riesgos Psicosociales y Buzón de denuncias'],
        ['Promuevo una cultura que favorece la adaptación al cambio, el empoderamiento y la innovación', 'Programas de proyectos interáreas'],
        ['Mantengo un equipo autogestionado que opera con alta responsabilidad guiado por la cultura de la empresa', 'Manual de Cultura y Matriz de Talento (Desempeño vs. Valores)'],
        ['La cultura trasciende la empresa y mis colaboradores son embajadores de la marca', 'Colaboradores participando en diversos foros externos enseñando el modelo cultural de la empresa'],
      ],
    },
  },
  en: {
    strategic: {
      tema: 'Strategic Direction',
      explicacion: 'Where we are headed',
      levels: [
        ['I document where I want to go and how to achieve it, based on an analysis of the results of the company and environmental challenges', 'Action plan with strategic objectives to capitalize on market opportunities and minimize problems'],
        ['I document the steps to define a business model that helps achieve my objectives and builds trust among my stakeholders', 'A list of topics to analyze, both within and outside my company, that could impact the achievement of my objectives'],
        ['I constantly evaluate the progress and impact of my decisions in order to make timely adjustments', 'A business intelligence dashboard that links operational, customer, and financial results in real time'],
        ['I nimbly adjust my priorities in response to internal or external unforeseen events', 'A digital log of how I adapted the company to the new situation'],
        ['I analyze future scenarios for my company', 'Businesses models by scenario'],
        ['My business model, products, and/or services are changing the rules of the game in my industry', 'A publication that sets the standard for innovation and ethics in the industry'],
      ],
    },
    finance: {
      tema: 'Finance',
      explicacion: 'Grow the Money',
      levels: [
        ['I record every cash inflow and outflow daily, linking transactions to company operations', 'Cloud-based accounting software directly connected to the bank, featuring automated, up-to-date reconciliation'],
        ['I design the company budget, separating personal capital from business capital', 'Budgeting policy with departmental spending limits'],
        ['I measure the profitability of each product/service and client, identifying cash flow risks', 'A pricing calculator based on gross margin and a weekly accounts receivable and payable report'],
        ['I identify cash leaks, cut unnecessary costs, and optimize working capital usage', 'A financial variance analysis report and cost-reduction plan'],
        ['I project my business’s cash flow and financial health over several years using different scenarios', 'An automated 3-year financial projection model'],
        ['I establish an investment fund or credit program to finance and strengthen businesses within my ecosystem', 'Corporate factoring program, supplier credit facility, or seed investment fund actively operating in the sector'],
      ],
    },
    sales: {
      tema: 'Marketing and Sales',
      explicacion: 'Attracting my market',
      levels: [
        ['I log every sales opportunity and segment the customers', 'System for managing contacts and the stage of each opportunity'],
        ['I design a value proposition and customer experience for each segment', 'Interactive customer journey map to ensure customer satisfaction'],
        ['I measure the return on investment of my sales channels', 'A report on Customer Acquisition Cost and conversion rates by stage and channel'],
        ['I make adjustments at each stage of the sales process to increase conversion rates', 'Manual containing marketing and sales best practices'],
        ['I have automated the processes of prospecting, quoting, delivery, payment collection, invoicing, and receipt issuance', 'Digital system covering everything from prospecting to invoicing and collecting payment'],
        ['I have established my brand as a market benchmark and possess a sales model that is taught and emulated across the industry', 'Exclusive, registered sales model owned by your company'],
      ],
    },
    customerService: {
      tema: 'Customer Service',
      explicacion: 'Customer satisfaction',
      levels: [
        ['I log every customer contact, request, or complaint', 'Customer service system'],
        ['I design the customer experience across all touchpoints', 'Database of customer requests with response times for each scenario'],
        ['I constantly measure customer satisfaction through brief evaluations after each service', 'Monthly report with customer ratings'],
        ['I analyze the most frequent complaints to shift perceptions and prevent recurrence', 'List of changes made to the product/service based on what customers disliked.'],
        ['I predict customer satisfaction based on events and interactions with the company', 'Automated Customer Satisfaction Prediction Report and automated service'],
        ['I engage clients in the development of new products and services that set trends', 'An innovation co-creation program'],
      ],
    },
    compliance: {
      tema: 'Regulatory Compliance',
      explicacion: 'Legal and Tax Risk Management',
      levels: [
        ['I digitize 100% of my tax compliance documents and active contracts', 'Cloud-based electronic records for employees, suppliers, customers, and tax compliance'],
        ['I define a legal and tax compliance checklist', 'Articles of Incorporation, Trademark Registration, Framework Agreement, Code of Ethics, and Regulatory Compliance Manual'],
        ['I set up alerts for operational and legal risks before an infraction occurs', 'Dashboard that tracks contract expirations, government permits, and labor litigation in real time'],
        ['I periodically audit my contracts, confidentiality agreements, accounting records, and regulatory compliance', 'Regulatory Risk Mitigation Plan'],
        ['I keep my company 100% prepared for government audits or lawsuits, and ready to bring on partners or raise capital', 'External Auditor’s Tax Opinion, and Full Regulatory Compliance Certificate'],
        ['I participate in committees that draft industry standards and enforce compliance criteria for my suppliers', 'Regulatory Compliance Code for Suppliers and proof of participation in Technical Standardization Committees'],
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
    knowledge: {
      tema: 'Knowledge',
      explicacion: 'Decision-making with intelligence',
      levels: [
        ['I generate real-time reports based on business insights', 'A cloud-based report repository'],
        ['I define the decision-making process for each report', 'A cloud-based knowledge data base'],
        ['I monitor the performance and availability of reports that show the health of the business', 'A real-time Business Intelligence dashboard'],
        ['Information from various sources is cross-referenced to identify the root cause of problems', 'Model for analyzing profitability variations and correlations by customer, product, and channel'],
        ['I use artificial intelligence and predictive models that analyze market trends and suggest decisions', 'Predictive engine that triggers alerts and recommendations'],
        ['I share trends, benchmark indicators, and market studies that set industry standards', 'A published Market Intelligence Report that serves as the sector benchmark'],
      ],
    },
    alliances: {
      tema: 'Business Alliances',
      explicacion: 'Ecosystem Strategy',
      levels: [
        ['I record agreements with suppliers and partners', 'Supplier portal featuring onboarding and digitized records'],
        ['I document the scope of my relationships with suppliers, clients, and competitors', 'Database of Suppliers, Competitors, and Complementors'],
        ['I establish commercial alliances with complementary businesses and track the number of customers or benefits exchanged', 'Signed commercial alliance agreement and monthly report on referred customers'],
        ['I integrate the company into a business group to optimize efforts and products/services for the benefit of stakeholders', 'Joint solution offering and Socially Responsible Company recognition'],
        ['I invite stakeholders to help define the solutions offered by the business community', 'Collaboration agreements with stakeholders'],
        ['The company acts as the entity connecting other businesses with their stakeholders within the industry', 'Articles of incorporation for the group'],
      ],
    },
    esg: {
      tema: 'Socio-Environmental Approach',
      explicacion: 'Strategic Sustainability',
      levels: [
        ['I track my ethical commitment to my stakeholders', 'Business Code of Ethics and Non-Discrimination Policy signed by staff'],
        ['I document the impact of my products and operations on my stakeholders', 'Stakeholder matrix'],
        ['I measure the resource consumption and economic impact of my socio-environmental programs', 'Eco-efficiency dashboard (consumption/waste) and socio-environmental impact report'],
        ['I reduce my impacts and increase socio-environmental benefits for my stakeholders', 'Externally audited socio-environmental report'],
        ['My socio-environmental actions are aligned with my strategy, operations, and products/services', 'Coherent Socio-environmental Responsibility Program'],
        ['I increase my economic-social Return on Investment', 'Monetary measurement of the Social Return on Investment for each socio-environmental program'],
      ],
    },
    hr: {
      tema: 'Human Capital',
      explicacion: 'Development of my staff',
      levels: [
        ['I hire acquaintances or family members when I need help in the company', 'Basic directory with the names and phone numbers of current staff'],
        ['I define the necessary competencies  for employees', 'Job descriptions'],
        ['I periodically evaluate whether each employee is meeting the objectives assigned to their role', 'Performance evaluation'],
        ['I identify skill gaps in my team and design a training program to address them', 'Individual career and training plan'],
        ['I attract top-tier talent using emotional and variable compensation', 'Commission schedule or financial bonuses tied to company goals'],
        ['I turn my company into a talent magnet and a leadership training ground. Leadership aligns operations with strategy', 'Mentorship program or internal academy recognized within the industry'],
      ],
    },
    culture: {
      tema: 'Organizational Culture',
      explicacion: 'The environment within the business',
      levels: [
        ['I register the shared purpose, mission, vision, values, principles, and guidelines', 'Official corporate communication platform'],
        ['I draft the office regulations, outlining prohibited behaviors and business values', 'Workplace regulations and code of conduct signed by everyone'],
        ['I assess whether the team is under excessive stress and aligned with company values', 'Workplace climate survey, psychosocial risk assessment, and grievance/whistleblowing channel'],
        ['I foster a culture that promotes adaptability to change, empowerment, and innovation', 'Cross-functional projects program'],
        ['I maintain a self-managed team that operates with a high sense of responsibility, guided by the company culture', 'Culture handbook and talent matrix (Performance vs. Values)'],
        ['The culture extends beyond the company, and my employees act as brand ambassadors', 'Employees participating in various external forums to showcase the company’s cultural model'],
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
