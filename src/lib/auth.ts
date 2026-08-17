import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
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

export function mapAuthErrorToMessageKey(error: unknown): 'emailInUse' | 'generic' {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/email-already-in-use') return 'emailInUse';
  return 'generic';
}
