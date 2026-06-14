// ============================================================
// FIREBASE CONFIGURATION
// Replace these values with your own Firebase project config.
// Get them from: Firebase Console → Project Settings → Your Apps
// ============================================================
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyAFI9DD-inzZVtj9Brr52meWUrYXyYQBoo",
  authDomain:        "satsang-77b05.firebaseapp.com",
  projectId:         "satsang-77b05",
  storageBucket:     "satsang-77b05.firebasestorage.app",
  messagingSenderId: "144134734781",
  appId:             "1:144134734781:web:009d627687229d003088d4",
  measurementId:     "G-GPDXLSX9J5",
};

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export default app;
