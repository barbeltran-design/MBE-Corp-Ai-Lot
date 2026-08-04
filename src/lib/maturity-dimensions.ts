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
  'strategic',
  'finance',
  'hr',
  'sales',
  'operations',
  'esg',
  'compliance',
  'knowledge',
  'alliances',
  'customerService',
  'culture',
];

export interface MaturityLevelDef {
  key: MaturityLevel;
  maxPoints: number;
  description: string;
  deliverable: string;
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
        ['Tengo claro hacia dónde quiero llevar mi empresa y las metas de todas las áreas', 'Metas financieras, de clientes, de procesos y de aprendizaje y conocimiento'],
        ['Escribo qué entrega de valor mi negocio a mis clientes, mis objetivos y mis acciones para lograrlo', 'Documento con la Misión, Visión, Propuesta de valor, Propósito Común, Objetivos estratégicos con metas y acciones'],
        ['Periódicamente reviso si logramos las metas', 'Reporte de resultados'],
        ['Analizo los cambios en mi entorno, mi mercado y mis desviaciones para ajustar mi plan de trabajo', 'Plan estratégico con las metas anuales y actividades mensuales para lograrlo tomando en cuenta el entorno'],
        ['Guío mi empresa con el apoyo y consejo de un grupo de expertos o asesores externos independientes', 'Informe de acuerdos con mi Consejo Consultivo'],
        ['Mi modelo de negocio, productos y/o servicios están cambiando las reglas en mi industria', 'Publicaciones sobre el modelo de mi empresa'],
      ],
    },
    finance: {
      tema: 'Finanzas',
      explicacion: 'Crecer mi Dinero',
      levels: [
        ['Conozco mi punto de equilibrio y cuanto debo ingresar para ganar lo que quiero', 'Registro de punto de equilibrio con entradas y salidas'],
        ['Separo mi dinero personal del dinero de mi empresa y elaboro un presupuesto de gastos fijos y variables', 'Mi presupuesto anual escrito de mis gastos fijos y variables'],
        ['Mido con precisión la rentabilidad real de cada producto y aseguro el cobro a tiempo de mis facturas', 'Mi calculadora de precios con margen bruto e informe semanal de cuentas por cobrar'],
        ['Detecto fugas de dinero, reduzco costos innecesarios y optimizo el uso de mi capital de trabajo', 'Mi reporte de análisis de variaciones financieras y plan de reducción de costos'],
        ['Proyecto a varios años el flujo de caja y la salud financiera de mi negocio con diferentes escenarios', 'Mi modelo de proyección financiera a 3 años automatizado'],
        ['Creo un fondo de inversión o programa de crédito para financiar y fortalecer a los negocios de mi ecosistema', 'Mi contrato de fondo de inversión corporativo y/o programa de crédito a proveedores'],
      ],
    },
    sales: {
      tema: 'Marketing y Ventas',
      explicacion: 'Atracción de mi mercado',
      levels: [
        ['Las ventas llegan mayormente por recomendaciones de boca en boca y las registro', 'Lista de nombres de las personas que te han recomendado clientes'],
        ['Tengo material de ventas profesional y canales de atracción', 'Manual de identidad corporativa, Kit de Ventas'],
        ['Mido la efectividad de mi proceso de venta desde el contacto inicial', 'Registros y reportes del seguimiento de las personas interesadas y tus canales más eficientes'],
        ['Hago cambios en cada etapa de la venta para incrementar las tasas de conversión', 'Manual con las mejores prácticas de mercadotecnia y ventas'],
        ['He automatizado el proceso de buscar clientes, cotizar, entregar, cobrar, facturar y mandar el recibo', 'Sistema digital desde la prospección hasta la facturación y cobranza al cliente'],
        ['Convierto a mi marca en referente del mercado y tengo un modelo de comercialización que es enseñado e imitado por el resto de la industria', 'Modelo de ventas exclusivo y registrado propiedad de tu empresa'],
      ],
    },
    customerService: {
      tema: 'Atención al Cliente',
      explicacion: 'Satisfacción del cliente',
      levels: [
        ['Registro y resuelvo los problemas de mis clientes en cuanto me llaman molestos', 'Correos o notas con reclamos recibidos'],
        ['Dejo por escrito mis reglas de garantía, devoluciones y los estándares de trato al cliente', 'Manual de Políticas de Garantía y Servicio al Cliente'],
        ['Mido constantemente la satisfacción de mis clientes mediante evaluaciones breves al finalizar cada servicio', 'Reporte mensual con las calificaciones de clientes'],
        ['Estudio los reclamos más frecuentes para modificar la percepción y asegurar que no vuelvan a ocurrir', 'Lista de cambios hechos a tu servicio basados en lo que no le gustó a los clientes'],
        ['Predigo la satisfacción del cliente basado en los eventos e interacciones con la empresa', 'Monitoreo automatizado de la satisfacción del cliente y disparo de acciones con base en ellas'],
        ['Creo un consejo de clientes que participan en diseñar mis próximos lanzamientos para definir el estándar de éxito del mercado', 'Reporte de innovaciones para mi marca'],
      ],
    },
    compliance: {
      tema: 'Cumplimiento Normativo',
      explicacion: 'Manejo de riesgos Legales y Fiscales',
      levels: [
        ['Estoy dado de alta fiscalmente para poder emitir facturas y cobrar a mis clientes', 'Documentación fiscal activa'], 
        ['Tengo contratos escritos con el personal y clientes. Sé qué reglas o normas federales aplican a mi negocio.', 'Acta Constitutiva, Registro de Marca, Contrato marco y Carpeta de Normatividad.'],
        ['Verifico mes a mes el pago puntual de impuestos y el cumplimiento de las normas laborales obligatorias', 'Matriz de Riesgos Legales y Fiscales y reportes de cumplimiento normativo'],
        ['Audito periódicamente mis contratos, acuerdos de confidencialidad, contabilidad y el cumplimiento normativ', 'Plan de mitigación de Riesgos Normativos'],
        ['Mantengo mi empresa 100% preparada ante revisiones gubernamentales o demandas, lista para recibir socios o capital', 'Manual de Cumplimiento Legal Corporativo, Dictamen Fiscal de Auditor Externo y Certificado de Cumplimiento total normativo'],
        ['Participo en comités que redactan las normas de la industria e impongo criterios de cumplimiento a mis proveedores', 'Código de Cumplimiento Regulatorio para Proveedores y constancia de participación en Comités Técnicos de Normalización'],
      ],
    },
    operations: {
      tema: 'Operación',
      explicacion: 'Entrego en tiempo y forma',
      levels: [
        ['Realizo el trabajo según mi experiencia o la memoria de mi personal en el turno', 'Bitácora en cuaderno o pizarrón con los pedidos anotados del día'],
        ['Documento procesos escritos o listas de verificación para que cualquier persona pueda operar', 'Manual paso a paso de todas las actividades de la empresa'],
        ['Mido tiempos de entrega y rechazos', 'Gráfica mensual que muestra tus tiempos de entrega de pedidos y errores o retrabajos'],
        ['Reduzco los desperdicios y errores antes de que lleguen al cliente', 'Plan de Mejora Continua y Mantenimiento'],
        ['Integración digital de mi operación con el cliente y proveedores', 'Plataforma de Autogestión para Clientes y proveedores'],
        ['Implemento procesos de máxima eficiencia que obligan a mis competidores a elevar sus estándares', 'Certifico estándares de calidad y tiempo'],
      ],
    },
    knowledge: {
      tema: 'Conocimiento',
      explicacion: 'Toma de decisiones con inteligencia',
      levels: [
        ['Tomo decisiones basadas en mi experiencia', 'Solicitudes de cambios en juntas, correos o chats'],
        ['Registro diario las ventas, compras, operaciones, entregas y atención a clientes', 'Bases de Datos de la cadena de valor al cliente'],
        ['Controlo periódicamente la salud financiera, operativa y comercial de la empresa', 'Tablero de Control con gráficas y datos clave del negocio'],
        ['Se cruza información de varias fuentes para entender la causa raíz de los problemas', 'Modelo de Análisis de Variaciones y Correlaciones de Rentabilidad por Cliente, Producto y Canal.'],
        ['Se hacen análisis que permiten predecir qué decisiones tomar con respecto a mis clientes, proveedores y personal', 'Reportes predictivos que alertan para modificar acciones de forma oportuna en la parte administrativa, comercial y operativa'],
        ['Automatizo la toma de decisiones y mis resultados son referencia del mercado', 'Sistema Autónomo de Decisiones Operativas y reporte de Benchmarking'],
      ],
    },
    alliances: {
      tema: 'Alianzas',
      explicacion: 'Estrategia de Ecosistemas',
      levels: [
        ['Opero relacionándome con otros negocios o con la comunidad de forma espontánea', 'Directorio informal de contactos de la zona o industria'],
        ['Defino mis alcances de relacionamiento con proveedores, clientes y competencia', 'Base de datos de Proveedores, Competidores y Complementadores'],
        ['Establezco alianzas comerciales con empresas complementarias y mido el número de clientes o beneficios intercambiados', 'Convenio de Alianza Comercial firmado y Reporte Mensual de Clientes Referidos'],
        ['Integro a la empresa a un grupo empresarial para optimizar esfuerzos y productos/servicios en favor de los grupos de interes', 'Comprobante de Afiliación Vigente a una cámara'],
        ['Invito a los grupos de interés en definir las soluciones que ofrece la comunidad empresarial', 'Firma de acuerdos de colaboración con los grupos de interés'],
        ['La empresa se convierte en el organismo que conecta a otras empresas con sus grupos de interés dentro de la industria', 'Acta Constitutiva de la agrupación'],
      ],
    },
    esg: {
      tema: 'Enfoque SocioAmbiental Congruente',
      explicacion: 'Sostenibilidad Estratégica',
      levels: [
        ['Coopero con la comunidad para evitar incidentes o clausuras', 'Registro de cooperación en chats o correos'],
        ['Documento mi compromiso ético con mis grupos de interés', 'Código de Ética Comercial y Política de No Discriminación firmada por el personal'],
        ['Registro el consumo de recursos y mis programas socioambientales', 'Tablero de Eco-eficiencia (Consumo/Mermas) y Reporte de impacto socioambiental'],
        ['Reduzco mis impactos e incremento mis beneficios socioambientales a mis grupos de interés', 'Programa de Responsabilidad Socioambiental Congruente'],
        ['Mis acciones socioambientales están alineadas a mi estrategia, mis operaciones y mis productos/servicios', 'Reporte Socioambiental auditado externamente'],
        ['Incremento mi Retorno de Inversión Económico-Social', 'Medición en dinero del Retorno de Inversión Social de cada programa sociambiental'],
      ],
    },
    hr: {
      tema: 'Capital Humano',
      explicacion: 'Desarrollo de mi Personal',
      levels: [
        ['Contrato a conocidos o familiares cuando necesito ayuda en la empresa', 'Directorio básico con los nombres y teléfonos del personal actual'],
        ['Tener un esquema del equipo (quién manda a quién) y una lista de las tareas de cada puesto', 'Organigrama y Perfiles de Puesto.'],
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
        ['El ambiente laboral es definido por la misma gente que labora en la empresa', 'Registro de quejas del personal'],
        ['Escribo el Reglamento de la oficina con las conductas prohibidas y los valores del negocio', 'Reglamento de Trabajo y código de conduta firmado por todos'],
        ['Mido si el equipo trabaja muy estresado y si están alineados a los valores de la empresa', 'Encuesta de Clima Laboral, Riesgos Psicosociales y Buzón de denuncias'],
        ['Realizo reuniones periódicas para resolver roces entre departamentos y fomentar la colaboración', 'Programas de integración y lealtad de colaboradores'],
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
        ['I have a clear vision of where I want to take my company and the goals for all areas', 'Financial, customer, process, and learning and knowledge goals'],
        ['I document the value my business delivers to customers, my objectives, and the actions taken to achieve them', 'Document outlining Mission, Vision, Value Proposition, Shared Purpose, and strategic objectives with specific goals and actions'],
        ['I periodically review whether we have met our goals', 'Results report'],
        ['I analyze changes in my environment and market, as well as any deviations, to adjust my work plan', 'Strategic plan featuring annual goals and monthly activities, factoring in the business environment'],
        ['I guide my company with the support and advice of a group of experts or independent external advisors', 'Report on agreements reached with my Advisory Board'],
        ['My business model, products, and/or services are changing the rules of the game in my industry', 'Publications regarding my company’s business model'],
      ],
    },
    finance: {
      tema: 'Finance',
      explicacion: 'Grow the Money',
      levels: [
        ['I know my break-even point and how much revenue I need to generate to earn what I want', 'Break-even point record with inflows and outflows'],
        ['I separate my personal funds from my business funds and create a budget for fixed and variable expenses', 'A written annual budget for fixed and variable expenses'],
        ['I accurately measure the actual profitability of each product and ensure timely collection of invoices', 'A pricing calculator based on gross margin and a weekly accounts receivable report'],
        ['I identify cash leaks, cut unnecessary costs, and optimize working capital usage', 'A financial variance analysis report and cost-reduction plan'],
        ['I project my business’s cash flow and financial health over several years using different scenarios', 'An automated 3-year financial projection model'],
        ['I establish an investment fund or credit program to finance and strengthen businesses within my ecosystem', 'A corporate investment fund agreement and/or supplier credit program'],
      ],
    },
    sales: {
      tema: 'Marketing and Sales',
      explicacion: 'Attracting my market',
      levels: [
        ['Sales come mainly from word-of-mouth recommendations, and I track them', 'List of names of people who have referred clients to you'],
        ['I have professional sales materials and lead generation channels', 'Corporate identity manual, Sales Kit'],
        ['I measure the effectiveness of my sales process starting from the initial contact', 'Records and reports tracking interested prospects and your most efficient channels'],
        ['I make adjustments at each stage of the sales process to increase conversion rates', 'Manual containing marketing and sales best practices'],
        ['I have automated the processes of prospecting, quoting, delivery, payment collection, invoicing, and receipt issuance', 'Digital system covering everything from prospecting to invoicing and collecting payment'],
        ['I have established my brand as a market benchmark and possess a sales model that is taught and emulated across the industry', 'Exclusive, registered sales model owned by your company'],
      ],
    },
    customerService: {
      tema: 'Customer Service',
      explicacion: 'Customer satisfaction',
      levels: [
        ['I log and resolve my client issues as soon as they call upset', 'Emails or notes containing received complaints'],
        ['I document my policies regarding warranties, returns, and customer service standards', 'Warranty and Customer Service Policy Manual'],
        ['I constantly measure customer satisfaction through brief evaluations after each service', 'Monthly report with customer ratings'],
        ['I analyze the most frequent complaints to shift perceptions and prevent recurrence', 'List of service changes made based on customer dissatisfaction'],
        ['I predict customer satisfaction based on events and interactions with the company', 'Automated customer satisfaction monitoring and triggered actions based on the data'],
        ['I establish a customer advisory board to help design upcoming launches and define market success standards', 'Report on brand innovations'],
      ],
    },
    compliance: {
      tema: 'Regulatory Compliance',
      explicacion: 'Legal and Tax Risk Management',
      levels: [
        ['I am registered for tax purposes to issue invoices and collect payments from clients', 'Active tax registration'],
        ['I have written contracts with staff and clients. I am aware of the federal rules and regulations applicable to my business.', 'Articles of Incorporation, Trademark Registration, Master Agreement, and Regulatory Compliance Folder.'],
        ['I verify timely tax payments and compliance with mandatory labor regulations on a monthly basis', 'Legal and Tax Risk Matrix and regulatory compliance reports'],
        ['I periodically audit my contracts, confidentiality agreements, accounting records, and regulatory compliance', 'Regulatory Risk Mitigation Plan'],
        ['I keep my company 100% prepared for government audits or lawsuits, and ready to bring on partners or raise capital', 'Corporate Legal Compliance Manual, External Auditor’s Tax Opinion, and Full Regulatory Compliance Certificate'],
        ['I participate in committees that draft industry standards and enforce compliance criteria for my suppliers', 'Regulatory Compliance Code for Suppliers and proof of participation in Technical Standardization Committees'],
      ],
    },
    operations: {
      tema: 'Operations',
      explicacion: 'Timely and proper delivery',
      levels: [
        ['I carry out work based on my experience or the memory of the staff on duty', 'Logbook or whiteboard with the day’s orders recorded'],
        ['I document processes or checklists so anyone can handle operations', 'Step-by-step manual covering all company activities'],
        ['I measure delivery times and rejection rates', 'Monthly chart showing order delivery times and errors or rework'],
        ['I reduce waste and errors before they reach the customer', 'Continuous Improvement and Maintenance Plan'],
        ['I digitally integrate my operations with customers and suppliers', 'Self-service platform for customers and suppliers'],
        ['I implement highly efficient processes that force competitors to raise their standards', 'I certify quality and timing standards'],
      ],
    },
    knowledge: {
      tema: 'Knowledge',
      explicacion: 'Decision-making with intelligence',
      levels: [
        ['I make decisions based on my experience', 'Change requests via meetings, emails, or chats'],
        ['I log daily sales, purchases, operations, deliveries, and customer service interactions', 'Customer value chain databases'],
        ['I periodically monitor the company’s financial, operational, and commercial health', 'Dashboard with key business data and charts'],
        ['Information from various sources is cross-referenced to identify the root cause of problems', 'Model for analyzing profitability variations and correlations by customer, product, and channel'],
        ['Analyses are conducted to guide decisions regarding customers, suppliers, and staff', 'Predictive reports that trigger timely adjustments to administrative, commercial, and operational actions'],
        ['I automate decision-making, and my results set the market standard', 'Autonomous operational decision-making system and benchmarking reports'],
      ],
    },
    alliances: {
      tema: 'Business Alliances',
      explicacion: 'Ecosystem Strategy',
      levels: [
        ['I operate by interacting spontaneously with other businesses or the community', 'Informal directory of local or industry contacts'],
        ['I participate in my sector’s chamber of commerce and define ethical commitments with suppliers', 'Registry of Suppliers, Competitors, and Complementors; proof of active chamber membership'],
        ['I establish commercial alliances with complementary businesses and track the number of customers or benefits exchanged', 'Signed commercial alliance agreement and monthly report on referred customers'],
        ['I integrate the company into a business group to optimize efforts and products/services for the benefit of stakeholders', 'Joint solution offering and Socially Responsible Company recognition'],
        ['I invite stakeholders to help define the solutions offered by the business community', 'Collaboration agreements with stakeholders'],
        ['The company acts as the entity connecting other businesses with their stakeholders within the industry', 'Articles of incorporation for the group'],
      ],
    },
    esg: {
      tema: 'Consistent Socio-Environmental Approach',
      explicacion: 'Strategic Sustainability',
      levels: [
        ['I cooperate with the community to prevent incidents or shutdowns', 'Record of cooperation via chats or emails'],
        ['I document my ethical commitment to my stakeholders', 'Business Code of Ethics and Non-Discrimination Policy signed by staff'],
        ['I track resource consumption and my socio-environmental programs', 'Eco-efficiency dashboard (consumption/waste) and socio-environmental impact report'],
        ['I reduce my impacts and increase socio-environmental benefits for my stakeholders', 'Coherent Socio-environmental Responsibility Program'],
        ['My socio-environmental actions are aligned with my strategy, operations, and products/services', 'Externally audited socio-environmental report'],
        ['I increase my economic-social Return on Investment', 'Monetary measurement of the Social Return on Investment for each socio-environmental program'],
      ],
    },
    hr: {
      tema: 'Human Capital',
      explicacion: 'Development of my staff',
      levels: [
        ['I hire acquaintances or family members when I need help in the company', 'Basic directory with the names and phone numbers of current staff'],
        ['Have a team structure (reporting lines) and a list of tasks for each position', 'Organizational chart and job profiles'],
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
        ['The work environment is defined by the very people who work at the company', 'Staff complaint log'],
        ['I draft the office regulations, outlining prohibited behaviors and business values', 'Workplace regulations and code of conduct signed by everyone'],
        ['I assess whether the team is under excessive stress and aligned with company values', 'Workplace climate survey, psychosocial risk assessment, and grievance/whistleblowing channel'],
        ['I hold regular meetings to resolve inter-departmental friction and foster collaboration', 'Employee integration and loyalty programs'],
        ['I maintain a self-managed team that operates with a high sense of responsibility, guided by the company culture', 'Culture handbook and talent matrix (Performance vs. Values)'],
        ['The culture extends beyond the company, and my employees act as brand ambassadors', 'Employees participating in various external forums to showcase the company’s cultural model'],
      ],
    },
  },
};

export function getMaturityDimensions(locale: Language): MaturityDimensionDef[] {
  const content = CONTENT[locale] ?? CONTENT.es;
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
      })),
    };
  });
}
