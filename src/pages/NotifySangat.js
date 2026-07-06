import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection, getDocs, query, where, doc, getDoc,
} from 'firebase/firestore';
import { format } from 'date-fns';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import {
  normalizePhone, buildInviteMessage, buildWhatsAppLink, shareInvite,
} from '../utils/contacts';
import { formatRsvpBy } from '../utils/dates';

// After inviting Registered Sangat (which grants in-app access), let the host
// ALSO send each of them the invitation over WhatsApp — the app can't send
// messages itself, so we open the host's WhatsApp prefilled with the invite.
// We already have their saved number, so no capture is needed (unlike the
// unregistered flow): every invited member with a number gets a WhatsApp button,
// and a bulk "Share via WhatsApp" forwards the same invite to everyone at once.
export default function NotifySangat() {
  const { inviteId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const [invite, setInvite] = useState(null);
  const [members, setMembers] = useState([]);   // [{ uid, name, phone }]
  const [loading, setLoading] = useState(true);

  const hostName = userProfile
    ? `${userProfile.firstName} ${userProfile.lastName}`
    : (invite?.hostName || '');

  useEffect(() => {
    async function load() {
      try {
        const [satsangSnap, inviteSnap, usersSnap] = await Promise.all([
          getDoc(doc(db, 'satsangs', inviteId)),
          getDocs(query(collection(db, 'invitations'), where('fromUid', '==', currentUser.uid))),
          getDocs(collection(db, 'users')),
        ]);
        if (satsangSnap.exists()) setInvite({ id: satsangSnap.id, ...satsangSnap.data() });

        // Everyone this host has invited to THIS satsang, resolved to their name
        // and number so we can offer a WhatsApp send.
        const uidSet = new Set(
          inviteSnap.docs
            .map(d => d.data())
            .filter(d => d.inviteId === inviteId)
            .map(d => d.toUid)
        );
        const rows = usersSnap.docs
          .filter(u => uidSet.has(u.id))
          .map(u => {
            const d = u.data();
            return {
              uid: u.id,
              name: `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Sangat member',
              phone: d.mobile || '',   // display form; normalized when we build the link
            };
          })
          .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        setMembers(rows);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentUser.uid, inviteId]);

  const rsvpLink = `${window.location.origin}/invite/${inviteId}/rsvp`;
  const inviteMeta = invite && {
    dateStr: invite.date ? format(invite.date.toDate(), 'd MMMM yyyy') : '',
    startTime: invite.startTime,
    endTime: invite.endTime,
    address: invite.address,
    rsvpBy: formatRsvpBy(invite.rsvpBy),
  };

  function whatsappMember(m) {
    const link = buildWhatsAppLink(m.phone, buildInviteMessage(inviteMeta, rsvpLink, hostName));
    window.open(link, '_blank', 'noopener');
  }

  function shareToAll() {
    shareInvite(inviteMeta, rsvpLink, hostName);
  }

  const withNumber = members.filter(m => normalizePhone(m.phone));

  return (
    <AppShell>
      <h1 className="page-header mt-4">Satsang Seva</h1>
      <h2 className="text-saffron-500 font-semibold mb-2">Send Invite on WhatsApp</h2>
      <p className="text-sm text-gray-500 mb-4 leading-relaxed">
        These Sangat now have the invite in the app. Tap{' '}
        <span className="text-green-600 font-medium">WhatsApp</span> to also send each
        of them the invite &amp; RSVP link, or use{' '}
        <span className="text-green-600 font-medium">Share via WhatsApp</span> to send
        everyone at once.
      </p>

      {loading && <p className="text-center text-gray-400">Loading…</p>}

      {!loading && members.length === 0 && (
        <p className="text-center text-gray-400 py-6">No registered sangat invited yet.</p>
      )}

      {!loading && members.length > 0 && (
        <>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto mb-4">
            {members.map(m => {
              const hasNumber = !!normalizePhone(m.phone);
              return (
                <div
                  key={m.uid}
                  className="flex items-center gap-3 p-3 rounded-xl border-2 border-green-100 bg-green-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{m.name}</p>
                    {m.phone
                      ? <p className="text-xs text-gray-400">{m.phone}</p>
                      : <p className="text-xs text-gray-400 italic">No WhatsApp number on file</p>}
                  </div>
                  {hasNumber && (
                    <button
                      type="button"
                      onClick={() => whatsappMember(m)}
                      className="text-green-600 font-semibold text-sm whitespace-nowrap hover:text-green-700"
                    >
                      WhatsApp
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {withNumber.length > 0 && (
            <button className="btn-primary mb-3" onClick={shareToAll}>
              Share via WhatsApp
            </button>
          )}
        </>
      )}

      <button
        className="btn-secondary"
        onClick={() => navigate(`/invite/${inviteId}`)}
      >
        Done
      </button>
    </AppShell>
  );
}
