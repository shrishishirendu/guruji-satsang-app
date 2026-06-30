import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { normalizePhone } from '../utils/contacts';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function register({ firstName, lastName, mobile, email, password }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), {
      firstName,
      lastName,
      mobile,
      // Normalized form lets the security rules match phone-invited guests to
      // their registered number so they can see private satsangs they're on.
      mobileNormalized: normalizePhone(mobile),
      email,
      createdAt: new Date(),
    });
    return cred;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  // Sends a password-reset email via Firebase. The link in the email opens
  // Firebase's hosted reset page — no extra backend needed.
  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          const profile = snap.exists() ? snap.data() : null;
          // Backfill mobileNormalized for accounts created before it existed,
          // so older users can still be matched to phone invites.
          if (profile && profile.mobile) {
            const norm = normalizePhone(profile.mobile);
            if (profile.mobileNormalized !== norm) {
              await setDoc(doc(db, 'users', user.uid), { mobileNormalized: norm }, { merge: true });
              profile.mobileNormalized = norm;
            }
          }
          setUserProfile(profile);
        } catch (err) {
          // e.g. Firestore rules not yet published, or transient error.
          // Don't crash the app — just treat the profile as missing.
          console.error('Could not load user profile:', err);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = { currentUser, userProfile, register, login, resetPassword, logout, loading };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
