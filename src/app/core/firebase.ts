import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { FIREBASE_CONFIG } from './app-config';

// Firebase is never imported at the top level of an eager component — every
// caller reaches this module through a dynamic import() (or a lazy route),
// so it only downloads once someone actually needs auth/data/storage.
const firebaseApp = initializeApp(FIREBASE_CONFIG);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
