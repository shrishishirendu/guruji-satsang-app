// Firebase Auth UIDs allowed to open the admin dashboard.
//
// IMPORTANT: this list must stay in sync with isAdmin() in firestore.rules.
// The rules are the REAL security gate (they decide what data can be read);
// this list only controls whether the app shows the admin UI. Adding an admin
// means updating BOTH this file and firestore.rules, then deploying the rules.
export const ADMIN_UIDS = [
  'QRyzzGcLqWZMvsi2KlTPqohCASM2', // Shishirendu Kumar Jha — shri.shishirendu@gmail.com
  'dc4xSXwmYAhmCS6pAGCTqwUJlR72', // Mohit Jain — poojamohitjain07@gmail.com
];

export function isAdminUid(uid) {
  return !!uid && ADMIN_UIDS.includes(uid);
}
