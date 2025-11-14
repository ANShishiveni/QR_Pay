const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  if (!admin.apps.length) {
    // Check if environment variables are loaded
    if (!process.env.FIREBASE_PROJECT_ID) {
      console.error(' Firebase environment variables not loaded. Make sure .env file exists and is properly configured.');
      throw new Error('Firebase environment variables not found');
    }

    // Fix private key formatting (avoid logging sensitive material)
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) {
      // Replace literal \n with actual newlines and strip wrapping quotes
      privateKey = privateKey.replace(/\\n/g, '\n');
      privateKey = privateKey.replace(/^["']|["']$/g, '');
    } else {
      console.error(' FIREBASE_PRIVATE_KEY not found in environment variables');
      throw new Error('FIREBASE_PRIVATE_KEY not found');
    }

    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
    };

    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com/`
      });

      console.log(' Firebase Admin initialized successfully');
    } catch (error) {
      console.error(' Firebase initialization failed:', error.message);
      throw error;
    }
  }
  
  return admin;
};

// Initialize Firebase services after app is initialized
const getFirebaseServices = () => {
  if (!admin.apps.length) {
    throw new Error('Firebase app not initialized. Call initializeFirebase() first.');
  }
  
  return {
    db: admin.firestore(),
    auth: admin.auth(),
    realtimeDb: admin.database(),
    storage: admin.storage()
  };
};

module.exports = {
  admin,
  initializeFirebase,
  getFirebaseServices
};
