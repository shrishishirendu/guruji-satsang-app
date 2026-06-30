import {
  collection, query, where, getDocs, doc, getDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Loads every satsang the signed-in user is allowed to see, mirroring the
// Firestore security rules so each sub-query is provably allowed (no
// permission-denied errors):
//   - all public satsangs
//   - satsangs they host
//   - private satsangs they hold an app-account invite to
//
// Phone-only guests reach a private satsang through their direct WhatsApp link
// (a single-document read the rules allow); they don't surface here because
// they have no app account to list by.
//
// Returns a de-duplicated array of { id, ...data }.
export async function loadVisibleSatsangs(currentUser) {
  if (!currentUser) return [];
  const satsangs = collection(db, 'satsangs');

  const [publicSnap, hostedSnap, invitedSnap] = await Promise.all([
    getDocs(query(satsangs, where('publicInvite', '==', true))),
    getDocs(query(satsangs, where('hostUid', '==', currentUser.uid))),
    getDocs(query(collection(db, 'invitations'), where('toUid', '==', currentUser.uid))),
  ]);

  const byId = new Map();
  publicSnap.forEach(d => byId.set(d.id, { id: d.id, ...d.data() }));
  hostedSnap.forEach(d => byId.set(d.id, { id: d.id, ...d.data() }));

  // Fetch each invited satsang by id (the rules allow these single-doc reads).
  const invitedIds = [...new Set(invitedSnap.docs.map(d => d.data().inviteId))]
    .filter(id => id && !byId.has(id));
  const invitedDocs = await Promise.all(
    invitedIds.map(id => getDoc(doc(db, 'satsangs', id)).catch(() => null))
  );
  invitedDocs.forEach(s => {
    if (s && s.exists()) byId.set(s.id, { id: s.id, ...s.data() });
  });

  return [...byId.values()];
}
