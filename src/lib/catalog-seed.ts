import { getAdminDb } from '@/lib/firebase-admin';
import { DEFAULT_CATALOG, productIdValido } from '@/lib/catalog';

// Garantiza que los defaults existan en Firestore la primera vez (idempotente).
// No exports extra de aquí: este módulo no es un route handler, puede exportar
// lo que necesite.
export async function seedCatalogIfNeeded() {
  try {
    const db = getAdminDb();
    const snap = await db.collection('catalog').get();
    if (snap.size > 0) return;
    const batch = db.batch();
    for (const item of DEFAULT_CATALOG) {
      if (!productIdValido(item.id)) continue;
      const ref = db.collection('catalog').doc(item.id);
      batch.set(ref, {
        titulo: item.titulo,
        tituloEn: item.tituloEn,
        precio: item.precio,
        promocion: item.promocion,
        promocionActiva: item.promocionActiva,
        activo: item.activo,
        updatedAt: new Date().toISOString(),
      });
    }
    await batch.commit();
  } catch (err) {
    console.error('[catalog-seed] error', err);
  }
}