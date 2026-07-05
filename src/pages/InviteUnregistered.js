import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection, getDocs, query, where, doc, getDoc, setDoc, Timestamp,
} from 'firebase/firestore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import AppShell from '../components/AppShell';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import {
  isContactPickerSupported, pickContacts, normalizePhone,
  buildInviteMessage, buildWhatsAppLink,
} from '../utils/contacts';
import { showError } from '../utils/notify';
import { formatRsvpBy } from '../utils/dates';

// Invite people who are NOT on the app yet — a bulk flow: add several phone
// contacts (from the phone book or by hand), then tap WhatsApp on each to send
// them their invite & RSVP link. Every WhatsApp tap (and the Save & Finish
// button) records a "guest" grant so the person can actually see this satsang —
// and gets it on their calendar — once they register with that number.
export default function InviteUnregistered() {
  const { inviteId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const [invite, setInvite] = useState(null);
  const [guests, setGuests] = useState([]);          // [{ name, phone }]
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [sending, setSending] = useState(false);

  // Numbers already saved to the invite list when the page opened, so re-opening
  // to add more people only writes the new ones and we can badge the rest.
  const [invitedPhones, setInvitedPhones] = useState(new Set());

  const hostName = userProfile
    ? `${userProfile.firstName} ${userProfile.lastName}`
    : (invite?.hostName || '');

  useEffect(() => {
    getDoc(doc(db, 'satsangs', inviteId)).then(snap => {
      if (snap.exists()) setInvite({ id: snap.id, ...snap.data() });
    });

    // Re-load guests I've already added to this invite, so managing the event
    // doesn't lose existing entries and I can see who's already been added.
    getDocs(query(collection(db, 'guests'), where('addedByUid', '==', currentUser.uid)))
      .then(snap => {
        const mine = snap.docs
          .map(d => d.data())
          .filter(d => d.inviteId === inviteId)
          .map(d => ({ name: d.name, phone: d.displayPhone || d.phone }));
        if (mine.length) {
          setGuests(mine);
          setInvitedPhones(new Set(mine.map(g => normalizePhone(g.phone))));
        }
      })
      .catch(() => {});
  }, [currentUser.uid, inviteId]);

  // Guard: for a private satsang only the host may invite others (mirrors
  // canForward() in firestore.rules). Blocks anyone who reaches this page via a
  // direct URL without the right, so they get a clear message not a failed send.
  useEffect(() => {
    if (invite && !(currentUser.uid === invite.hostUid || invite.publicInvite === true)) {
      showError('Only the host can invite others to a private satsang.');
      navigate(`/invite/${inviteId}`);
    }
  }, [invite, currentUser.uid, inviteId, navigate]);

  // ---- Building the guest list ---------------------------------------------

  function addGuest(name, phone) {
    const raw = (phone || '').trim();
    if (!raw) return showError('A phone number is required.');
    const norm = normalizePhone(raw);
    setGuests(g => {
      // Dedupe by normalized number so "0404…", "+61404…" and "61404…" match.
      if (g.some(x => normalizePhone(x.phone) === norm)) {
        toast('Already added', { icon: 'ℹ️' });
        return g;
      }
      return [...g, { name: (name || '').trim() || raw, phone: raw }];
    });
  }

  function removeGuest(phone) {
    setGuests(g => g.filter(x => x.phone !== phone));
  }

  async function importFromPhone() {
    const picked = await pickContacts();
    if (picked.length === 0) return;
    let added = 0;
    setGuests(g => {
      const existing = new Set(g.map(x => normalizePhone(x.phone)));
      const fresh = [];
      picked.forEach(c => {
        const raw = (c.phone || '').trim();
        const norm = normalizePhone(raw);
        if (raw && norm && !existing.has(norm)) {
          existing.add(norm);
          fresh.push({ name: c.name || raw, phone: raw });
        }
      });
      added = fresh.length;
      return [...g, ...fresh];
    });
    toast.success(`${added} contact${added === 1 ? '' : 's'} added`);
  }

  function handleManualAdd() {
    if (!manualPhone.trim()) return showError('Enter a phone number.');
    addGuest(manualName, manualPhone);
    setManualName('');
    setManualPhone('');
  }

  // ---- WhatsApp message + saving the grant ---------------------------------

  const rsvpLink = `${window.location.origin}/invite/${inviteId}/rsvp`;
  const inviteMeta = invite && {
    dateStr: invite.date ? format(invite.date.toDate(), 'd MMMM yyyy') : '',
    startTime: invite.startTime,
    endTime: invite.endTime,
    address: invite.address,
    rsvpBy: formatRsvpBy(invite.rsvpBy),
  };

  function whatsappLinkFor(guest) {
    return buildWhatsAppLink(guest.phone, buildInviteMessage(inviteMeta, rsvpLink, hostName));
  }

  // Deterministic ids ("<inviteId>_<phone>") make saving idempotent — no
  // duplicate guests — and act as the access grant the security rules check.
  function guestGrant(guest, norm) {
    return setDoc(doc(db, 'guests', `${inviteId}_${norm}`), {
      inviteId,
      name: guest.name,
      phone: norm,
      displayPhone: guest.phone,
      addedByUid: currentUser.uid,
      source: 'unregistered-invite',
      invitedAt: Timestamp.now(),
    });
  }

  // Tapping WhatsApp both sends the invite AND records the grant, so a person the
  // host messages can always see the satsang once they register — even if the
  // host never taps Save & Finish. The chat window is opened synchronously (in
  // the click) so it isn't blocked as a popup; the save runs in the background.
  function whatsappGuest(guest) {
    window.open(whatsappLinkFor(guest), '_blank', 'noopener');
    const norm = normalizePhone(guest.phone);
    if (!norm || invitedPhones.has(norm)) return;
    guestGrant(guest, norm)
      .then(() => setInvitedPhones(s => new Set(s).add(norm)))
      .catch(err => {
        console.error(err);
        showError('Message opened, but saving to your invite list failed. Tap Save & Finish.');
      });
  }

  // ---- Save & finish -------------------------------------------------------

  async function saveAndFinish() {
    // Only write people not already saved (accurate, idempotent).
    const newGuests = guests
      .map(g => ({ ...g, norm: normalizePhone(g.phone) }))
      .filter(g => g.norm && !invitedPhones.has(g.norm));

    setSending(true);
    try {
      await Promise.all(newGuests.map(g => guestGrant(g, g.norm)));
      const total = newGuests.length;
      if (total > 0) {
        toast.success(`${total} added to your invite list!`);
      }
      navigate(`/invite/${inviteId}/invited`);
    } catch (err) {
      console.error(err);
      showError('Could not save the invite list. Please try again.');
    } finally {
      setSending(false);
    }
  }

  const isSaved = g => invitedPhones.has(normalizePhone(g.phone));
  const newCount = guests.filter(g => !isSaved(g)).length;

  return (
    <AppShell>
      <h1 className="page-header mt-4">Satsang Seva</h1>

      <h2 className="text-saffron-500 font-semibold mb-2">Invite Unregistered Sangat</h2>
      <p className="text-sm text-gray-500 mb-4 leading-relaxed">
        Add the Sangat you'd like to invite, then tap{' '}
        <span className="text-green-600 font-medium">WhatsApp</span> to send each
        person their invite &amp; RSVP link. They're saved to your invite list and
        can see this {invite?.publicInvite ? 'Public' : 'Private'} Satsang once they
        register with that number.
      </p>

      {isContactPickerSupported() && (
        <button
          type="button"
          className="btn-secondary mb-3"
          onClick={importFromPhone}
        >
          📇 Pick from Phone Contacts
        </button>
      )}

      {/* Manual add */}
      <div className="flex gap-2 mb-3">
        <input
          className="input-field"
          placeholder="Name (optional)"
          value={manualName}
          onChange={e => setManualName(e.target.value)}
        />
        <input
          className="input-field"
          placeholder="Phone (e.g. 0404…)"
          value={manualPhone}
          inputMode="tel"
          onChange={e => setManualPhone(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleManualAdd(); } }}
        />
        <button
          type="button"
          className="text-saffron-600 font-semibold whitespace-nowrap hover:text-saffron-800 px-2"
          onClick={handleManualAdd}
        >
          Add
        </button>
      </div>

      {/* Guest list */}
      {guests.length > 0 && (
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto mb-4">
          {guests.map(g => (
            <div
              key={g.phone}
              className="flex items-center gap-3 p-3 rounded-xl border-2 border-blue-100 bg-blue-50"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm truncate">{g.name}</p>
                <p className="text-xs text-gray-400">{g.phone}</p>
              </div>
              {isSaved(g) && (
                <span className="text-[11px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full shrink-0">
                  Invited
                </span>
              )}
              <button
                type="button"
                onClick={() => whatsappGuest(g)}
                className="text-green-600 font-semibold text-sm whitespace-nowrap hover:text-green-700"
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => removeGuest(g.phone)}
                className="text-gray-400 hover:text-red-500 text-lg leading-none"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mb-4 text-center">
        Tap <span className="text-green-600 font-medium">WhatsApp</span> to send each
        guest their invite, or Save &amp; Finish to add everyone to your invite list.
      </p>

      <button
        className="btn-primary"
        onClick={saveAndFinish}
        disabled={sending || guests.length === 0}
      >
        {sending
          ? 'Saving…'
          : newCount > 0
            ? `Save ${newCount} & Finish`
            : 'Finish'}
      </button>
    </AppShell>
  );
}
