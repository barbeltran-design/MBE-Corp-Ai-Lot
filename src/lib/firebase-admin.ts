// ─────────────────────────────────────────────────────────────────────────
// Firebase Admin SDK — SOLO SERVIDOR.
//
// ESTE ARCHIVO VA EN LA MISMA CARPETA DONDE YA TIENES "firebase.ts".
// Si tu firebase.ts está en src/lib/firebase.ts, este va en src/lib/firebase-admin.ts.
// Si está en lib/firebase.ts (sin src/), este va en lib/firebase-admin.ts.
// (Ponlo junto a su hermano "firebase.ts" y todo funciona sin tocar nada más.)
//
// Este archivo NUNCA debe usarse desde un componente que corre en el navegador.
// Usa una credencial secreta (la cuenta de servicio) que jamás debe llegar
// al navegador del usuario final.
//
// Variables de entorno requeridas (cárgalas en Vercel → Settings →
// Environment Variables, SIN el prefijo NEXT_PUBLIC_ para que se queden
// solo del lado del servidor):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY
//
// Estos 3 valores salen del archivo JSON que genera Firebase Console en:
// Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.
// ─────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getStorage, type Storage } from 'firebase-admin/storage';

let adminApp: App | null = null;
let adminDbInstance: Firestore | null = null;
let adminAuthInstance: Auth | null = null;
let adminStorageInstance: Storage | null = null;

function getAdminApp(): App {
  if (adminApp) return adminApp;

  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Vercel guarda las variables de varias líneas con "\n" literales (texto,
  // no salto de línea real). El SDK necesita saltos de línea reales, así
  // que los convertimos aquí. Tú no tienes que hacer nada especial al
  // pegar la clave en Vercel — este reemplazo lo resuelve automáticamente.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      '[firebase-admin] Faltan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY. ' +
        'Configúralas en Vercel → Settings → Environment Variables usando los valores del ' +
        'archivo JSON de tu cuenta de servicio de Firebase (Configuración del proyecto → ' +
        'Cuentas de servicio → Generar nueva clave privada).'
    );
  }

  adminApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });

  return adminApp;
}

export function getAdminDb(): Firestore {
  if (!adminDbInstance) adminDbInstance = getFirestore(getAdminApp());
  return adminDbInstance;
}

export function getAdminAuth(): Auth {
  if (!adminAuthInstance) adminAuthInstance = getAuth(getAdminApp());
  return adminAuthInstance;
}

export function getAdminStorage(): Storage {
  if (!adminStorageInstance) adminStorageInstance = getStorage(getAdminApp());
  return adminStorageInstance;
}
