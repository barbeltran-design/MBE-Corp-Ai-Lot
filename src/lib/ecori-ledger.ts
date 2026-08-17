import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// ---------------------------------------------------------------------------
// Registro (ledger) de las recargas agenticas de Ecori en Firestore:
//   recargas_ia/{autoId}   -> cada recarga ejecutada (proveedor, monto, tx, red)
//   proveedores_saldo/{id} -> ultimo estado/recarga por proveedor
//   ia_fondos/config       -> tope por transaccion y diario (espejo del servicio)
// Solo se usa en rutas/servidor (firebase-admin). Ningun fallo de ledger debe
// romper la cadena de IA ni la respuesta al usuario.
// ---------------------------------------------------------------------------

export interface RecargaIALedger {
  proveedor: string;
  estado: string;
  montoUsd: number;
  txId?: string;
  red?: string;
  explorerUrl?: string;
  creadoEn: number;
}

export async function registrarRecargaIALedger(recarga: RecargaIALedger): Promise<void> {
  try {
    const db = getAdminDb();
    await db.collection('recargas_ia').add({
      ...recarga,
      creadoEn: FieldValue.serverTimestamp(),
    });
    await db.collection('proveedores_saldo').doc(recarga.proveedor).set(
      {
        ultimaRecargaEn: FieldValue.serverTimestamp(),
        ultimoTxId: recarga.txId ?? '',
        examenUrl: recarga.explorerUrl ?? '',
        ultimoEstatus: 'recargado',
      },
      { merge: true }
    );
  } catch (err) {
    console.error('[ecori-ledger] No se pudo registrar la recarga en Firestore:', err);
  }
}

export interface ProveedorSaldoDoc {
  proveedor: string;
  ultimaRecargaEn?: unknown;
  ultimoTxId?: string;
  ultimoEstatus?: string;
}

export async function leerEstadoProveedores(): Promise<ProveedorSaldoDoc[]> {
  try {
    const db = getAdminDb();
    const snap = await db.collection('proveedores_saldo').orderBy('ultimaRecargaEn', 'desc').limit(10).get();
    return snap.docs.map((d) => ({ proveedor: d.id, ...d.data() }) as ProveedorSaldoDoc);
  } catch (err) {
    console.error('[ecori-ledger] No se pudo leer el estado de proveedores:', err);
    return [];
  }
}

export async function leerRecargasRecientes(limit = 10): Promise<RecargaIALedger[]> {
  try {
    const db = getAdminDb();
    const snap = await db
      .collection('recargas_ia')
      .orderBy('creadoEn', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as RecargaIALedger);
  } catch (err) {
    console.error('[ecori-ledger] No se pudo leer el historial de recargas:', err);
    return [];
  }
}