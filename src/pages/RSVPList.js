import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';

export default function RSVPList() {
  const { inviteId } = useParams();
  const navigate = useNavigate();
  const [rsvps, setRsvps] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // The rules only let the satsang's host read these, so a non-host
        // query is rejected — show an access message instead of crashing.
        const [rsvpSnap, guestSnap] = await Promise.all([
          getDocs(query(collection(db, 'rsvps'), where('inviteId', '==', inviteId))),
          getDocs(query(collection(db, 'guests'), where('inviteId', '==', inviteId))),
        ]);
        const rows = rsvpSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort by creation time client-side (avoids needing a composite index)
        rows.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
        setRsvps(rows);

        const guestRows = guestSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        guestRows.sort((a, b) => (a.invitedAt?.toMillis?.() || 0) - (b.invitedAt?.toMillis?.() || 0));
        setGuests(guestRows);
      } catch (err) {
        console.warn('RSVP list not accessible:', err);
        setDenied(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [inviteId]);

  const totalAdults   = rsvps.reduce((s, r) => s + (r.adults   || 0), 0);
  const totalChildren = rsvps.reduce((s, r) => s + (r.children || 0), 0);

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
        <p className="text-sm text-gray-500 mb-2">
          {rsvps.length} response{rsvps.length === 1 ? '' : 's'} · {totalAdults + totalChildren} attending
        </p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-saffron-400 font-semibold pb-3 pr-3">Sangat RSVP</th>
                <th className="text-saffron-400 font-semibold pb-3 px-3">Adults</th>
                <th className="text-saffron-400 font-semibold pb-3 px-3">Children</th>
                <th className="text-saffron-400 font-semibold pb-3 pl-3">Seva</th>
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

      {!loading && !denied && guests.length > 0 && (
        <div className="card mt-6">
          <h2 className="text-saffron-400 font-semibold mb-3 text-sm">
            Invited from phone ({guests.length})
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

      <button
        className="btn-primary mt-6"
        onClick={() => navigate('/satsangs')}
      >
        Home
      </button>
    </AppShell>
  );
}
