import { initializeApp } from 'firebase/app';
import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';
import emailjs from '@emailjs/browser';
import { EMAILJS_CONFIG, FIREBASE_CONFIG } from './app-config';

export interface ContactPayload {
  name: string;
  email: string;
  message: string;
}

// Firebase + EmailJS are only needed once someone submits the contact form, so this
// module is dynamically imported from the Contact component instead of sitting in the
// main bundle for every visitor.
const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });

async function logError(error: unknown, context: string): Promise<void> {
  try {
    await addDoc(collection(db, 'errorLogs'), {
      error: error instanceof Error ? error.message : JSON.stringify(error),
      context,
      timestamp: serverTimestamp(),
    });
  } catch {
    /* logging is best-effort; swallow secondary failures */
  }
}

export async function sendContactMessage(payload: ContactPayload): Promise<void> {
  try {
    await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
      from_name: payload.name,
      from_email: payload.email,
      message: payload.message,
    });

    await addDoc(collection(db, 'contactSubmissions'), {
      ...payload,
      timestamp: serverTimestamp(),
      status: 'received',
    });
  } catch (error) {
    await logError(error, 'contactFormSubmission');
    throw error;
  }
}
