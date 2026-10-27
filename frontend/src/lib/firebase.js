import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, browserLocalPersistence, setPersistence } from 'firebase/auth';

let firebaseAuthInstance = null;
let cachedConfig = null;

/**
 * Resolves Firebase web client configuration either from Vite environment variables
 * or dynamically from the backend /api/auth/firebase-config endpoint.
 */
export async function resolveFirebaseConfig() {
  if (cachedConfig) return cachedConfig;

  // 1. Check for Vite environment variables
  const env = import.meta.env || {};
  if (env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID) {
    cachedConfig = {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || `${env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: env.VITE_FIREBASE_APP_ID || '',
      measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || '',
    };
    return cachedConfig;
  }

  // 2. Fetch public configuration from backend API
  try {
    const res = await fetch('/api/auth/firebase-config');
    if (res.ok) {
      const data = await res.json();
      if (data && data.config) {
        cachedConfig = data.config;
        return cachedConfig;
      }
    }
  } catch (err) {
    console.warn('[firebase] Could not fetch remote firebase config:', err.message);
  }

  // Fallback defaults for this project
  cachedConfig = {
    apiKey: 'AIzaSyAu4Uik9o0ylktWTMxdlbKUixKVHdBjKA8',
    authDomain: 'hr-myglobalhub-net.firebaseapp.com',
    projectId: 'hr-myglobalhub-net',
    storageBucket: 'hr-myglobalhub-net.firebasestorage.app',
    messagingSenderId: '111537866449',
    appId: '1:111537866449:web:4eb5bb571023978c2aa7f0',
    measurementId: 'G-3BSJFD6CRC',
  };
  return cachedConfig;
}

/**
 * Initializes and returns the Firebase Auth client instance
 */
export async function getFirebaseAuth() {
  if (firebaseAuthInstance) return firebaseAuthInstance;

  const config = await resolveFirebaseConfig();
  if (!config || !config.apiKey) {
    throw new Error(
      'Firebase Web API Key no encontrada. Por favor configura VITE_FIREBASE_API_KEY en frontend/.env o FIREBASE_WEB_API_KEY en backend/.env (descárgala en Firebase Console -> Configuración del proyecto -> Tus apps).'
    );
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  const auth = getAuth(app);

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (_) {
    // Ignore persistence warning if already set
  }

  firebaseAuthInstance = auth;
  return firebaseAuthInstance;
}

/**
 * Triggers Google Sign-In popup using Firebase Auth
 * Returns the verified user credential and the Google ID token for backend authentication
 */
export async function signInWithGoogle() {
  const auth = await getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
  });

  const credential = await signInWithPopup(auth, provider);
  const idToken = await credential.user.getIdToken();

  return {
    user: credential.user,
    idToken,
    email: credential.user.email,
    displayName: credential.user.displayName,
    photoURL: credential.user.photoURL,
  };
}
