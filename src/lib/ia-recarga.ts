// ---------------------------------------------------------------------------
// Gancho de recarga agentica de Ecori (Circle) en la cadena de proveedores IA.
// Cuando Gemini/Groq/OpenRouter/DeepSeek fallan con 429/402 (tokens agotados,
// saldo insuficiente), la ruta pide a Ecori que pague la recarga en USDC desde
// su Agent Wallet y REINTENTA la llamada al proveedor una sola vez.
// Si ECORI_SERVICE_URL / ECORI_SERVICE_SECRET no estan configuradas, el gancho
// no interfiere (la cadena sigue su fallback normal).
// ---------------------------------------------------------------------------

const ECORI_SERVICE_URL = process.env.ECORI_SERVICE_URL || '';
const ECORI_SERVICE_SECRET = process.env.ECORI_SERVICE_SECRET || '';

export function generarPedidoId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export interface ResultadoRecarga {
  recargada: boolean;
  txId?: string;
  modo: string;
}

async function llamarEcori(
  proveedor: string,
  pedidoId: string,
  estado: 'quota_excedida' | 'sin_balance'
): Promise<ResultadoRecarga> {
  try {
    const res = await fetch(ECORI_SERVICE_URL + '/recargar-ia', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ecori-secret': ECORI_SERVICE_SECRET,
      },
      body: JSON.stringify({ proveedor, estado, pedido_id: pedidoId }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(function () { return null; });
    return {
      recargada: res.ok && !!data && data.recarga_ejecutada === true,
      txId: data && data.detalle_pago ? data.detalle_pago.tx_id : undefined,
      modo: 'ecori',
    };
  } catch (err) {
    console.error('[ia-recarga] No se pudo llamar al servicio de Ecori:', err);
    return { recargada: false, modo: 'error' };
  }
}

export async function intentarRecargaIA(
  proveedor: string,
  pedidoId?: string
): Promise<ResultadoRecarga> {
  if (!ECORI_SERVICE_URL || !ECORI_SERVICE_SECRET) {
    return { recargada: false, modo: 'no_configurado' };
  }
  return llamarEcori(proveedor, pedidoId || generarPedidoId(), 'quota_excedida');
}