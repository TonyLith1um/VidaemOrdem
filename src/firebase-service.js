import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Operation type for error tracking
export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error && error.message && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration or network connection.");
    }
  }
}
testConnection();

// Check for pending redirect result on boot
getRedirectResult(auth).catch(err => {
  console.warn('Redirect result check:', err);
});

// Expose clean helper functions on window
window.firebaseBridge = {
  auth,
  db,
  clientId: firebaseConfig.oAuthClientId,
  getCurrentUser: () => auth.currentUser,
  onAuthChange: (callback) => {
    return onAuthStateChanged(auth, callback);
  },
  loginWithGoogle: async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err) {
      console.error('Error signing in with Google Popup:', err);
      // If popup is blocked by the browser or sandbox, attempt redirect or surface code
      if (err.code === 'auth/popup-blocked') {
        console.warn('Popup blocked, attempting redirect...');
        try {
          await signInWithRedirect(auth, googleProvider);
          return null;
        } catch (redirectErr) {
          console.error('Redirect sign in also failed:', redirectErr);
          throw redirectErr;
        }
      }
      throw err;
    }
  },
  loginWithIdToken: async (idToken) => {
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      return result.user;
    } catch (err) {
      console.error('Error signing in with Google Credential:', err);
      throw err;
    }
  },
  logout: async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Error signing out:', err);
      throw err;
    }
  },
  saveUserData: async (userId, data) => {
    if (!userId) return;
    const path = `users/${userId}`;
    try {
      const payload = {
        ...data,
        userId,
        updatedAt: Date.now()
      };
      await setDoc(doc(db, 'users', userId), payload, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },
  loadUserData: async (userId) => {
    if (!userId) return null;
    const path = `users/${userId}`;
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  },
  subscribeUserData: (userId, onData, onError) => {
    if (!userId) return () => {};
    const path = `users/${userId}`;
    return onSnapshot(
      doc(db, 'users', userId),
      (snap) => {
        if (snap.exists()) {
          onData(snap.data());
        }
      },
      (err) => {
        if (onError) onError(err);
        handleFirestoreError(err, OperationType.GET, path);
      }
    );
  }
};
