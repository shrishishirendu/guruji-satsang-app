import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export default function RSVPList() {
  const { inviteId } = useParams();
  const { currentUser } = useAuth();
  const [rsvps, setRsvps] = useState([]);
  const [guests, setGuests] = useState([]);
  const [appInvitees, setAppInvitees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // The rules only let the satsang's host read these, so a non-host
        // query is rejected — show an access message instead of crashing.
        // The invitations query is scoped to fromUid == me (the only way the
        // rules let a host read them), so it counts app-members THIS host
        // invited; re-invites a guest forwarded on aren't host-readable.
        const reads = [
          getDocs(query(collection(db, 'rsvps'), where('inviteId', '==', inviteId))),
          getDocs(query(collection(db, 'guests'), where('inviteId', '==', inviteId))),
        ];
        if (currentUser?.uid) {
          reads.push(getDocs(query(collection(db, 'invitations'), where('fromUid', '==', currentUser.uid))));
        }
        const [rsvpSnap, guestSnap, inviteSnap] = await Promise.all(reads);
        const rows = rsvpSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort by creation time client-side (avoids needing a composite index)
        rows.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
        setRsvps(rows);

        const guestRows = guestSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        guestRows.sort((a, b) => (a.invitedAt?.toMillis?.() || 0) - (b.invitedAt?.toMillis?.() || 0));
        setGuests(guestRows);

        // App-members this host invited to this satsang (dedupe by toUid), with
        // names resolved from their profiles so the host sees WHO, not just how
        // many. Only read the directory when there's at least one to name.
        const appUids = [...new Set(
          (inviteSnap?.docs || [])
            .map(d => d.data())
            .filter(d => d.inviteId === inviteId)
            .map(d => d.toUid)
        )];
        let appList = [];
        if (appUids.length) {
          const usersSnap = await getDocs(collection(db, 'users'));
          const nameByUid = {};
          usersSnap.docs.forEach(u => {
            const d = u.data();
            nameByUid[u.id] = `${d.firstName || ''} ${d.lastName || ''}`.trim();
          });
          appList = appUids
            .map(uid => ({ uid, name: nameByUid[uid] || 'Sangat member' }))
            .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        }
        setAppInvitees(appList);
      } catch (err) {
        console.warn('RSVP list not accessible:', err);
        setDenied(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [inviteId, currentUser]);

  const totalAdults   = rsvps.reduce((s, r) => s + (r.adults   || 0), 0);
  const totalChildren = rsvps.reduce((s, r) => s + (r.children || 0), 0);
  const invitedTotal  = guests.length + appInvitees.length;

  return (
    <AppShell>
      <h1 className="page-header mt-4">Satsang Seva</h1>

      {loading && <p className="text-center text-gray-400">Loading…</p>}

      {!loading && denied && (
        <p className="text-center text-gray-400 mt-8">
          Only the host can view the RSVP list for this satsang.
        </p>
      )}

      {!loading && !denied && (
        <>
        <p className="text-sm text-gray-500 mb-1">
          {invitedTotal} Invited · {rsvps.length} Response{rsvps.length === 1 ? '' : 's'} · {totalAdults + totalChildren} Attending
        </p>
        <p className="text-xs text-gray-400 mb-2">
          A = Adults · C = Children · S = Seva
        </p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="pb-1" />
                <th
                  colSpan={3}
                  className="text-center text-saffron-400 font-semibold pb-1 border-b border-saffron-200"
                >
                  RSVP
                </th>
              </tr>
              <tr>
                <th className="text-left text-saffron-400 font-semibold pt-1 pb-3 pr-3">Sangat</th>
                <th className="text-saffron-400 font-semibold pt-1 pb-3 px-3">A</th>
                <th className="text-saffron-400 font-semibold pt-1 pb-3 px-3">C</th>
                <th className="text-saffron-400 font-semibold pt-1 pb-3 pl-3">S</th>
              </tr>
            </thead>
            <tbody>
              {rsvps.map(r => (
                <tr key={r.id} className="border-t border-gray-50">
                  <td className="py-2 pr-3 text-gray-700">{r.name}</td>
                  <td className="py-2 px-3 text-center text-gray-700">{r.adults || ''}</td>
                  <td className="py-2 px-3 text-center text-gray-700">{r.children || ''}</td>
                  <td className="py-2 pl-3 text-center text-gray-700">{r.requestSeva ? 'Y' : ''}</td>
                </tr>
              ))}
              {rsvps.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">No RSVPs yet</td>
                </tr>
              )}
            </tbody>
            {rsvps.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-saffron-100">
                  <td className="pt-3 font-bold text-saffron-400">Total</td>
                  <td className="pt-3 text-center font-bold text-saffron-400">{totalAdults}</td>
                  <td className="pt-3 text-center font-bold text-saffron-400">{totalChildren}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        </>
      )}

      {!loading && !denied && appInvitees.length > 0 && (
        <div className="card mt-6">
          <h2 className="text-saffron-400 font-semibold mb-3 text-sm">
            Invited via Invite Sangat — app members ({appInvitees.length})
          </h2>
          <div className="flex flex-col gap-2">
            {appInvitees.map(a => (
              <div key={a.uid} className="text-sm text-gray-700">{a.name}</div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Registered sangat you invited from the app — they see this satsang on their calendar and appear in the table above once they RSVP.
          </p>
        </div>
      )}

      {!loading && !denied && guests.length > 0 && (
        <div className="card mt-6">
          <h2 className="text-saffron-400 font-semibold mb-3 text-sm">
            Invited via WhatsApp / phone ({guests.length})
          </h2>
          <div className="flex flex-col gap-2">
            {guests.map(g => (
              <div key={g.id} className="flex justify-between items-center text-sm">
                <span className="text-gray-700">{g.name}</span>
                <span className="text-gray-400">{g.displayPhone || g.phone}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            These guests were invited via WhatsApp. They’ll appear in the table above once they RSVP.
          </p>
        </div>
      )}
    </AppShell>
  );
}
