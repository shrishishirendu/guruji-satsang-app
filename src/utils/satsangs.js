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
//   - private satsangs they were invited to by phone/WhatsApp, once they've
//     registered (their normalized number matches a guest grant)
//
// `myPhone` is the user's normalized mobile (userProfile.mobileNormalized); pass
// it so phone-invited guests see their satsangs on the calendar, not only via
// the direct link. The guest query degrades gracefully if the rules haven't
// caught up, so it never breaks the rest of the calendar.
//
// Returns a de-duplicated array of { id, ...data }.
export async function loadVisibleSatsangs(currentUser, myPhone) {
  if (!currentUser) return [];
  const satsangs = collection(db, 'satsangs');

  const [publicSnap, hostedSnap, invitedSnap, guestSnap] = await Promise.all([
    getDocs(query(satsangs, where('publicInvite', '==', true))),
    getDocs(query(satsangs, where('hostUid', '==', currentUser.uid))),
    getDocs(query(collection(db, 'invitations'), where('toUid', '==', currentUser.uid))),
    myPhone
      ? getDocs(query(collection(db, 'guests'), where('phone', '==', myPhone))).catch(() => null)
      : Promise.resolve(null),
  ]);

  const byId = new Map();
  publicSnap.forEach(d => byId.set(d.id, { id: d.id, ...d.data() }));
  hostedSnap.forEach(d => byId.set(d.id, { id: d.id, ...d.data() }));

  // Fetch each invited/guest satsang by id (the rules allow these single-doc
  // reads for someone who holds the app-invite or phone grant).
  const grantedIds = [
    ...invitedSnap.docs.map(d => d.data().inviteId),
    ...(guestSnap ? guestSnap.docs.map(d => d.data().inviteId) : []),
  ];
  const invitedIds = [...new Set(grantedIds)].filter(id => id && !byId.has(id));
  const invitedDocs = await Promise.all(
    invitedIds.map(id => getDoc(doc(db, 'satsangs', id)).catch(() => null))
  );
  invitedDocs.forEach(s => {
    if (s && s.exists()) byId.set(s.id, { id: s.id, ...s.data() });
  });

  return [...byId.values()];
}
