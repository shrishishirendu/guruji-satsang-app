import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { normalizePhone } from '../utils/contacts';

// Colour each person by how they were invited. A registered app member always
// wins (green), even if also phone-invited; unregistered phone invites are split
// by the button used — hand-added (blue) vs shared over WhatsApp (purple). Each
// row gets a matching tint + pill badge so the three groups are unmistakable.
const NAME_COLOR = {
  app: 'text-green-700',
  manual: 'text-blue-700',
  whatsapp: 'text-purple-700',
};
const ROW_BG = {
  app: 'bg-green-50',
  manual: 'bg-blue-50',
  whatsapp: 'bg-purple-50',
};
const BADGE = {
  app:      { label: 'Registered', cls: 'bg-green-100 text-green-700' },
  manual:   { label: 'Manual',     cls: 'bg-blue-100 text-blue-700' },
  whatsapp: { label: 'WhatsApp',   cls: 'bg-purple-100 text-purple-700' },
};

export default function RSVPList() {
  const { inviteId } = useParams();
  const { currentUser } = useAuth();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // Host-only reads (the rules reject a non-host, which we surface as a
        // message). Invitations are scoped to fromUid == me — the only ones the
        // rules let a host read.
        const reads = [
          getDocs(query(collection(db, 'rsvps'), where('inviteId', '==', inviteId))),
          getDocs(query(collection(db, 'guests'), where('inviteId', '==', inviteId))),
        ];
        if (currentUser?.uid) {
          reads.push(getDocs(query(collection(db, 'invitations'), where('fromUid', '==', currentUser.uid))));
        }
        const [rsvpSnap, guestSnap, inviteSnap] = await Promise.all(reads);

        const rsvpRows = rsvpSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const guestRows = guestSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const inviteDocs = (inviteSnap?.docs || [])
          .map(d => d.data())
          .filter(d => d.inviteId === inviteId);

        // Resolve names + normalized phones for everyone we might show, so we can
        // (a) name app-member invitees and (b) recognise a phone guest who has
        // since registered (their number matches a user's) and fold them in.
        const usersById = {};
        const uidByPhone = {};
        if (inviteDocs.length || rsvpRows.length || guestRows.length) {
          const usersSnap = await getDocs(collection(db, 'users'));
          usersSnap.docs.forEach(u => {
            const d = u.data();
            const name = `${d.firstName || ''} ${d.lastName || ''}`.trim();
            const phone = d.mobileNormalized || normalizePhone(d.mobile || '');
            usersById[u.id] = { name, phone };
            if (phone) uidByPhone[phone] = u.id;
          });
        }

        const rsvpByUid = {};
        rsvpRows.forEach(r => { if (r.uid) rsvpByUid[r.uid] = r; });

        // One row per person, keyed by uid when registered else by phone.
        const peopleMap = new Map();
        const upsert = (key, data) => peopleMap.set(key, { ...(peopleMap.get(key) || {}), ...data });

        // 1. App-member invitees (from invitations).
        inviteDocs.forEach(d => {
          const prof = usersById[d.toUid] || {};
          upsert(d.toUid, {
            key: d.toUid, uid: d.toUid,
            name: prof.name || 'Sangat member', phone: prof.phone || '',
            channel: 'app', category: 'app',
          });
        });

        // 2. Phone/WhatsApp guests — folded into a registered user's row when
        //    their number now belongs to one ("back on the sangat list"),
        //    otherwise shown as a not-yet-registered phone invite.
        guestRows.forEach(g => {
          const phone = g.phone || normalizePhone(g.displayPhone || '');
          const registeredUid = phone && uidByPhone[phone];
          if (registeredUid) {
            // Registered wins: fold the phone invite into their app row.
            const prof = usersById[registeredUid] || {};
            upsert(registeredUid, {
              key: registeredUid, uid: registeredUid,
              name: prof.name || g.name, phone, channel: 'app', category: 'app',
            });
          } else {
            upsert(`phone:${phone}`, {
              key: `phone:${phone}`, name: g.name, phone,
              displayPhone: g.displayPhone || g.phone, channel: 'phone',
              category: g.via === 'whatsapp' ? 'whatsapp' : 'manual',
            });
          }
        });

        // 3. Any responders not already listed (e.g. a public-link walk-in).
        rsvpRows.forEach(r => {
          if (r.uid && !peopleMap.has(r.uid)) {
            const prof = usersById[r.uid] || {};
            upsert(r.uid, {
              key: r.uid, uid: r.uid,
              name: r.name || prof.name || 'Sangat member', phone: prof.phone || '',
              channel: 'app', category: 'app',
            });
          }
        });

        // Attach each person's RSVP numbers (matched by uid).
        const rows = [...peopleMap.values()].map(p => {
          const r = p.uid ? rsvpByUid[p.uid] : null;
          return {
            ...p,
            responded: !!r,
            adults: r?.adults || 0,
            children: r?.children || 0,
            requestSeva: !!r?.requestSeva,
          };
        });

        // Group by channel — registered, then hand-added, then WhatsApp-shared —
        // so same-coloured rows sit together; alphabetical within each group.
        const rank = { app: 0, manual: 1, whatsapp: 2 };
        rows.sort((a, b) =>
          (rank[a.category] ?? 3) - (rank[b.category] ?? 3) ||
          a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        );

        setPeople(rows);
      } catch (err) {
        console.warn('RSVP list not accessible:', err);
        setDenied(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [inviteId, currentUser]);

  const totalAdults   = people.reduce((s, p) => s + (p.adults   || 0), 0);
  const totalChildren = people.reduce((s, p) => s + (p.children || 0), 0);
  const responded     = people.filter(p => p.responded).length;
  const anyResponded  = responded > 0;
  const hasApp        = people.some(p => p.category === 'app');
  const hasManual     = people.some(p => p.category === 'manual');
  const hasWhatsapp   = people.some(p => p.category === 'whatsapp');

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
          {people.length} Invited · {responded} Response{responded === 1 ? '' : 's'} · {totalAdults + totalChildren} Attending
        </p>
        <p className="text-xs text-gray-400 mb-1">
          A = Adults · C = Children · S = Seva
        </p>
        {(hasApp || hasManual || hasWhatsapp) && (
          <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide mb-2">
            {hasApp && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700">Registered</span>}
            {hasManual && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Manually added</span>}
            {hasWhatsapp && <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Shared via WhatsApp</span>}
          </div>
        )}
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
                <th className="text-left text-saffron-400 font-semibold pt-1 pb-3 pr-3">Registered Sangat</th>
                <th className="text-saffron-400 font-semibold pt-1 pb-3 px-3">A</th>
                <th className="text-saffron-400 font-semibold pt-1 pb-3 px-3">C</th>
                <th className="text-saffron-400 font-semibold pt-1 pb-3 pl-3">S</th>
              </tr>
            </thead>
            <tbody>
              {people.map(p => (
                <tr key={p.key} className={`border-t border-gray-100 ${ROW_BG[p.category] || ''}`}>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className={`font-semibold ${NAME_COLOR[p.category] || 'text-gray-700'}`}>
                        {p.name}
                      </span>
                      {BADGE[p.category] && (
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${BADGE[p.category].cls}`}>
                          {BADGE[p.category].label}
                        </span>
                      )}
                      {p.channel === 'phone' && p.displayPhone && (
                        <span className="text-xs text-gray-400">{p.displayPhone}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-center text-gray-700">{p.adults || ''}</td>
                  <td className="py-2 px-3 text-center text-gray-700">{p.children || ''}</td>
                  <td className="py-2 pl-3 text-center text-gray-700">{p.requestSeva ? 'Y' : ''}</td>
                </tr>
              ))}
              {people.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">No one invited yet</td>
                </tr>
              )}
            </tbody>
            {anyResponded && (
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
    </AppShell>
  );
}
