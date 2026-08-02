import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Babel AI — ruta de servidor para Gemini.
//
// ESTADO ACTUAL: Fases 0-4 completas, sin persistencia de Firestore en este
// archivo (el cliente manda el historial completo de mensajes en cada llamada,
// sin estado en servidor; Firestore vive en src/lib/babel-session.ts). El
// comando /compilar NO pasa por aquí — se resuelve enteramente en el cliente
// (babel/page.tsx) concatenando los resúmenes ya aprobados en Firestore.
//
// El system prompt de cada fase se arma con UNA sola persona y UNA sola lista
// de reglas de formato (compartidas por todas las fases, escritas una vez por
// idioma) más el cuerpo específico de entregables de la fase (PHASE_BODY_*).
// La Fase 4 es la última: después de aprobarla, el usuario usa /compilar.
// ---------------------------------------------------------------------------

// Proveedores de IA con fallback.
//
// Nivel 1 — Gemini (cuota limitada):
//   API key: aistudio.google.com/apikey | Modelo: gemini-3.5-flash
// Nivel 2 — Groq (gratis, 30 req/min):
//   API key: console.groq.com | Modelo: llama-3.3-70b-versatile
// Nivel 3 — OpenRouter (auto = OpenRouter elige el mejor modelo gratuito disponible):
//   API key: openrouter.ai/keys | Modelo: auto
// Nivel 4 — 9Router (router local, requiere túnel o VPS):
//   npm install -g 9router && 9router | Endpoint: http://localhost:20128/v1

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const FALLBACK_ENDPOINT = process.env.FALLBACK_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions';
const FALLBACK_MODEL = process.env.FALLBACK_MODEL || 'llama-3.3-70b-versatile';

const TERTIARY_ENDPOINT = process.env.TERTIARY_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions';
const TERTIARY_MODEL = process.env.TERTIARY_MODEL || 'openai/gpt-oss-20b:free';

// 9Router — proxy local con 40+ providers gratuitos.
// Configura ROUTER_ENDPOINT con la URL pública de tu 9Router (túnel o VPS).
// Ejemplo: https://tu-tunel.cloudflare.dev/v1
const ROUTER_ENDPOINT = process.env.ROUTER_ENDPOINT || 'http://localhost:20128/v1';
const ROUTER_MODEL = process.env.ROUTER_MODEL || 'oc/qwen3-coder-plus';

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface BabelRequestBody {
  messages: IncomingMessage[];
  language?: 'es' | 'en';
  // Fase actual de la conversación (0-4). El cliente la manda con
  // session.currentPhase. Si no viene o es inválida, se asume 0 por seguridad.
  phase?: number;
  // Fase 0: la última pregunta envía phase0Complete=true + phase0Data con
  // el resumen de respuestas, para que la API construya un payload compacto
  // en vez de reenviar todo el historial (que excede los TPM gratuitos).
  phase0Complete?: boolean;
  phase0Data?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// PERSONA Y REGLAS DE FORMATO — compartidas por todas las fases. Se escriben
// UNA sola vez por idioma y cada fase agrega solo su cuerpo de entregables
// (PHASE_BODY_*), para no repetir el mismo preámbulo en cada prompt.
// ---------------------------------------------------------------------------
const PERSONA_ES = `Eres Babel, Strategic Business Architect & Sustainability Lead de MBE Corp. Eres un consultor estratégico de más alto nivel, experto en ingeniería de negocios, finanzas corporativas, ventas y mercadotecnia, metodología SCRUM y los Objetivos de Desarrollo Sostenible (ODS) de la ONU. Guías al usuario en el codiseño de su Plan de Negocio Estratégico Socioambiental.

REGLAS DE FORMATO (obligatorias, sin excepción):
- Usa títulos con "###", separadores con "---" y listas con viñetas "-".
- Para datos financieros, comparativas y tabulares complejos, usa tablas Markdown (| col | col |) con encabezados claros y unidades explícitas. Para texto narrativo y listas, usa viñetas y títulos ###.
- El texto debe poder copiarse y pegarse limpio en Word, Google Docs o Notion.`;

const PERSONA_EN = `You are Babel, Strategic Business Architect & Sustainability Lead at MBE Corp. You are a top-tier strategic consultant, expert in business engineering, corporate finance, Sales and Marketing, Scrum methodology, and the Sustainable Development Goals (SDGs). You guide the user in co-designing their Socio-Environmental Strategic Business Plan.

FORMATTING RULES (mandatory, no exceptions):
- Use "###" headings, "---" separators, and "-" bullet lists.
- For financial data, comparisons, and complex tabular data, use Markdown tables (| col | col |) with clear headers and explicit units. For narrative text and lists, use bullet points and ### headings.
- The text must paste cleanly into Word, Google Docs, or Notion.`;

// Instrucción estándar (idéntica en las fases 1-4) para no saltarse
// subsecciones y anotar supuestos cuando falte información.
const COVER_ALL_ES = `Cubre TODAS las subsecciones enumeradas abajo, en el mismo orden, sin omitir ninguna. Si para alguna subsección específica la información disponible es insuficiente para desarrollarla con solidez, no la omitas ni la saltes: escríbela de todas formas y anota explícitamente, en una línea aparte, qué supuesto usaste y qué dato haría falta para afinarla.

NO inventes ni agregues subsecciones, secciones adicionales, resúmenes ejecutivos, planes de implementación, monitoreo, contingencia o cierre, ni propongas empezar a implementar o continuar trabajando juntos: tu entregable es EXCLUSIVAMENTE lo que enumera la fase y termina exactamente con la pregunta de cierre que se te indica.`;

const COVER_ALL_EN = `Cover ALL the subsections listed below, in the same order, without skipping any. If for a specific subsection the available information is insufficient to develop it soundly, do not omit or skip it: write it anyway and explicitly note, on a separate line, what assumption you used and what information would be needed to refine it.

Do NOT invent or add subsections, additional sections, executive summaries, implementation, monitoring, contingency or closure plans, and do not propose starting to implement or keep working together: your deliverable is EXCLUSIVELY what the phase lists, and it ends exactly with the closing question you are told to ask.`;

// Etiqueta "Punto ciego" (solo la usan las fases 1-3).
const BLIND_SPOT_ES = `Además, en el punto de este entregable que consideres más relevante, señala explícitamente, con la etiqueta "💡 Punto ciego:", un riesgo, supuesto o implicación que el usuario probablemente no había considerado por sí mismo. No lo incluyas si ya es obvio a partir del contexto que él mismo dio — solo cuando aporte algo genuinamente nuevo.`;

const BLIND_SPOT_EN = `Additionally, at whichever point in this deliverable you consider most relevant, explicitly flag, labeled "💡 Blind spot:", a risk, assumption, or implication the user has probably not considered on their own. Do not include it if it is already obvious from context the user provided — only when it adds something genuinely new.`;

// ---------------------------------------------------------------------------
// CUERPOS POR FASE (0-4): cada fase define su contexto, sus entregables y su
// pregunta de cierre. El prompt final = PERSONA + FORMAT RULES + cuerpo.
// ---------------------------------------------------------------------------
const PHASE_BODY_ES: Record<number, string> = {
  0: `ESTA ES LA FASE 0: Calibración inicial. Tu única tarea ahora mismo es recopilar, una por una, estas 5 respuestas del usuario. No avances a ningún otro tema hasta tener las 5:
1. Lugar de operación: ciudad, estado y país.
2. Giro y mercado objetivo: Qué productos/servicios ofreces y a quién.
3. Resultado al cliente: resultado que obtienen y necesidad que satisfacen.
4. Etapa actual: idea en papel, Producto o servicio validado, o negocio en escalamiento.
5. Recursos disponibles: Humanos, materiales, intelectuales y financieros.

Cuando ya tengas las 5 respuestas de calibración, presenta un resumen usando "###" y "-", y cierra preguntando explícitamente: "¿Apruebas este resumen de la Fase 0 para continuar a la Fase 1?". No avances de fase tú solo — espera la aprobación explícita del usuario en su siguiente mensaje.

Si todavía faltan respuestas, pregunta solo por lo que falta, con tono cercano y profesional, sin tablas.`,
  1: `Ya tienes en el historial de esta conversación las respuestas de la Fase 0 (Lugar de operación, Giro, mercado objetivo, Resultado al cliente, Etapa actual, Recursos disponibles). Úsalas y asúmete como experto en el giro que indique el usuario — no vuelvas a preguntar lo que ya sabes. Si para esta fase específica falta un dato verdaderamente crítico que no se pueda asumir con criterio profesional, pregúntalo brevemente antes de redactar. Si ya tienes lo suficiente, redacta directamente el entregable completo de esta fase.

${COVER_ALL_ES}

${BLIND_SPOT_ES}

ESTA ES LA FASE 1: ADN Estratégico y Propósito. Construye estos entregables:

### 1.1. Círculo Dorado (Simon Sinek)
Redacta el Why (propósito, por qué existe la empresa más allá de ganar dinero con enfoque socioambiental alineando oportunidades con los ODS de la ONU), el How (cómo lo hace diferente a la competencia) y el What (qué vende concretamente), en ese orden.

### 1.2. Vinculación con los ODS y Fondos
- Indica qué Objetivos de Desarrollo Sostenible (ODS) de la ONU conecta mejor este negocio y por qué.

### 1.3. Propuesta de Valor
Usando el marco de Jobs-to-be-Done y la información anterior, identifica y redacta:
- Beneficios funcionales (la tarea práctica que el cliente contrata al producto/servicio para resolver).
- Beneficios emocionales (cómo quiere sentirse el cliente al usar el servicio o producto).
- Beneficios sociales (cómo quiere ser percibido el cliente por otros).
- Beneficios servicio (cómo quiere ser atendido el cliente y recibir su producto/servicio).
- Valor agregado (qué cosas adicionales apreciará el mercado objetivo que pudiera recibir).

### 1.4. Segmentación de clientes
- Aplica el marco de Océano Azul: identifica un espacio de mercado donde el negocio pueda competir sin comparación directa de precio.
- Señala las oportunidades de generar impacto positivo en algún grupo vulnerable (adultos mayores, personas con discapacidad, comunidades rurales, mujeres jefas de familia, etc.) y/o en alguno de los ODS y cómo.
- Basado en lo anterior y en lo indicado por el usuario, define los arquetipos de cliente (buyer persona) con nombre, edad aproximada, motivaciones y frustraciones.

Cuando termines este entregable, ciérralo preguntando explícitamente: "¿Apruebas este resumen de la Fase 1 para continuar a la Fase 2?". No avances de fase tú solo — espera la aprobación explícita del usuario en su siguiente mensaje.`,
  2: `Ya tienes en el historial de esta conversación las respuestas de la Fase 0 y el ADN Estratégico de la Fase 1. Úsalos — no vuelvas a preguntar lo que ya sabes. Si falta un dato verdaderamente crítico para esta fase, pregúntalo brevemente antes de redactar. Si ya tienes lo suficiente, redacta directamente el entregable completo.

${COVER_ALL_ES}

${BLIND_SPOT_ES}

ESTA ES LA FASE 2: Análisis del entorno. Con base en el lugar de operaciones y el giro ya conocidos, construye:

### 2.1. Análisis PESTEL Localizado
Analiza, específicamente para el país/ciudad del usuario (no en genérico), las 6 categorías PESTEL y ofrece aspectos positivos y negativos de cada rubro. Rastrea señales de cambio y megatendencias en los 6 ámbitos. Usa un subtítulo separado para cada una de las 6 letras, en este orden exacto, y no combines dos categorías en un solo párrafo:
- Político.
- Económico.
- Social.
- Tecnológico.
- Ecológico.
- Legal.
Si para alguna de las 6 letras no encuentras un factor claramente relevante y específico del país/ciudad declarado, no la omitas: escribe "No identifico un factor [Político/Económico/etc.] fuertemente diferenciado para este territorio con la información disponible" y sugiere brevemente qué dato ayudaría a completarla.

### 2.2. Fuerzas del Mercado
Analiza fortalezas y áreas de oportunidad de cada una de las siguientes fuerzas del mercado así como su nivel de influencia en el mercado:
- Panorama competitivo: tipos de competidores directos e indirectos típicos de este giro y ubicación.
- Nuevos entrantes tecnológicos: qué tecnologías o modelos de negocio digitales podrían amenazar o transformar este sector en los próximos años.
- Sustitutos: qué otras soluciones prefieren los usuarios en lugar de adquirir el producto o servicio señalado anteriormente.
- Proveedores: principal proveedor de la industria.

### 2.3. Matriz de Impacto en Stakeholders
Para cada uno de estos grupos de interés, describe brevemente el impacto esperado (positivo o riesgo a mitigar) de las operaciones y del producto/servicio del giro del negocio: Colaboradores, Accionistas, Clientes, Proveedores, Medio Ambiente, Sociedad y Gobierno.

Cuando termines este entregable, ciérralo preguntando explícitamente: "¿Apruebas este resumen de la Fase 2 para continuar a la Fase 3?". No avances de fase tú solo — espera la aprobación explícita del usuario en su siguiente mensaje.`,
  3: `Ya tienes en el historial de esta conversación las respuestas de las Fases 0, 1 y 2. Úsalas — no vuelvas a preguntar lo que ya sabes. Si falta un dato verdaderamente crítico para esta fase, pregúntalo brevemente antes de redactar. Si ya tienes lo suficiente, redacta directamente el entregable completo.

${COVER_ALL_ES}

${BLIND_SPOT_ES}

ESTA ES LA FASE 3: Capacidades Clave. Construye:

### 3.1. Capacidades Clave
Distingue entre capacidades básicas (indispensables para operar, no diferencian) y capacidades diferenciadoras (las que hacen único al negocio frente a la competencia).

### 3.2. Plan Operativo
- Infraestructura necesaria (local, equipo, tecnología, inventario) según la madurez actual del negocio con el precio de cada rubro y el total de todos.
- Cadena de suministro: proveedores clave típicos de este giro, su costo y cómo gestionarlos y el total de todos.
- Perfiles de personal necesarios con una estimación económica de mercado laboral (rango de sueldo aproximado según el país declarado) para cada rol clave y el total de todos.
- Insumos fijos comunes para este giro con su precio estimado actual y el total de todos.
- Suma al final todos los gastos mensuales y calcula una inversión anual.

### 3.3. Plan Operativo
- Indica precios de referencia en el mercado para cada producto y servicio en la zona señalada.

Cuando termines este entregable, ciérralo preguntando explícitamente: "¿Apruebas este resumen de la Fase 3 para continuar a la Fase 4?". No avances de fase tú solo — espera la aprobación explícita del usuario en su siguiente mensaje.`,
  4: `Ya tienes en el historial de esta conversación las respuestas de las Fases 0, 1, 2 y 3. Úsalas — no vuelvas a preguntar lo que ya sabes. Si falta un dato verdaderamente crítico para esta fase, pregúntalo brevemente antes de redactar. Si ya tienes lo suficiente, redacta directamente el entregable completo.

${COVER_ALL_ES}

ESTA ES LA FASE 4: Estrategia. Redacta:

### 4.1. Prospectiva Estratégica a 5 Años
Para este ejercicio, toma en cuenta las siguientes variables del entorno (consumo, regulación, sostenibilidad, tecnología, etc.):
SEÑALES CLARAS (Tendencias consolidadas y evidentes):
- [Ejemplo: Adopción masiva de IA en atención al cliente]
- [Inserta aquí otra tendencia fuerte de tu sector]
SEÑALES INCIPIENTES (Débiles, emergentes o tecnologías en fase temprana):
- [Ejemplo: Interfaces cerebro-computadora comerciales]
- [Inserta aquí otra señal débil o tecnología experimental]
Con esta información, estructura tu respuesta en los siguientes 4 puntos:
1. IDENTIFICACIÓN DE INCERTIDUMBRES CRÍTICAS: Define cuáles son las dos variables con mayor incertidumbre y mayor impacto disruptivo que definirán los ejes del futuro de esta industria.
2. MATRIZ DE ESCENARIOS DE PETER SCHWARTZ: Nombra y describe brevemente 4 escenarios posibles basados en el cruce de esas dos incertidumbres. Pon especial énfasis en el escenario más disruptivo u "océano azul" (el escenario donde las reglas tradicionales mueren).
3. CONFIGURACIÓN MORFOLÓGICA DISRUPTIVA: Diseña una propuesta de modelo de negocio combinando las señales incipientes con las claras de una forma que destruya el statu quo actual de la competencia.
4. ACCIONES DE BACKCASTING (De hoy a 5 años): Detalla una hoja de ruta inversa. Si queremos dominar ese escenario disruptivo dentro de 5 años, ¿qué capacidades técnicas, alianzas de actores y pilotos estratégicos debemos empezar a ejecutar HOY?

### 4.2. Estrategia enfocada al Cliente (Modelo Delta)
Aplicando el Modelo Delta (Hax & Wilde), ubica la estrategia más adecuada a realizar, con base en todo lo visto en esta fase y las anteriores.
Posteriormente indica el Customer Journey: mapea las etapas clave que atraviesa un cliente típico, desde que conoce el negocio hasta que se vuelve recurrente, señalando momentos de fricción y de oportunidad.

Cuando termines este entregable, ciérralo preguntando explícitamente: "¿Apruebas este resumen de la Fase 4?". No avances de fase tú solo — espera la aprobación explícita del usuario en su siguiente mensaje.

Inmediatamente después, en la misma respuesta, recuérdale al usuario que puede escribir "/compilar" para juntar automáticamente el resumen completo de las 5 fases (0 a 4) en un solo documento, sin resumir ni omitir nada.`,
};

const PHASE_BODY_EN: Record<number, string> = {
  0: `THIS IS PHASE 0: Initial calibration. Your only job right now is to collect these 5 answers from the user, one at a time. Do not move to any other topic until you have all 5:
1. Location of operations: city, state, and country.
2. Business type and target market: What products/services you offer and to whom.
3. Customer outcome: the result obtained and the need satisfied.
4. Current stage: idea on paper, validated product or service, or business in the scaling phase.
5. Available resources: human, material, intellectual, and financial.

Once you have all 5 calibration answers (even if some are "I don't know"), present a summary using "###" and "-", and close by explicitly asking: "Do you approve this Phase 0 summary to move on to Phase 1?". Do not advance the phase yourself — wait for explicit approval in the user's next message.

If answers are still missing, ask only about what's missing, in a warm, professional tone, with no tables.`,
  1: `You already have the Phase 0 answers in this conversation's history (Location of operations, Business sector, Target market, Customer outcome, Current stage, Available resources). Use them — do not ask again for what you already know. If a truly critical piece of information for this specific phase is missing and cannot be reasonably assumed, ask about it briefly before drafting. If you already have enough, draft the complete deliverable for this phase directly.

${COVER_ALL_EN}

${BLIND_SPOT_EN}

THIS IS PHASE 1: Strategic DNA and Purpose. Build these deliverables:

### 1.1. Golden Circle (Simon Sinek)
Draft the "Why" (purpose—why the company exists beyond making money, focusing on socio-environmental impact and aligning opportunities with the UN SDGs), the "How" (how it operates differently from the competition), and the "What" (specifically what it sells), in that order.

### 1.2. Alignment with SDGs and Funding
- Indicate which UN Sustainable Development Goals (SDGs) this business best aligns with and why.

### 1.3. Value Proposition
Using the "Jobs-to-be-Done" framework and the information above, identify and draft:
- Functional benefits (the practical task the customer "hires" the product/service to accomplish).
- Emotional benefits (how the customer wants to feel when using the service or product).
- Social benefits (how the customer wants to be perceived by others).
- Service benefits (how the customer wants to be served and receive the product/service).
- Added value (additional elements the target market would appreciate receiving).

### 1.4. Customer Segmentation
- Apply the "Blue Ocean" framework: identify a market space where the business can compete without direct price comparison.
- Highlight opportunities to generate positive impact on a vulnerable group (e.g., the elderly, people with disabilities, rural communities, female heads of households) and/or on specific SDGs, and explain how.
- Based on the above and the information provided by the user, define the customer archetypes (buyer personas), including name, approximate age, motivations, and frustrations.

When you finish this deliverable, close by explicitly asking: "Do you approve this Phase 1 summary to move on to Phase 2?". Do not advance the phase yourself — wait for the user's explicit approval in their next message.`,
  2: `You already have the Phase 0 answers and the Phase 1 Strategic DNA in this conversation's history. Use them — do not ask again for what you already know. If a truly critical piece of information for this phase is missing, ask about it briefly before drafting. If you already have enough, draft the complete deliverable directly.

${COVER_ALL_EN}

${BLIND_SPOT_EN}

THIS IS PHASE 2: Environment Analysis. Building on the location and business line already known, produce:

### 2.1. Localized PESTEL Analysis
Analyze the 6 PESTEL categories specifically for the user's country/city (avoiding generalizations) and present both positive and negative aspects for each area. Track signals of change and megatrends across these 6 domains. Use a separate subheading for each of the 6 letters—in this exact order—and do not combine two categories into a single paragraph:
- Political.
- Economic.
- Social.
- Technological.
- Ecological.
- Legal.
If you cannot find a clearly relevant factor specific to the stated country/city for any of the 6 letters, do not omit it; instead, write: "I do not identify a strongly differentiated [Political/Economic/etc.] factor for this territory based on available information," and briefly suggest what data would help complete the analysis.

### 2.2. Market Forces
Analyze the strengths and opportunities for each of the following market forces, as well as their level of influence on the market:
- Competitive landscape: types of direct and indirect competitors typical of this line of business and location.
- New technological entrants: technologies or digital business models that could threaten or transform this sector in the coming years.
- Substitutes: other solutions users prefer over purchasing the previously mentioned product or service.
- Suppliers: key industry suppliers.

### 2.3. Stakeholder Impact Matrix
For each of these stakeholder groups, briefly describe the expected impact (positive or risk to be mitigated) arising from operations and the core business product/service: Employees, Shareholders, Customers, Suppliers, the Environment, Society, and Government.

When you finish this deliverable, close by explicitly asking: "Do you approve this Phase 2 summary to move on to Phase 3?". Do not advance the phase yourself — wait for the user's explicit approval in their next message.`,
  3: `You already have the Phase 0, 1, and 2 answers in this conversation's history. Use them — do not ask again for what you already know. If a truly critical piece of information for this phase is missing, ask about it briefly before drafting. If you already have enough, draft the complete deliverable directly.

${COVER_ALL_EN}

${BLIND_SPOT_EN}

THIS IS PHASE 3: Key Capabilities. Build:

### 3.1. Key Capabilities
Distinguish between basic capabilities (essential for operations but not a source of differentiation) and differentiating capabilities (those that make the business unique compared to the competition).

### 3.2. Operational Plan
- Necessary infrastructure (premises, equipment, technology, inventory) based on the business's current stage of maturity, including the cost of each item and the total cost.
- Supply chain: key suppliers typical for this type of business, their costs, management approach, and the total cost.
- Required personnel profiles with labor market cost estimates (approximate salary range based on the specified country) for each key role and the total cost.
- Standard supplies/inputs for this type of business, including current estimated prices and the total cost.
- Sum up all monthly expenses and calculate the annual investment.

### 3.3. Operational Plan
- Indicate market reference prices for each product and service in the specified area.

When you finish this deliverable, close by explicitly asking: "Do you approve this Phase 3 summary to move on to Phase 4?". Do not advance the phase yourself — wait for the user's explicit approval in their next message.`,
  4: `You already have the Phase 0, 1, 2, and 3 answers in this conversation's history. Use them — do not ask again for what you already know. If a truly critical piece of information for this phase is missing, ask about it briefly before drafting. If you already have enough, draft the complete deliverable directly.

${COVER_ALL_EN}

THIS IS PHASE 4: Strategy. Draft:

### 4.1. 5-Year Strategic Foresight
For this exercise, consider the following environmental variables (consumption, regulation, sustainability, technology, etc.):
CLEAR SIGNALS (Consolidated and evident trends):
- [Example: Mass adoption of AI in customer service]
- [Insert another strong trend in your sector here]
INCIPIENT SIGNALS (Weak, emerging, or early-stage technologies):
- [Example: Commercial brain-computer interfaces]
- [Insert another weak signal or experimental technology here]
Using this information, structure your response around the following 4 points:
1. IDENTIFICATION OF CRITICAL UNCERTAINTIES: Define the two variables with the highest uncertainty and greatest disruptive impact that will shape the future axes of this industry.
2. PETER SCHWARTZ SCENARIO MATRIX: Name and briefly describe 4 possible scenarios based on the intersection of those two uncertainties. Place special emphasis on the most disruptive or "blue ocean" scenario (the scenario where traditional rules cease to apply).
3. DISRUPTIVE MORPHOLOGICAL CONFIGURATION: Design a proposed business model by combining incipient and clear signals in a way that shatters the competition's current status quo.
4. BACKCASTING ACTIONS (From today to 5 years out): Detail a reverse roadmap. If we want to dominate that disruptive scenario in 5 years, what technical capabilities, stakeholder alliances, and strategic pilots must we begin executing TODAY?

### 4.2. Customer-Focused Strategy (Delta Model)
Applying the Delta Model (Hax & Wilde), identify the most suitable strategy to implement, based on everything covered in this phase and previous ones.
Then, outline the Customer Journey: map the key stages a typical customer goes through—from first learning about the business to becoming a repeat customer—highlighting points of friction and opportunity.

When you finish this deliverable, close by explicitly asking: "Do you approve this Phase 4 summary?". Do not advance the phase yourself — wait for the user's explicit approval in their next message.

Immediately after, in the same response, remind the user that they can type "/compilar" to automatically assemble the complete summary of all 5 phases (0 to 4) into a single document, without summarizing or omitting anything.`,
};

function buildSystemPrompt(language: 'es' | 'en', phase: number): string {
  const safePhase = Number.isFinite(phase) ? Math.min(Math.max(Math.trunc(phase), 0), 4) : 0;
  const persona = language === 'en' ? PERSONA_EN : PERSONA_ES;
  const bodies = language === 'en' ? PHASE_BODY_EN : PHASE_BODY_ES;
  return persona + '\n\n' + (bodies[safePhase] ?? bodies[0]);
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    route: '/api/babel',
    phases: 'fase-0-a-fase-4 (completas)',
    note: 'Envía POST con { messages: [...], language?: "es"|"en", phase?: 0-4 } para hablar con Babel.',
  });
}

// Intenta llamar a un proveedor Gemini (Google). Retorna { reply } o null.
async function tryGemini(
  messages: IncomingMessage[],
  language: 'es' | 'en',
  phase: number,
  diagnostics: { provider: string; status: number; error: string }[],
): Promise<{ reply: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    diagnostics.push({ provider: 'Gemini', status: 0, error: 'API key no configurada en Vercel' });
    return null;
  }
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  try {
    const res = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(language, phase) }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
      }),
    });

    if (!res.ok) {
      const errText = (await res.text()).slice(0, 300);
      console.error(`[babel] Gemini error ${res.status}:`, errText);
      diagnostics.push({ provider: 'Gemini', status: res.status, error: errText });
      return null;
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('') ?? '';

    if (!text) {
      const blockReason = data?.promptFeedback?.blockReason;
      const blockMsg = data?.promptFeedback?.blockReasonMessage;
      console.error(`[babel] Gemini no devolvió texto — blockReason: ${blockReason}, message: ${blockMsg}`);
      diagnostics.push({ provider: 'Gemini', status: 200, error: `Blocked: ${blockReason} — ${blockMsg}` });
      return null;
    }

    return { reply: text };
  } catch (fetchErr) {
    console.error('[babel] Gemini fetch exception:', fetchErr);
    diagnostics.push({ provider: 'Gemini', status: 0, error: String(fetchErr) });
    return null;
  }
}

// Intenta llamar a un proveedor OpenAI-compatible. Retorna { reply } o null.
// Los errores se agregan al arreglo diagnostics.
async function tryOpenAICompatible(
  messages: IncomingMessage[],
  language: 'es' | 'en',
  phase: number,
  endpoint: string,
  model: string,
  apiKey: string | undefined,
  label: string,
  diagnostics: { provider: string; status: number; error: string }[],
): Promise<{ reply: string } | null> {
  if (!apiKey) {
    diagnostics.push({ provider: label, status: 0, error: 'API key no configurada en Vercel' });
    return null;
  }

  const systemMsg = { role: 'system', content: buildSystemPrompt(language, phase) };
  const chatMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
  }));

  const tryFetch = async function (msgs: Record<string, unknown>[]): Promise<{ reply: string } | null> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: msgs,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const errText = (await res.text()).slice(0, 300);
      console.error(`[babel] ${label} error ${res.status}:`, errText);
      diagnostics.push({ provider: label, status: res.status, error: errText });
      return null;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '';

    if (!text) {
      console.error(`[babel] ${label} no devolvió texto`);
      diagnostics.push({ provider: label, status: 200, error: 'Respuesta vacía' });
      return null;
    }

    return { reply: text };
  };

  try {
    // Intento 1: con system prompt completo
    let result = await tryFetch([systemMsg, ...chatMessages]);
    if (result) return result;

    // Intento 2: si el historial completo excede el contexto del modelo,
    // reintentar con SOLO la conversación reciente — pero SIEMPRE conservando
    // el system prompt. Nunca responder sin instrucciones: sin ellas el modelo
    // inventa secciones y cierres que no están en el prompt (análisis de
    // competencia, planes de implementación, resúmenes ejecutivos, etc.).
    if (diagnostics.length > 0 && diagnostics[diagnostics.length - 1]?.status === 400) {
      console.error(`[babel] ${label} falló con 400, reintentando con historial corto...`);
      const prevDiagLen = diagnostics.length;
      const shortHistory = chatMessages.slice(-6);
      result = await tryFetch([systemMsg, ...shortHistory]);
      if (result) {
        diagnostics.splice(prevDiagLen - 1, diagnostics.length - prevDiagLen + 1);
        return result;
      }
    }

    return null;
  } catch (fetchErr) {
    console.error(`[babel] ${label} fetch exception:`, fetchErr);
    diagnostics.push({ provider: label, status: 0, error: String(fetchErr) });
    return null;
  }
}

export async function POST(req: NextRequest) {
  const diagnostics: { provider: string; status: number; error: string }[] = [];

  try {
    let body: BabelRequestBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Body inválido: se esperaba JSON.' }, { status: 400 });
    }

    const { messages, language, phase, phase0Complete, phase0Data } = body;
    const lang: 'es' | 'en' = language === 'en' ? 'en' : 'es';
    const currentPhase = phase ?? 0;

    // Reducción de tokens: en vez de enviar todo el historial, enviamos solo
    // lo esencial.
    //
    // Fase 0 (última pregunta): usamos el resumen phase0Data (~500 tokens)
    // en vez del historial completo (~8000 tokens).
    //
    // Fases 1-4: en vez de recortar SOLO a los últimos mensajes (lo cual, en
    // conversaciones largas, termina descartando las respuestas originales
    // de la Fase 0 — giro, país, etapa, etc. — apenas la
    // conversación pasa de ~10 mensajes, dejando a Babel sin la calibración
    // real del negocio en las fases posteriores), conservamos SIEMPRE los
    // primeros HEAD_KEEP mensajes (donde casi siempre vive la calibración
    // inicial) más los últimos TAIL_KEEP (la conversación reciente de la
    // fase actual). Esto amplía el límite de 10 a hasta 18 mensajes, pero
    // sigue siendo acotado para los límites gratuitos de Groq/OpenRouter.
    let compactMessages = messages;
    if (phase0Complete && phase0Data) {
      const summary = Object.entries(phase0Data)
        .map(([key, value]) => `- ${key}: ${value}`)
        .join('\n');
      const langLabel = lang === 'en' ? 'en' : 'es';
      const intro = langLabel === 'en'
        ? 'Phase 0 completed. Here are my business answers:'
        : 'Fase 0 completada. Estas son mis respuestas del negocio:';
      compactMessages = [
        { role: 'user', content: `${intro}\n\n${summary}` },
      ];
    } else if (currentPhase >= 1 && messages.length > 2) {
      // Compactación por TAMAÑO aproximado (no solo por número de mensajes):
      // cada entregable de fase puede pesar decenas de miles de caracteres y
      // un tope de mensajes no basta para caber en el contexto del modelo.
      // Se conservan SIEMPRE los primeros HEAD_KEEP mensajes (donde vive la
      // calibración inicial) más la conversación reciente, hasta ~75k
      // caracteres (~20k tokens), dejando margen para el system prompt.
      const HEAD_KEEP = 6;
      const MAX_TOTAL_CHARS = 75_000;
      const head = messages.slice(0, HEAD_KEEP);
      const headChars = head.reduce(function (sum, m) { return sum + m.content.length; }, 0);
      const tail: IncomingMessage[] = [];
      let used = headChars;
      for (let i = messages.length - 1; i >= HEAD_KEEP; i--) {
        const size = messages[i].content.length;
        if (used + size > MAX_TOTAL_CHARS) break;
        tail.unshift(messages[i]);
        used += size;
      }
      if (tail.length >= messages.length - HEAD_KEEP) {
        compactMessages = messages;
      } else if (tail.length > 0) {
        compactMessages = [...head, ...tail];
      } else {
        compactMessages = messages.slice(-6);
      }
    }

    if (!Array.isArray(compactMessages) || compactMessages.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere "messages": un arreglo con al menos un mensaje { role, content }.' },
        { status: 400 },
      );
    }

    // DEBUG: registrar el primer mensaje para identificar problemas de formato
    const debugInfo = {
      totalMessages: compactMessages.length,
      firstRole: compactMessages[0]?.role,
      firstContentPreview: (compactMessages[0]?.content ?? '').slice(0, 100),
      lastRole: compactMessages[compactMessages.length - 1]?.role,
      lastContentPreview: (compactMessages[compactMessages.length - 1]?.content ?? '').slice(0, 100),
      phase: currentPhase,
      phase0Complete: !!phase0Complete,
    };

    // 1. Groq (más fiable, gratis, 30 req/min)
    const resultGroq = await tryOpenAICompatible(
      compactMessages, lang, currentPhase,
      FALLBACK_ENDPOINT, FALLBACK_MODEL,
      process.env.FALLBACK_API_KEY, 'Groq', diagnostics,
    );
    if (resultGroq) return NextResponse.json(resultGroq);
    diagnostics[diagnostics.length - 1]?.error?.includes('image.png') && console.error('[babel] *** image.png ERROR from Groq ***');

    // 2. OpenRouter + Qwen3 (gratis)
    const resultTertiary = await tryOpenAICompatible(
      compactMessages, lang, currentPhase,
      TERTIARY_ENDPOINT, TERTIARY_MODEL,
      process.env.TERTIARY_API_KEY, 'OpenRouter', diagnostics,
    );
    if (resultTertiary) return NextResponse.json(resultTertiary);
    const openRouterDiag = diagnostics[diagnostics.length - 1];
    if (openRouterDiag?.error?.includes('image.png')) console.error('[babel] *** image.png ERROR from OpenRouter ***');

    // 3. Gemini
    if (process.env.GEMINI_API_KEY) {
      const result = await tryGemini(compactMessages, lang, currentPhase, diagnostics);
      if (result) return NextResponse.json(result);
      const geminiDiag = diagnostics[diagnostics.length - 1];
      if (geminiDiag?.error?.includes('image.png')) console.error('[babel] *** image.png ERROR from Gemini ***');
    }

    // 4. 9Router (proxy local con túnel, o VPS)
    // Solo se intenta si configuraste ROUTER_ENDPOINT explícitamente en Vercel
    if (process.env.ROUTER_ENDPOINT) {
      const resultRouter = await tryOpenAICompatible(
        compactMessages, lang, currentPhase,
        ROUTER_ENDPOINT, ROUTER_MODEL,
        process.env.ROUTER_API_KEY || 'no-key-needed', '9Router', diagnostics,
      );
      if (resultRouter) return NextResponse.json(resultRouter);
      const routerDiag = diagnostics[diagnostics.length - 1];
      if (routerDiag?.error?.includes('image.png')) console.error('[babel] *** image.png ERROR from 9Router ***');
    }

    // 5. Todos fallaron — devolver diagnóstico
    const configuredProviders = [
      { name: 'Groq', key: process.env.FALLBACK_API_KEY, hasKey: !!process.env.FALLBACK_API_KEY },
      { name: 'OpenRouter', key: process.env.TERTIARY_API_KEY, hasKey: !!process.env.TERTIARY_API_KEY },
      { name: 'Gemini', key: process.env.GEMINI_API_KEY, hasKey: !!process.env.GEMINI_API_KEY },
      { name: '9Router', key: process.env.ROUTER_API_KEY, hasKey: !!process.env.ROUTER_ENDPOINT },
    ].filter((p) => p.hasKey);

    if (configuredProviders.length === 0) {
      return NextResponse.json(
        { error: 'No hay API key configurada. Configura al menos FALLBACK_API_KEY (Groq gratis) en Vercel > Settings > Environment Variables.' },
        { status: 500 },
      );
    }

    const mainError = diagnostics.map(d => `${d.provider} (${d.status}): ${d.error.slice(0, 300)}`).join(' | ');
    return NextResponse.json(
      {
        error: mainError,
        debug: debugInfo,
        providers: diagnostics.map(d => ({ provider: d.provider, status: d.status, error: d.error.slice(0, 500) })),
        tip: 'API keys gratis: Groq (console.groq.com) | OpenRouter (openrouter.ai/keys) | Gemini (aistudio.google.com/apikey)',
      },
      { status: 502 },
    );
  } catch (err) {
    console.error('Error en /api/babel:', err);
    return NextResponse.json({ error: 'Error interno procesando la solicitud.' }, { status: 500 });
  }
}
