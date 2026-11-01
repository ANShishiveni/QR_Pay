const admin = require('firebase-admin');

function emulatorConfiguration(env = process.env) {
  const host = env.FIREBASE_DATABASE_EMULATOR_HOST;
  if (!host) {
    if (env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Do not mix Firebase Auth emulator with a live database');
    return null;
  }
  if (!/^(127\.0\.0\.1|localhost):\d{1,5}$/.test(host) || (Number(host.split(':').at(-1)) < 1 || Number(host.split(':').at(-1)) > 65535)) {
    throw new Error('Firebase emulator must use a loopback host and valid port');
  }
  if (env.NODE_ENV === 'production' || env.DEMO_MODE !== 'true' || !/^demo-[a-z0-9-]+$/.test(env.FIREBASE_PROJECT_ID || '')) {
    throw new Error('Firebase emulator requires an explicit non-production demo project');
  }
  if (env.FIREBASE_AUTH_EMULATOR_HOST && (!/^(127\.0\.0\.1|localhost):\d{1,5}$/.test(env.FIREBASE_AUTH_EMULATOR_HOST) || Number(env.FIREBASE_AUTH_EMULATOR_HOST.split(':').at(-1)) < 1 || Number(env.FIREBASE_AUTH_EMULATOR_HOST.split(':').at(-1)) > 65535)) {
    throw new Error('Firebase Auth emulator must use a loopback host');
  }
  return { host, projectId: env.FIREBASE_PROJECT_ID };
}

function initializeFirebase(env = process.env) {
  if (admin.apps.length) return admin;
  const emulator = emulatorConfiguration(env);
  const projectId = env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required');
  const options = { projectId, databaseURL: env.FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com` };
  if (!emulator) {
    if (!env.FIREBASE_PRIVATE_KEY || !env.FIREBASE_CLIENT_EMAIL) throw new Error('Firebase service-account credentials are required outside the emulator');
    options.credential = admin.credential.cert({
      projectId, clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^["']|["']$/g, ''),
    });
  }
  admin.initializeApp(options);
  return admin;
}

function getFirebaseServices() {
  if (!admin.apps.length) throw new Error('Initialize Firebase before accessing services');
  return { auth: admin.auth(), realtimeDb: admin.database() };
}

module.exports = { admin, initializeFirebase, getFirebaseServices, emulatorConfiguration };
