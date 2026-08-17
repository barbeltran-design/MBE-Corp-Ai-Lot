import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb, getGoogleProvider } from '@/lib/firebase';
import type { CompanyDoc, Industry, CompanySize, Language, UserDoc } from '@/types/firestore';

export interface RegistrationInput {
  fullName: string;
  companyName: string;
  industry: Industry;
  size: CompanySize;
  country: string;
  language: Language;
  // Consentimiento legal capturado en el formulario de registro (checkbox de
  // Términos de Uso + Aviso de Privacidad). Opcionales para no romper el
  // flujo de Google (que usa placeholders por defecto).
  aceptoTerminosAt?: string;
  esMenorDeEdad?: boolean;
  tutorNombre?: string;
  tutorEmail?: string;
}

const PENDING_GOOGLE_REGISTRATION_KEY = 'mbe_pending_google_registration';

function defaultRegistrationInput(language: Language): RegistrationInput {
  // Used only when a redirect completes but we lost the sessionStorage marker
  // (e.g. the browser cleared it across the cross-origin round trip). Better
  // to sign the user in with placeholders they can edit later than to strand
  // them on the landing page with a valid session and no company doc.
  return {
    fullName: '',
    companyName: '',
    industry: 'services',
    size: '1-5',
    country: 'MX',
    language,
  };
}

/**
 * Writes users/{uid} and companies/{uid} per the MBE AI Copilot data model.
 * Called right after Firebase Auth succeeds (email/password or Google).
 * Uses setDoc with merge so re-registration attempts (e.g. re-running Google
 * sign-in for an existing user) don't clobber fields like `subscription`.
 */
export async function createUserAndCompanyDocs(user: User, input: RegistrationInput) {
  const db = getFirebaseDb();

  const userDoc: Partial<UserDoc> = {
    uid: user.uid,
    email: user.email ?? '',
    name: input.fullName,
    language: input.language,
    country: input.country,
    createdAt: serverTimestamp() as UserDoc['createdAt'],
    subscription: 'free',
    currentMonth: 1,
    totalMaturity: 0,
  };

  // Solo se agregan si el formulario los mandó (el flujo de Google no
  // pasa por el checkbox de consentimiento manual, así que no los pisa).
  if (input.aceptoTerminosAt) userDoc.aceptoTerminosAt = input.aceptoTerminosAt;
  if (input.esMenorDeEdad !== undefined) userDoc.esMenorDeEdad = input.esMenorDeEdad;
  if (input.tutorNombre) userDoc.tutorNombre = input.tutorNombre;
  if (input.tutorEmail) userDoc.tutorEmail = input.tutorEmail;

  const companyDoc: CompanyDoc = {
    uid: user.uid,
    name: input.companyName,
    industry: input.industry,
    size: input.size,
    country: input.country,
    createdAt: serverTimestamp() as CompanyDoc['createdAt'],
  };

  await Promise.all([
    setDoc(doc(db, 'users', user.uid), userDoc, { merge: true }),
    setDoc(doc(db, 'companies', user.uid), companyDoc, { merge: true }),
  ]);
}

export async function registerWithEmail(email: string, password: string, input: RegistrationInput) {
  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: input.fullName });
  await createUserAndCompanyDocs(credential.user, input);
  return credential.user;
}

export async function registerWithGoogle(input: RegistrationInput): Promise<User | void> {
  const auth = getFirebaseAuth();
  const provider = getGoogleProvider();

  try {
    const credential = await signInWithPopup(auth, provider);
    const db = getFirebaseDb();
    const companySnap = await getDoc(doc(db, 'companies', credential.user.uid));
    if (!companySnap.exists()) {
      await createUserAndCompanyDocs(credential.user, input);
    }
    return credential.user;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    const shouldFallbackToRedirect =
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      code === 'auth/cancelled-popup-request';

    if (!shouldFallbackToRedirect) throw err;

    sessionStorage.setItem(PENDING_GOOGLE_REGISTRATION_KEY, JSON.stringify(input));
    await signInWithRedirect(auth, provider);
    return undefined;
  }
}

export function subscribeToPendingGoogleRedirect(
  onComplete: (user: User) => void,
  onError: (error: unknown) => void
): () => void {
  const auth = getFirebaseAuth();

  getRedirectResult(auth).catch((err) => {
    console.error('[MBE Auth] getRedirectResult() rejected', err);
    onError(err);
  });

  let handled = false;
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user || handled) return;
    handled = true;

    try {
      const pendingRaw = sessionStorage.getItem(PENDING_GOOGLE_REGISTRATION_KEY);
      sessionStorage.removeItem(PENDING_GOOGLE_REGISTRATION_KEY);

      const db = getFirebaseDb();
      const companySnap = await getDoc(doc(db, 'companies', user.uid));

      if (!companySnap.exists()) {
        const input = pendingRaw
          ? (JSON.parse(pendingRaw) as RegistrationInput)
          : defaultRegistrationInput('es');
        await createUserAndCompanyDocs(user, input);
      }

      onComplete(user);
    } catch (err) {
      console.error('[MBE Auth] failed to complete pending Google redirect', err);
      onError(err);
    }
  });

  return unsubscribe;
}

/**
 * Inicia sesión con correo y contraseña. A diferencia del registro, esta
 * función NUNCA crea una cuenta nueva: si las credenciales no corresponden
 * a un usuario existente, Firebase Auth rechaza la promesa
 * (auth/invalid-credential en el SDK modular actual).
 */
export async function signInWithEmail(email: string, password: string) {
  const auth = getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * Inicia sesión con Google desde la pantalla de LOGIN (no de registro).
 * A propósito NO llama a createUserAndCompanyDocs: si la cuenta de Google
 * no tiene ya un documento en companies/{uid}, significa que nunca se
 * registró (o nunca aceptó Términos/Aviso de Privacidad) — así que cerramos
 * la sesión de inmediato y devolvemos un error claro en vez de crear una
 * cuenta nueva sin pasar por el consentimiento legal del formulario de
 * registro (ver RegisterForm).
 */
export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  const provider = getGoogleProvider();
  const credential = await signInWithPopup(auth, provider);

  const db = getFirebaseDb();
  const companySnap = await getDoc(doc(db, 'companies', credential.user.uid));

  if (!companySnap.exists()) {
    await signOut(auth);
    const err = new Error('No existe una cuenta registrada para esta cuenta de Google.') as Error & {
      code?: string;
    };
    err.code = 'mbe/no-account';
    throw err;
  }

  return credential.user;
}

/**
 * Envía el correo de recuperación de contraseña de Firebase Auth. Por
 * seguridad (para que nadie pueda usar este formulario para "probar" qué
 * correos están registrados en la plataforma), tragamos a propósito el
 * error auth/user-not-found: el formulario que llama a esta función debe
 * mostrar SIEMPRE el mismo mensaje de éxito, exista o no una cuenta con
 * ese correo. Cualquier otro error (p. ej. correo mal formado) sí se
 * propaga normalmente.
 */
export async function sendPasswordReset(email: string) {
  const auth = getFirebaseAuth();
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/user-not-found') return;
    throw err;
  }
}

export function mapAuthErrorToMessageKey(
  error: unknown
): 'emailInUse' | 'invalidCredential' | 'noAccount' | 'tooManyRequests' | 'generic' {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/email-already-in-use') return 'emailInUse';
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'invalidCredential';
  }
  if (code === 'mbe/no-account') return 'noAccount';
  if (code === 'auth/too-many-requests') return 'tooManyRequests';
  return 'generic';
}
