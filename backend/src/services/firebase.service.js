const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getAuth } = require('firebase-admin/auth');

let firebaseApp = null;
let firestoreDb = null;
let firebaseStorage = null;
let firebaseAuth = null;

/**
 * Resolves Firebase service account credentials from file or environment variables
 */
function resolveCredentials() {
  // 1. Explicit file path from env
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const customPath = path.isAbsolute(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      ? process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      : path.join(__dirname, '..', '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

    if (fs.existsSync(customPath)) {
      return {
        type: 'file',
        path: customPath,
        serviceAccount: JSON.parse(fs.readFileSync(customPath, 'utf8')),
      };
    }
  }

  // 2. Standard convention locations and auto-discovery in backend/config
  const configDir = path.join(__dirname, '..', '..', 'config');
  if (fs.existsSync(configDir)) {
    const files = fs.readdirSync(configDir);
    const sortedFiles = files.filter((f) => f.endsWith('.json')).sort((a, b) => {
      if (a.includes('hr-myglobalhub')) return -1;
      if (b.includes('hr-myglobalhub')) return 1;
      return 0;
    });

    for (const serviceAccountFile of sortedFiles) {
      const fullPath = path.join(configDir, serviceAccountFile);
      try {
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (parsed.project_id && (parsed.private_key || parsed.client_email)) {
          return {
            type: 'file',
            path: fullPath,
            serviceAccount: parsed,
          };
        }
      } catch (err) {
        console.warn(`[Firebase] Could not parse credentials from ${serviceAccountFile}:`, err.message);
      }
    }
  }

  const standardPaths = [
    path.join(__dirname, '..', '..', 'config', 'firebase-service-account.json'),
    path.join(__dirname, '..', '..', 'config', 'serviceAccountKey.json'),
    path.join(__dirname, '..', '..', 'serviceAccountKey.json'),
  ];

  for (const p of standardPaths) {
    if (fs.existsSync(p)) {
      return {
        type: 'file',
        path: p,
        serviceAccount: JSON.parse(fs.readFileSync(p, 'utf8')),
      };
    }
  }

  // 3. Direct environment variables
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      type: 'env',
      serviceAccount: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
    };
  }

  return null;
}

/**
 * Initializes Firebase Admin SDK singleton
 */
function initializeFirebase() {
  if (firebaseApp) {
    return firebaseApp;
  }

  // Check if app is already initialized across modules
  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    firestoreDb = getFirestore(firebaseApp);
    return firebaseApp;
  }

  const credentials = resolveCredentials();
  if (!credentials) {
    return null;
  }

  try {
    const credential = cert(credentials.serviceAccount);
    const storageBucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      (credentials.serviceAccount.project_id ? `${credentials.serviceAccount.project_id}.firebasestorage.app` : undefined);

    firebaseApp = initializeApp({
      credential,
      projectId: credentials.serviceAccount.project_id || credentials.serviceAccount.projectId,
      storageBucket,
    });

    firestoreDb = getFirestore(firebaseApp);
    firestoreDb.settings({ ignoreUndefinedProperties: true });

    return firebaseApp;
  } catch (err) {
    console.error('[Firebase] Error initializing Firebase Admin SDK:', err.message);
    throw err;
  }
}

/**
 * Firebase Service API
 */
const firebaseService = {
  isConfigured() {
    return resolveCredentials() !== null;
  },

  getApp() {
    return initializeFirebase();
  },

  getFirestore() {
    if (!firestoreDb) {
      initializeFirebase();
    }
    return firestoreDb;
  },

  getStorage() {
    if (!firebaseApp) {
      initializeFirebase();
    }
    if (!firebaseStorage && firebaseApp) {
      firebaseStorage = getStorage(firebaseApp);
    }
    return firebaseStorage;
  },

  getAuth() {
    if (!firebaseApp) {
      initializeFirebase();
    }
    if (!firebaseAuth && firebaseApp) {
      firebaseAuth = getAuth(firebaseApp);
    }
    return firebaseAuth;
  },

  getPublicConfig() {
    const creds = resolveCredentials();
    const envProj = (process.env.FIREBASE_PROJECT_ID || '').trim();
    const projectId =
      (envProj && envProj !== 'undefined' ? envProj : null) ||
      (creds && creds.serviceAccount && (creds.serviceAccount.project_id || creds.serviceAccount.projectId)) ||
      'hr-myglobalhub-net';
    return {
      apiKey: process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyAu4Uik9o0ylktWTMxdlbKUixKVHdBjKA8',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '111537866449',
      appId: process.env.FIREBASE_APP_ID || '1:111537866449:web:4eb5bb571023978c2aa7f0',
      measurementId: process.env.FIREBASE_MEASUREMENT_ID || 'G-3BSJFD6CRC',
    };
  },

  /**
   * Health check and live connectivity test
   */
  async testConnection() {
    const credentials = resolveCredentials();
    if (!credentials) {
      return {
        connected: false,
        configured: false,
        error: 'No se encontraron credenciales de Firebase en backend/config/ ni en variables de entorno (.env).',
      };
    }

    if (process.env.DISABLE_REMOTE_FIREBASE === 'true' || process.env.NODE_ENV === 'test') {
      return {
        connected: true,
        configured: true,
        projectId: (credentials.serviceAccount && (credentials.serviceAccount.project_id || credentials.serviceAccount.projectId)) || 'hr-myglobalhub-net',
        source: 'guarded_test_mode',
        mocked: true,
      };
    }

    try {
      const db = this.getFirestore();
      if (!db) {
        throw new Error('No se pudo inicializar la instancia de Cloud Firestore.');
      }

      // Ping Firestore by reading/writing a connection probe document
      const probeRef = db.collection('_system_health').doc('connection_probe');
      const now = new Date().toISOString();

      await probeRef.set(
        {
          status: 'online',
          lastChecked: now,
          service: 'mgh-payroll-api',
        },
        { merge: true }
      );

      const doc = await probeRef.get();

      return {
        connected: true,
        configured: true,
        projectId: credentials.serviceAccount.project_id || credentials.serviceAccount.projectId,
        source: credentials.type === 'file' ? path.basename(credentials.path) : 'env_vars',
        serverTimestamp: now,
        data: doc.data(),
      };
    } catch (err) {
      const projId = credentials.serviceAccount.project_id || credentials.serviceAccount.projectId;
      const isNotFound = err.code === 5 || (err.message && err.message.includes('NOT_FOUND'));

      const errorMessage = isNotFound
        ? `Cloud Firestore aún no ha sido creado en el proyecto '${projId}'. En Firebase Console ve a: Build -> Firestore Database -> 'Crear base de datos'.`
        : err.message;

      return {
        connected: false,
        configured: true,
        projectId: projId,
        error: errorMessage,
        code: err.code || 'UNKNOWN_ERROR',
        needsDatabaseCreation: isNotFound,
      };
    }
  },
};

module.exports = firebaseService;
