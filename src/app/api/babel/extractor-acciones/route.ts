import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Ruta NUEVA e independiente. NO modifica src/app/api/babel/route.ts, ni
// ninguna de las otras rutas extractor-*/priorizacion (esas ya estan
// probadas en produccion y no se tocan). Reutiliza los MISMOS nombres de
// variables de entorno que las demas rutas de Babel:
//   FALLBACK_ENDPOINT / FALLBACK_MODEL / FALLBACK_API_KEY   -> Groq (1er intento)
//   TERTIARY_ENDPOINT / TERTIARY_MODEL / TERTIARY_API_KEY   -> OpenRouter (2do intento)
//   GEMINI_MODEL / GEMINI_API_KEY                            -> Gemini (3er intento, solo si hay llave)
//   ROUTER_ENDPOINT / ROUTER_MODEL / ROUTER_API_KEY          -> 9Router opcional (solo si esta configurado)
//
// Tarea #45: a partir de una Amenaza/Oportunidad y su Fortaleza/Debilidad
// asociada (mas el Objetivo Estrategico del que cuelgan), esta ruta propone
// Acciones concretas TOMADAS del catalogo real de 153 Buenas Practicas del
// checklist "Belsua-MBE" (columna Buena Practica), redactadas como
// [verbo en infinitivo] + [texto de la practica]. El campo Beneficio de
// cada fila del catalogo se usa unicamente como criterio interno del
// modelo para elegir las practicas mas relevantes; NO se copia textual
// dentro de la descripcion de la accion generada.
// ---------------------------------------------------------------------------

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';

const FALLBACK_ENDPOINT = process.env.FALLBACK_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions';
const FALLBACK_MODEL = process.env.FALLBACK_MODEL || 'llama-3.3-70b-versatile';

const TERTIARY_ENDPOINT = process.env.TERTIARY_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions';
const TERTIARY_MODEL = process.env.TERTIARY_MODEL || 'openai/gpt-oss-20b:free';

const ROUTER_ENDPOINT = process.env.ROUTER_ENDPOINT || '';
const ROUTER_MODEL = process.env.ROUTER_MODEL || 'oc/qwen3-coder-plus';

interface Diagnostic {
  provider: string;
  status: string;
  error?: string;
}

interface RoleParaIA {
  key: string;
  nombre: string;
}

interface ExtractorAccionesRequestBody {
  language?: 'es' | 'en';
  objetivo?: string;
  entornoTipo?: string;
  entornoDescripcion?: string;
  fdTipo?: string;
  fdDescripcion?: string;
  roles?: RoleParaIA[];
}

// Catalogo completo de las 153 Buenas Practicas del checklist
// "Belsua-MBE" (Tema, Subtema, Marco de Referencia, Buena Practica,
// Beneficio, Agente IA), ya aplanado como texto para el prompt.
const BUENAS_PRACTICAS_LINES: string[] = [
  "1. Reflexión Estratégica - Canvas :: Beneficio: Facilita la visualización y diseño de modelos de negocio de manera estructurada y clara. (Agente: Babel)",
  "2. Reflexión Estratégica - Propuesta de valor :: Beneficio: Ayuda a definir y comunicar claramente los beneficios únicos que ofrece tu empresa a los clientes. (Agente: Babel)",
  "3. Reflexión Estratégica - Misión :: Beneficio: Proporciona dirección y propósito a la organización, alineando a todos los miembros hacia un objetivo común. (Agente: Babel)",
  "4. Reflexión Estratégica - Visión :: Beneficio: Establece una meta a largo plazo que inspira y motiva a los empleados. (Agente: Babel)",
  "5. Reflexión Estratégica - Valores :: Beneficio: Guían el comportamiento y la toma de decisiones dentro de la empresa. (Agente: Babel)",
  "6. Reflexión Estratégica - Propósito Común :: Beneficio: Fomenta la cohesión y el sentido de pertenencia entre los empleados. (Agente: Babel)",
  "7. Reflexión Estratégica - Objetivos Estratégicos: Financieros, Liderazgo, Responsabilidad Social, Clientes, Operativos, Conocimiento :: Beneficio: Permiten enfocar los esfuerzos en áreas clave como finanzas, liderazgo, responsabilidad social, clientes, operaciones y conocimiento. (Agente: Babel)",
  "8. Reflexión Estratégica - Capacidades Organizacionales :: Beneficio: Identifican y desarrollan las habilidades y recursos necesarios para alcanzar los objetivos estratégicos. (Agente: Babel)",
  "9. Reflexión Estratégica - Modelo de Negocio :: Beneficio: Describe cómo la empresa crea, entrega y captura valor. (Agente: Babel)",
  "10. Reflexión Estratégica - Investigación de Mercado Escritorio :: Beneficio: Proporciona información relevante sobre el mercado y la competencia. (Agente: Babel)",
  "11. Reflexión Estratégica - PESTEL :: Beneficio: Analiza los factores políticos, económicos, sociales, tecnológicos, ecológicos y legales que pueden afectar a la empresa. (Agente: Babel)",
  "12. Reflexión Estratégica - Modelo Delta :: Beneficio: Ofrece una perspectiva estratégica centrada en el cliente. (Agente: Babel)",
  "13. Reflexión Estratégica - Planeación Prospectiva :: Beneficio: Ayuda a anticipar y prepararse para futuros escenarios. (Agente: Babel)",
  "14. Reflexión Estratégica - Organigrama :: Beneficio: Clarifica la estructura organizacional y las relaciones jerárquicas. (Agente: Babel)",
  "15. Plan de Acción Estratégico - Alineación FODA-Objetivos Estratégicos :: Beneficio: Asegura que las fortalezas, oportunidades, debilidades y amenazas se consideren al establecer objetivos estratégicos. (Agente: Babel)",
  "16. Plan de Acción Estratégico - Priorización Impacto-Probabilidad :: Beneficio: Facilita la gestión de riesgos al priorizar acciones según su impacto y probabilidad. (Agente: Babel)",
  "17. Plan de Acción Estratégico - Acciones, Responsables, Fechas, Costo, Entregables :: Beneficio: Permiten una gestión efectiva de proyectos y tareas. (Agente: Babel)",
  "18. Plan de Responsabilidad Social Congruente - Impactos de la Operación, Entrega, Producción del Producto o servicio a Clientes :: Beneficio: Evaluar los impactos de las operaciones y el producto en los clientes (Agente: Babel)",
  "19. Plan de Responsabilidad Social Congruente - Impactos de la Operación, Entrega, Producción del Producto o servicio a Colaboradores :: Beneficio: Evaluar los impactos de las operaciones y el producto en los colaboradores (Agente: Babel)",
  "20. Plan de Responsabilidad Social Congruente - Impactos de la Operación, Entrega, Producción del Producto o servicio a Gobierno :: Beneficio: Evaluar los impactos de las operaciones y el producto en el gobierno (Agente: Babel)",
  "21. Plan de Responsabilidad Social Congruente - Impactos de la Operación, Entrega, Producción del Producto o servicio a Sociedad :: Beneficio: Evaluar los impactos de las operaciones y el producto en la comunidad (Agente: Babel)",
  "22. Plan de Responsabilidad Social Congruente - Impactos de la Operación, Entrega, Producción del Producto o servicio a Proveedores :: Beneficio: Evaluar los impactos de las operaciones y el producto en los proveedores (Agente: Babel)",
  "23. Plan de Responsabilidad Social Congruente - Impactos de la Operación, Entrega, Producción del Producto o servicio a Accionistas :: Beneficio: Evaluar los impactos de las operaciones y el producto en los accionistas (Agente: Babel)",
  "24. Plan de Responsabilidad Social Congruente - Impactos de la Operación, Entrega, Producción del Producto o servicio a Medio Ambiente :: Beneficio: Evaluar los impactos de las operaciones y el producto en el medio ambiente (Agente: Babel)",
  "25. Plan de Responsabilidad Social Congruente - Impactos de la Operación, Entrega, Producción del Producto o servicio a Competidores :: Beneficio: Evaluar los impactos de las operaciones y el producto en los competidores (Agente: Babel)",
  "26. Plan de Responsabilidad Social Congruente - Plan de acción de mitigación de riesgos con beneficios económicos :: Beneficio: Reduce los riesgos con los grupos de interés. (Agente: Babel)",
  "27. Plan de Responsabilidad Social Congruente - Reporte de acciones, comunicación a grupos de interés, alineación ESG :: Beneficio: Mejora la comunicación con los grupos de interés. (Agente: Babel)",
  "28. Modelo de Cultura de la Empresa - Campañas de Visión, Misión, Valores, Propuesta de valor, Propósito común :: Beneficio: Refuerzan la cultura organizacional y alinean a los empleados con los objetivos de la empresa. (Agente: Babel)",
  "29. Modelo de Cultura de la Empresa - Código de ética & Reglamento de trabajo :: Beneficio: Establecen normas claras de comportamiento y procedimientos. (Agente: Babel)",
  "30. Modelo de Cultura de la Empresa - Dinámica de Reconocimientos y Consecuencias :: Beneficio: Motivan a los empleados y promueven el cumplimiento de las normas. (Agente: Babel)",
  "31. Evaluación Financiera - Resultados de la empresa (Ingresos diferenciados,  Gastos variables,  gastos fijos) :: Beneficio: Permiten evaluar el desempeño financiero y operativo. (Agente: Babel)",
  "32. Evaluación Financiera - Cálculo de punto de equilibrio y Retorno de Inversión-TIIR :: Beneficio: Ayudan a tomar decisiones informadas sobre inversiones y costos. (Agente: Babel)",
  "33. Proyección Financiera - Plan de inversiones anual identificando las fuentes posibles de financiamiento :: Beneficio: Identifica las fuentes de financiamiento y planifica el uso de recursos. (Agente: Babel)",
  "34. Proyección Financiera - Presupuestos por área (Costos operativos) :: Beneficio: Facilitan la gestión financiera y el control de costos. (Agente: Babel)",
  "35. Proyección Financiera - Presupuestos de ventas (Ingresos por participación del mercado) :: Beneficio: Facilitan la gestión financiera y la comparación de costos vs ingresos. (Agente: Babel)",
  "36. Cotizador - Calculadora Costos (Costo insumos, Prorrateo depreciación de equipos, Gastos fijos, Mano de Obra) + Utilidades, vs Precios de la competencia :: Beneficio: Ayuda a determinar los costos y precios competitivos. (Agente: Babel)",
  "37. Proceso de pago a proveedores - Políticas de pago, créditos, requisitos documentales, esquemas de factoraje :: Beneficio: Mejoran la gestión financiera y de crédito. (Agente: Babel)",
  "38. Facturación y Cobranza - BD procedimiento de pagos de clientes :: Beneficio: Optimiza la gestión de pagos y cobros. (Agente: Babel)",
  "39. Facturación y Cobranza - Políticas de Crédito :: Beneficio: Evita problemas de flujo de efectivo y morosidad. (Agente: Babel)",
  "40. Normatividad - Plan para la constitución como contribuyente, actividades económicas y la deducibilidad y pago de los impuestos :: Beneficio: Asegura el cumplimiento de las obligaciones fiscales. (Agente: Fisnando)",
  "41. Normatividad - Alta en hacienda, IMSS, Infonavit :: Beneficio: Facilita el cumplimiento de las regulaciones laborales y fiscales. (Agente: Fisnando)",
  "42. Normatividad - Plan de implementación de NOM's y regulaciones :: Beneficio: Garantiza el cumplimiento de las normas y regulaciones aplicables. (Agente: Normau)",
  "43. Normatividad - Registro de Marca y logotipo :: Beneficio: Protege la propiedad intelectual de la empresa. (Agente: Normau)",
  "44. Normatividad - Registro de patentes :: Beneficio: Protege las innovaciones y desarrollos tecnológicos. (Agente: Normau)",
  "45. Normatividad - Contratos con clientes,  colaboradores y proveedores :: Beneficio: Establecen acuerdos claros y protegen los intereses de la empresa. (Agente: Normau)",
  "46. Consejo de administración - Evaluación de resultados :: Beneficio: Permite medir el desempeño y realizar ajustes necesarios. (Agente: Babel)",
  "47. Consejo de administración - Agile Strategy :: Beneficio: Facilita la adaptación rápida a cambios y mejora continua. (Agente: Babel)",
  "48. Consejo de administración - Seguimiento a proyectos estratégicos y de mejora continua :: Beneficio: Asegura el progreso y éxito de los proyectos. (Agente: Babel)",
  "49. Análisis Liderazgo - Perfil de liderazgo :: Beneficio: Identifica y desarrolla las habilidades de liderazgo necesarias. (Agente: Babel)",
  "50. Análisis Liderazgo - Análisis Valores, perfil y resultados :: Beneficio: Evalúa la alineación de los empleados con los valores y objetivos de la empresa. (Agente: Babel)",
  "51. Análisis Liderazgo - Trabajo en equipo :: Beneficio: Fomenta la colaboración y mejora el desempeño colectivo. (Agente: Babel)",
  "52. Análisis Liderazgo - 360 :: Beneficio: Proporciona retroalimentación integral para el desarrollo personal y profesional. (Agente: Babel)",
  "53. Alineación de Objetivos - OKR's :: Beneficio: Asegura que todos los empleados trabajen hacia los mismos objetivos. (Agente: Babel)",
  "54. Alineación de Objetivos - OLA's :: Beneficio: Establecen objetivos y resultados clave para medir el desempeño. (Agente: Babel)",
  "55. Alineación de Objetivos - Tablero de control individual :: Beneficio: Facilita el seguimiento del desempeño individual. (Agente: Babel)",
  "56. Generar cultura - Retroalimentación a la gente :: Beneficio: Mejora el desempeño y desarrollo de los empleados. (Agente: Normau)",
  "57. Generar cultura - Evaluación de desempeño mensual :: Beneficio: Permite realizar ajustes y mejoras continuas. (Agente: Normau)",
  "58. Generar cultura - Líderes del cambio :: Beneficio: Facilitan la implementación de cambios y mejoras. (Agente: Normau)",
  "59. Generar cultura - Capacitación :: Beneficio: Desarrolla las habilidades y conocimientos necesarios para el éxito. (Agente: Normau)",
  "60. Plan de Mercadotecnia - Análisis de la marca, Personalidad y Logotipo :: Beneficio: Ayuda a definir y fortalecer la identidad de la marca. (Agente: Karmetin)",
  "61. Plan de Mercadotecnia - FODA por familia de producto :: Beneficio: Identifica fortalezas, oportunidades, debilidades y amenazas específicas para cada línea de productos. (Agente: Karmetin)",
  "62. Plan de Mercadotecnia - Tamaño de mercados :: Beneficio: Proporciona información sobre el potencial de mercado. (Agente: Karmetin)",
  "63. Plan de Mercadotecnia - Canales de mercadotecnia e inversión por canal :: Beneficio: Optimiza la inversión en marketing. (Agente: Karmetin)",
  "64. Plan de Mercadotecnia - Proyección de ventas por producto :: Beneficio: Ayuda a planificar y gestionar las ventas. (Agente: Karmetin)",
  "65. Segmentación del Mercado - Proyección de ventas por producto :: Beneficio: Facilitan la gestión financiera y la comparación de costos vs ingresos. (Agente: Karmetin)",
  "66. Segmentación del Mercado - Buyer persona, Partner persona :: Beneficio: Define los perfiles de clientes y socios ideales. (Agente: Karmetin)",
  "67. Segmentación del Mercado - Customer Journey, Partner Journey :: Beneficio: Mapea la experiencia del cliente y del socio para mejorar la satisfacción. (Agente: Karmetin)",
  "68. Segmentación del Mercado - Generador de modelos de negocio biointeligencia estratégica :: Beneficio: Define los comportamientos de los usuarios (Agente: Karmetin)",
  "69. Segmentación del Mercado - Modelo Delta :: Beneficio: Define la segmentación con base en la psicología del comprador y las estrategias enfocadas en ello (Agente: Karmetin)",
  "70. Desarrollo de Producto - Lean Startup :: Beneficio: Lanzamientos de productos y servicios al mercado ágilmente (Agente: Karmetin)",
  "71. Manual de marca - Logotipo :: Beneficio: Establecen una identidad visual coherente. (Agente: Karmetin)",
  "72. Manual de marca - Colores institucionales :: Beneficio: Establecen una identidad visual coherente. (Agente: Karmetin)",
  "73. Manual de marca - Usos de la marca :: Beneficio: Establecen una identidad visual coherente. (Agente: Karmetin)",
  "74. Manual de marca - Formatos institucionales :: Beneficio: Establecen una identidad visual coherente. (Agente: Karmetin)",
  "75. Gestión de Canales - Definir y medir efectividades de canales :: Beneficio: Permite evaluar y optimizar los canales de marketing. (Agente: Karmetin)",
  "76. Gestión de Canales - Mensajes (Copy) e insumos por canal :: Beneficio: Asegura una comunicación efectiva y coherente. (Agente: Karmetin)",
  "77. Gestión de Canales - AIDA :: Beneficio: Modelos para mejorar la efectividad de las campañas de marketing. (Agente: Karmetin)",
  "78. Gestión de Canales - 10x10x10 :: Beneficio: Modelos para mejorar la efectividad de las campañas de marketing. (Agente: Karmetin)",
  "79. Mkt Digital - Implementación de campañas en redes sociales :: Beneficio: Diversifica y optimiza las estrategias de marketing digital. (Agente: Karmetin)",
  "80. Mkt Digital - E-mailing :: Beneficio: Diversifica y optimiza las estrategias de marketing digital. (Agente: Karmetin)",
  "81. Mkt Digital - Whatsapp :: Beneficio: Diversifica y optimiza las estrategias de marketing digital. (Agente: Karmetin)",
  "82. Mkt Digital - Página web :: Beneficio: Diversifica y optimiza las estrategias de marketing digital. (Agente: Karmetin)",
  "83. Mkt Digital - Landing Pages :: Beneficio: Diversifica y optimiza las estrategias de marketing digital. (Agente: Karmetin)",
  "84. Mkt Digital - Market Place :: Beneficio: Diversifica y optimiza las estrategias de marketing digital. (Agente: Karmetin)",
  "85. Mkt Digital - Tienda online :: Beneficio: Diversifica y optimiza las estrategias de marketing digital. (Agente: Karmetin)",
  "86. Proyección de ventas - Planeación de la cuenta :: Beneficio: Mejora la gestión de ventas y relaciones con clientes. (Agente: Karmetin)",
  "87. Proyección de ventas - CRM :: Beneficio: Mejora la gestión de ventas y relaciones con clientes. (Agente: Karmetin)",
  "88. Proyección de ventas - Funnel :: Beneficio: Mejora la gestión de ventas y relaciones con clientes. (Agente: Karmetin)",
  "89. Proyección de ventas - Hit Rate :: Beneficio: Mejora la gestión de ventas y relaciones con clientes. (Agente: Karmetin)",
  "90. Proyección de ventas - Ciclo de ventas :: Beneficio: Mejora la gestión de ventas y relaciones con clientes. (Agente: Karmetin)",
  "91. Material de ventas - Guía de apertura, detección de necesidades,  manejo de objeciones y cierre :: Beneficio: Facilita el proceso de ventas y mejora la efectividad. (Agente: Karmetin)",
  "92. Material de ventas - Presentación de Ventas :: Beneficio: Facilita el proceso de ventas y mejora la efectividad. (Agente: Karmetin)",
  "93. Material de ventas - Propuesta comercial 3 opciones :: Beneficio: Facilita el proceso de ventas y mejora la efectividad. (Agente: Karmetin)",
  "94. Material de ventas - Rentabilidad por cliente y proyecto :: Beneficio: Facilita el proceso de ventas y mejora la efectividad. (Agente: Karmetin)",
  "95. Estrategias de Ventas - Abrir puertas :: Beneficio: Optimiza el ciclo de ventas. (Agente: Karmetin)",
  "96. Estrategias de Ventas - Cotización :: Beneficio: Optimiza el ciclo de ventas. (Agente: Karmetin)",
  "97. Estrategias de Ventas - Negociación :: Beneficio: Optimiza el ciclo de ventas. (Agente: Karmetin)",
  "98. Estrategias de Ventas - Cierre :: Beneficio: Optimiza el ciclo de ventas. (Agente: Karmetin)",
  "99. Estrategias de Ventas - Inicio de operaciones :: Beneficio: Optimiza el ciclo de ventas. (Agente: Karmetin)",
  "100. Satisfacción de Clientes - BD quejas y requerimientos :: Beneficio: Mejora la gestión de la satisfacción del cliente. (Agente: Karmetin)",
  "101. Satisfacción de Clientes - Encuesta Satisfacción de Clientes :: Beneficio: Mejora la gestión de la satisfacción del cliente. (Agente: Karmetin)",
  "102. Satisfacción de Clientes - Encuestas Transaccionales :: Beneficio: Mejora la gestión de la satisfacción del cliente. (Agente: Karmetin)",
  "103. Experiencia del Cliente - Diseño de momentos sorprendentes :: Beneficio: Mejora la experiencia del cliente y reduce la tasa de cancelación. (Agente: Karmetin)",
  "104. Experiencia del Cliente - Protocolo de Atención :: Beneficio: Mejora la experiencia del cliente y reduce la tasa de cancelación. (Agente: Karmetin)",
  "105. Experiencia del Cliente - Modelo de Servicio :: Beneficio: Mejora la experiencia del cliente y reduce la tasa de cancelación. (Agente: Karmetin)",
  "106. Experiencia del Cliente - Riesgos de Cancelación :: Beneficio: Mejora la experiencia del cliente y reduce la tasa de cancelación. (Agente: Karmetin)",
  "107. Plan Operativo - Administración de proyectos para plan de producción :: Beneficio: Facilita la gestión eficiente de proyectos. (Agente: Atech)",
  "108. Plan Operativo - Administración de proyectos de las etapas de la instalación :: Beneficio: Facilita la gestión eficiente de proyectos. (Agente: Atech)",
  "109. Plan Operativo - Administración de proyectos de la logística de entrega :: Beneficio: Facilita la gestión eficiente de proyectos. (Agente: Atech)",
  "110. Plan Operativo - Administración de proyectos  de las etapas del servicio :: Beneficio: Facilita la gestión eficiente de proyectos. (Agente: Atech)",
  "111. Plan Operativo - Administración de proyectos Nuevos productos y Servicios :: Beneficio: Facilita la gestión eficiente de proyectos. (Agente: Atech)",
  "112. Manejo de inventario - Ingresos y salidas de almacenes :: Beneficio: Optimiza la gestión de inventarios y almacenes. (Agente: Atech)",
  "113. Manejo de inventario - Control de inventarios :: Beneficio: Optimiza la gestión de inventarios y almacenes. (Agente: Atech)",
  "114. Manejo de inventario - Seguridad de los almacenes :: Beneficio: Optimiza la gestión de inventarios y almacenes. (Agente: Atech)",
  "115. Desarrollo de Proveedores - Selección de Proveedores :: Beneficio: Mejora la gestión de la cadena de suministro. (Agente: Atech)",
  "116. Desarrollo de Proveedores - Evaluación de Proveedores :: Beneficio: Mejora la gestión de la cadena de suministro. (Agente: Atech)",
  "117. Desarrollo de Proveedores - Capacitación de y a los proveedores :: Beneficio: Mejora la gestión de la cadena de suministro. (Agente: Atech)",
  "118. Mejora Continua - Captación de ideas de Mejora Continua e innovación :: Beneficio: Fomenta la innovación y mejora continua. (Agente: Atech)",
  "119. Mejora Continua - BD de proyectos de MC&I :: Beneficio: Fomenta la innovación y mejora continua. (Agente: Atech)",
  "120. Mejora Continua - Comité de  MC&I :: Beneficio: Fomenta la innovación y mejora continua. (Agente: Atech)",
  "121. Procesos - Mapa general de procesos :: Beneficio: Mejora la eficiencia operativa y asegura el cumplimiento de estándares. (Agente: Atech)",
  "122. Procesos - Procesos :: Beneficio: Mejora la eficiencia operativa y asegura el cumplimiento de estándares. (Agente: Atech)",
  "123. Procesos - Procedimientos :: Beneficio: Mejora la eficiencia operativa y asegura el cumplimiento de estándares. (Agente: Atech)",
  "124. Procesos - KPI's :: Beneficio: Mejora la eficiencia operativa y asegura el cumplimiento de estándares. (Agente: Atech)",
  "125. Procesos - Certificación :: Beneficio: Mejora la eficiencia operativa y asegura el cumplimiento de estándares. (Agente: Atech)",
  "126. Clima laboral - Encuesta de Clima laboral :: Beneficio: Mejora el ambiente laboral y el desarrollo profesional. (Agente: Normau)",
  "127. Clima laboral - Evaluación de Riesgos Psicosociales :: Beneficio: Mejora el ambiente laboral y el desarrollo profesional. (Agente: Normau)",
  "128. Clima laboral - Plan de acción de Clima y Riesgos :: Beneficio: Mejora el ambiente laboral y el desarrollo profesional. (Agente: Normau)",
  "129. Clima laboral - Plan de Carrera :: Beneficio: Mejora el ambiente laboral y el desarrollo profesional. (Agente: Normau)",
  "130. Clima laboral - Plan de Capacitación :: Beneficio: Mejora el ambiente laboral y el desarrollo profesional. (Agente: Normau)",
  "131. Retención del personal - Programa de OnBoarding :: Beneficio: Mejora el ambiente laboral y el desarrollo profesional. (Agente: Normau)",
  "132. Retención del personal - Evaluación de operatividad :: Beneficio: Permite evaluar y mejorar el desempeño organizacional. (Agente: Normau)",
  "133. Retención del personal - Evaluación de Estabilidad :: Beneficio: Permite evaluar y mejorar el desempeño organizacional. (Agente: Normau)",
  "134. Retención del personal - Evaluación de Adaptabilidad :: Beneficio: Permite evaluar y mejorar el desempeño organizacional. (Agente: Normau)",
  "135. Retención del personal - Evaluación de Resultados :: Beneficio: Permite evaluar y mejorar el desempeño organizacional. (Agente: Normau)",
  "136. Selección del personal - Descripción de puestos :: Beneficio: Mejora la gestión del talento y la selección (Agente: Normau)",
  "137. Selección del personal - Psicométricos :: Beneficio: Mejora la gestión del talento y la selección (Agente: Normau)",
  "138. Selección del personal - Evaluación Candidato - Líder :: Beneficio: Mejora la gestión del talento y la selección (Agente: Normau)",
  "139. Selección del personal - Validación de referencias :: Beneficio: Mejora la gestión del talento y la selección (Agente: Normau)",
  "140. Selección del personal - Estudio socio-económico :: Beneficio: Mejora la gestión del talento y la selección (Agente: Normau)",
  "141. Workflows en la nube - Flujos de trabajo por área :: Beneficio: Mejora en la eficiencia operativa, la comunicación interáreas, mayor control y seguimiento, reducción de costos, cumplimiento y seguridad, mejor experiencia para clientes y colaboradores (Agente: Atech)",
  "142. Workflows en la nube - Flujos de trabajo entre áreas :: Beneficio: Mejora en la eficiencia operativa, la comunicación interáreas, mayor control y seguimiento, reducción de costos, cumplimiento y seguridad, mejor experiencia para clientes y colaboradores (Agente: Atech)",
  "143. Workflows en la nube - Flujos de trabajo con Clientes externos :: Beneficio: Mejora en la eficiencia operativa, la comunicación interáreas, mayor control y seguimiento, reducción de costos, cumplimiento y seguridad, mejor experiencia para clientes y colaboradores (Agente: Atech)",
  "144. Workflows en la nube - Flujos de Trabajo con Proveedores :: Beneficio: Mejora en la eficiencia operativa, la comunicación interáreas, mayor control y seguimiento, reducción de costos, cumplimiento y seguridad, mejor experiencia para clientes y colaboradores (Agente: Atech)",
  "145. Análisis de información estratégica - Herramientas de estrategia que generen bases de datos y reportes :: Beneficio: Mejora en la eficiencia operativa, la comunicación interáreas, mayor control y seguimiento, reducción de costos, cumplimiento y seguridad, mejor experiencia para clientes y colaboradores (Agente: Atech)",
  "146. Análisis de información financiera - Herramientas de finanzas que generen bases de datos y reportes :: Beneficio: Mejora en la eficiencia operativa, la comunicación interáreas, mayor control y seguimiento, reducción de costos, cumplimiento y seguridad, mejor experiencia para clientes y colaboradores (Agente: Atech)",
  "147. Análisis de información mercadológica - Herramientas de mercadotecnia que generen bases de datos y reportes :: Beneficio: Mejora en la eficiencia operativa, la comunicación interáreas, mayor control y seguimiento, reducción de costos, cumplimiento y seguridad, mejor experiencia para clientes y colaboradores (Agente: Atech)",
  "148. Análisis de información liderazgo - Herramientas de liderazgo que generen bases de datos y reportes :: Beneficio: Mejora en la eficiencia operativa, la comunicación interáreas, mayor control y seguimiento, reducción de costos, cumplimiento y seguridad, mejor experiencia para clientes y colaboradores (Agente: Atech)",
  "149. Análisis de información normativa - Herramientas de Normatividad que generen bases de datos y reportes :: Beneficio: Mejora en la eficiencia operativa, la comunicación interáreas, mayor control y seguimiento, reducción de costos, cumplimiento y seguridad, mejor experiencia para clientes y colaboradores (Agente: Atech)",
  "150. Análisis de información comercial - CRM :: Beneficio: Mejora en la eficiencia operativa, la comunicación interáreas, mayor control y seguimiento, reducción de costos, cumplimiento y seguridad, mejor experiencia para clientes y colaboradores (Agente: Atech)",
  "151. Análisis de información de clientes - Rastreo de Clientes :: Beneficio: Mejora en la eficiencia operativa, la comunicación interáreas, mayor control y seguimiento, reducción de costos, cumplimiento y seguridad, mejor experiencia para clientes y colaboradores (Agente: Atech)",
  "152. Análisis de información de capital humano - Herramientas de capital humano que generen bases de datos y reportes :: Beneficio: Mejora en la eficiencia operativa, la comunicación interáreas, mayor control y seguimiento, reducción de costos, cumplimiento y seguridad, mejor experiencia para clientes y colaboradores (Agente: Atech)",
  "153. Análisis de información operativa - ERP :: Beneficio: Mejora en la eficiencia operativa, la comunicación interáreas, mayor control y seguimiento, reducción de costos, cumplimiento y seguridad, mejor experiencia para clientes y colaboradores (Agente: Atech)",
];

function buildSystemPrompt(language: 'es' | 'en', roles: RoleParaIA[]): string {
  const catalogo = BUENAS_PRACTICAS_LINES.join('\n');
  const rolesLines = roles.map((r) => '- ' + r.key + ': ' + r.nombre).join('\n');
  if (language === 'en') {
    const rolesBlock =
      roles.length > 0
        ? '\n\nYou also receive a fixed list of organizational ROLES (org chart) this company has defined, one per line as "key: label":\n' +
          rolesLines +
          '\n\nFor each Action, also propose which role should be responsible for it. Pick EXACTLY one "key" from that list (copy it ' +
          'verbatim, do not invent a new key), or use an empty string "" if none of the given roles clearly fits.'
        : '';
    return (
      'You are Babel, a strategic business architect. The user gives you a Strategic Objective, a Threat or Opportunity linked to it, ' +
      'and a Strength or Weakness linked to that Threat/Opportunity. You also receive a fixed CATALOG of 153 real best practices used by ' +
      'this consulting methodology (each line has the format "#. Framework - Practice :: Benefit: ... (Agent: ...)").\n\n' +
      'Your task: from that CATALOG ONLY (never invent a practice that is not in the list), pick between 1 and 6 practices that are ' +
      'GENUINELY relevant to close or leverage the given Threat/Opportunity and Strength/Weakness - this is not a fixed quota. Before ' +
      'choosing a practice, verify its Framework and Benefit actually belong to the same business area as the given Threat/Opportunity ' +
      'and Strength/Weakness (for example, do not propose a Marketing practice for a purely operational weakness, or a Production ' +
      'practice for a purely financial opportunity, just to fill a number). If fewer than 3 practices genuinely fit, propose only those - ' +
      'NEVER force an unrelated practice to reach a minimum. Use the Benefit text of each chosen row only as your OWN internal criterion ' +
      'for picking it - do NOT copy the Benefit text into the output.\n\n' +
      'For each chosen practice, write ONE concrete Action whose description is built as an INFINITIVE VERB (e.g. "Define", "Implement", ' +
      '"Create", "Document", "Design") followed by the practice text taken from the catalog line (the part after " - " and before " :: "), ' +
      'adapted into a natural, grammatically correct action phrase, max 200 characters. Also propose a short concrete deliverable ' +
      '(max 80 characters) for that action. At least one of the proposed actions should surface a non-obvious angle the user is unlikely ' +
      'to have already considered - not merely restate what the Strength/Weakness text already implies.' + rolesBlock + '\n\n' +
      'Respond with ONLY a raw JSON array (no markdown fences, no prose before or after), between 1 and 6 items, where each item has ' +
      'EXACTLY this shape:\n' +
      '{"descripcion":"infinitive verb + practice, one concrete sentence, max 200 characters","entregable":"short deliverable, max 80 characters","responsableRoleKey":"one role key from the list, or empty string"}' +
      '\n\nCATALOG:\n' + catalogo
    );
  }
  const rolesBlockEs =
    roles.length > 0
      ? '\n\nTambien recibes una lista fija de ROLES del organigrama que esta empresa ya definio, uno por linea como "key: etiqueta":\n' +
        rolesLines +
        '\n\nPara cada Accion, propon tambien que rol deberia ser el responsable. Elige EXACTAMENTE un "key" de esa lista (copialo tal ' +
        'cual, no inventes uno nuevo), o usa cadena vacia "" si ninguno de los roles dados encaja claramente.'
      : '';
  return (
    'Eres Babel, un arquitecto estrategico de negocios. El usuario te da un Objetivo Estrategico, una Amenaza u Oportunidad ligada a ese ' +
    'objetivo, y una Fortaleza o Debilidad ligada a esa Amenaza/Oportunidad. Tambien recibes un CATALOGO fijo de 153 Buenas Practicas ' +
    'reales de esta metodologia de consultoria (cada linea tiene el formato "#. Marco de Referencia - Practica :: Beneficio: ... (Agente: ...)").\n\n' +
    'Tu tarea: de ese CATALOGO UNICAMENTE (nunca inventes una practica que no este en la lista), elige entre 1 y 6 practicas que sean ' +
    'GENUINAMENTE relevantes para atender o aprovechar la Amenaza/Oportunidad y la Fortaleza/Debilidad dadas - esto NO es una cuota fija. ' +
    'Antes de elegir una practica, verifica que su Marco de Referencia y Beneficio pertenezcan realmente a la misma area de negocio que ' +
    'la Amenaza/Oportunidad y la Fortaleza/Debilidad dadas (por ejemplo, no propongas una practica de Mercadotecnia para una debilidad ' +
    'puramente operativa, ni una practica de Produccion para una oportunidad puramente financiera, solo para llegar a un numero). Si ' +
    'menos de 3 practicas encajan genuinamente, propon solo esas - NUNCA fuerces una practica no relacionada para llegar a un minimo. Usa ' +
    'el texto de Beneficio de cada fila elegida SOLO como tu propio criterio interno para seleccionarla - NO copies el texto del Beneficio ' +
    'en la salida.\n\n' +
    'Para cada practica elegida, redacta UNA Accion concreta cuya descripcion se construya como un VERBO EN INFINITIVO (por ejemplo ' +
    '"Definir", "Implementar", "Crear", "Documentar", "Disenar") seguido del texto de la practica tomado del catalogo (la parte entre ' +
    '" - " y " :: "), adaptado en una frase de accion natural y gramaticalmente correcta, maximo 200 caracteres. Tambien propon un ' +
    'entregable concreto y breve (maximo 80 caracteres) para esa accion. Al menos una de las acciones propuestas debe aportar un angulo ' +
    'no evidente que el usuario probablemente no habia considerado - no solo repetir lo que ya implica el texto de la Fortaleza/Debilidad.' +
    rolesBlockEs + '\n\n' +
    'Responde UNICAMENTE con un arreglo JSON puro (sin marcadores de markdown, sin texto antes ni despues), entre 1 y 6 elementos, donde ' +
    'cada elemento tenga EXACTAMENTE esta forma:\n' +
    '{"descripcion":"verbo en infinitivo + practica, una frase concreta, maximo 200 caracteres","entregable":"entregable breve, maximo 80 caracteres","responsableRoleKey":"un key de rol de la lista, o cadena vacia"}' +
    '\n\nCATALOGO:\n' + catalogo
  );
}

function extractJsonArray(text: string): unknown {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  }
  return JSON.parse(cleaned);
}

async function tryGemini(systemPrompt: string, userMessage: string, diagnostics: Diagnostic[]): Promise<unknown[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(GEMINI_ENDPOINT + '?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      diagnostics.push({ provider: 'gemini', status: 'error', error: JSON.stringify(data).slice(0, 300) });
      return null;
    }
    const blockReason = data && data.promptFeedback && data.promptFeedback.blockReason;
    if (blockReason) {
      diagnostics.push({ provider: 'gemini', status: 'blocked', error: blockReason });
      return null;
    }
    const text = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    if (!text) {
      diagnostics.push({ provider: 'gemini', status: 'empty_response' });
      return null;
    }
    const parsed = extractJsonArray(text);
    if (!Array.isArray(parsed)) {
      diagnostics.push({ provider: 'gemini', status: 'not_array' });
      return null;
    }
    diagnostics.push({ provider: 'gemini', status: 'ok' });
    return parsed;
  } catch (err) {
    diagnostics.push({ provider: 'gemini', status: 'exception', error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

async function tryOpenAICompatible(
  systemPrompt: string,
  userMessage: string,
  endpoint: string,
  model: string,
  apiKey: string | undefined,
  label: string,
  diagnostics: Diagnostic[],
): Promise<unknown[] | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      diagnostics.push({ provider: label, status: 'error', error: JSON.stringify(data).slice(0, 300) });
      return null;
    }
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) {
      diagnostics.push({ provider: label, status: 'empty_response' });
      return null;
    }
    const parsed = extractJsonArray(text);
    if (!Array.isArray(parsed)) {
      diagnostics.push({ provider: label, status: 'not_array' });
      return null;
    }
    diagnostics.push({ provider: label, status: 'ok' });
    return parsed;
  } catch (err) {
    diagnostics.push({ provider: label, status: 'exception', error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    route: '/api/babel/extractor-acciones',
    note: 'Extractor de Acciones a partir del catalogo real de 153 Buenas Practicas (Belsua-MBE), tomando como contexto el Objetivo, la Amenaza/Oportunidad y la Fortaleza/Debilidad',
  });
}

export async function POST(req: NextRequest) {
  let body: ExtractorAccionesRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido.' }, { status: 400 });
  }

  const language = body.language === 'en' ? 'en' : 'es';
  const objetivo = typeof body.objetivo === 'string' ? body.objetivo.trim() : '';
  const entornoTipo = typeof body.entornoTipo === 'string' ? body.entornoTipo.trim() : '';
  const entornoDescripcion = typeof body.entornoDescripcion === 'string' ? body.entornoDescripcion.trim() : '';
  const fdTipo = typeof body.fdTipo === 'string' ? body.fdTipo.trim() : '';
  const fdDescripcion = typeof body.fdDescripcion === 'string' ? body.fdDescripcion.trim() : '';
  const roles: RoleParaIA[] = Array.isArray(body.roles)
    ? body.roles
        .filter((r) => r && typeof r.key === 'string' && typeof r.nombre === 'string')
        .map((r) => ({ key: r.key.trim(), nombre: r.nombre.trim() }))
        .filter((r) => r.key && r.nombre)
    : [];

  if (!entornoDescripcion) {
    return NextResponse.json(
      {
        error:
          language === 'en'
            ? 'The Threat/Opportunity description is missing.'
            : 'Falta la descripcion de la Amenaza/Oportunidad.',
      },
      { status: 400 },
    );
  }

  if (!fdDescripcion) {
    return NextResponse.json(
      {
        error:
          language === 'en'
            ? 'The Strength/Weakness description is missing.'
            : 'Falta la descripcion de la Fortaleza/Debilidad.',
      },
      { status: 400 },
    );
  }

  const systemPrompt = buildSystemPrompt(language, roles);
  const entornoLabel =
    entornoTipo === 'amenaza' ? (language === 'en' ? 'Threat' : 'Amenaza') : language === 'en' ? 'Opportunity' : 'Oportunidad';
  const fdLabel =
    fdTipo === 'fortaleza' ? (language === 'en' ? 'Strength' : 'Fortaleza') : language === 'en' ? 'Weakness' : 'Debilidad';

  const userMessage =
    (language === 'en' ? 'Strategic Objective: ' : 'Objetivo Estrategico: ') +
    objetivo.slice(0, 500) +
    '\n' +
    entornoLabel +
    ': ' +
    entornoDescripcion.slice(0, 500) +
    '\n' +
    fdLabel +
    ': ' +
    fdDescripcion.slice(0, 500);

  const diagnostics: Diagnostic[] = [];

  let result: unknown[] | null = await tryOpenAICompatible(
    systemPrompt,
    userMessage,
    FALLBACK_ENDPOINT,
    FALLBACK_MODEL,
    process.env.FALLBACK_API_KEY,
    'groq',
    diagnostics,
  );

  if (!result) {
    result = await tryOpenAICompatible(
      systemPrompt,
      userMessage,
      TERTIARY_ENDPOINT,
      TERTIARY_MODEL,
      process.env.TERTIARY_API_KEY,
      'openrouter',
      diagnostics,
    );
  }

  if (!result) {
    result = await tryGemini(systemPrompt, userMessage, diagnostics);
  }

  if (!result && ROUTER_ENDPOINT) {
    result = await tryOpenAICompatible(
      systemPrompt,
      userMessage,
      ROUTER_ENDPOINT.replace(/\/$/, '') + '/chat/completions',
      ROUTER_MODEL,
      process.env.ROUTER_API_KEY || 'no-key-needed',
      '9router',
      diagnostics,
    );
  }

  if (!result) {
    return NextResponse.json(
      {
        error:
          language === 'en'
            ? 'None of the configured AI providers could generate the proposal.'
            : 'Ninguno de los proveedores de IA configurados pudo generar la propuesta.',
        diagnostics: diagnostics,
        tip:
          language === 'en'
            ? 'Check that FALLBACK_API_KEY (Groq), TERTIARY_API_KEY (OpenRouter) or GEMINI_API_KEY are set in Vercel.'
            : 'Verifica que FALLBACK_API_KEY (Groq), TERTIARY_API_KEY (OpenRouter) o GEMINI_API_KEY esten configuradas en Vercel.',
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ sugerencias: result.slice(0, 6) });
}
