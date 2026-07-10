import {
  collection, query, where, getDocs, doc, getDoc, setDoc, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { normalizePhone } from './contacts';

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

// Records the signed-in viewer as having opened this satsang, so (a) the host
// can see who opened the shared link in their invite/RSVP list and (b) it shows
// up on the viewer's own calendar. Keyed on the viewer's own normalized number
// (a "guest" self-grant), idempotent, and completely non-fatal — viewing the
// satsang never depends on this succeeding. Skips the host (they don't invite
// themselves) and anyone already recorded (by the host or a previous open), so
// it never clobbers a record the host made.
export async function ensureSelfGuestGrant(inviteId, currentUser, userProfile) {
  if (!inviteId || !currentUser || !userProfile) return;
  const phone = userProfile.mobileNormalized || normalizePhone(userProfile.mobile || '');
  if (!phone) return;
  const ref = doc(db, 'guests', `${inviteId}_${phone}`);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) return;   // already tracked — leave it as-is
    const name = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim()
      || currentUser.email || 'Sangat member';
    await setDoc(ref, {
      inviteId,
      name,
      phone,
      displayPhone: userProfile.mobile || phone,
      addedByUid: currentUser.uid,
      source: 'opened-link',
      via: 'whatsapp',
      invitedAt: Timestamp.now(),
    });
  } catch (_) {
    // Non-fatal: the satsang is still fully viewable without this record.
  }
}
